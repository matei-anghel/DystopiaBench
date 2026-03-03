"use client"

import { useMemo, useState } from "react"
import {
  AVAILABLE_MODELS,
  DEFAULT_JUDGE_MODEL,
  getEstimatedPricingByModelKey,
  JUDGE_MODEL_OPTIONS,
} from "@/lib/dystopiabench/models"
import { ALL_SCENARIOS, ORWELL_SCENARIOS, PETROV_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type { EscalationLevel, Module } from "@/lib/dystopiabench/types"
import type { ConversationMode, TransportPolicy } from "@/lib/dystopiabench/runner"
import { Card } from "@/components/ui/card"
import { AlertTriangle, Terminal, Info } from "lucide-react"

const ESTIMATED_MODEL_INPUT_TOKENS_BY_LEVEL: Record<EscalationLevel, number> = {
  1: 1600,
  2: 2900,
  3: 4200,
  4: 5600,
  5: 7100,
}

const ESTIMATED_MODEL_OUTPUT_TOKENS_PER_PROMPT = 900
const ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT = 2400
const ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT = 120

export function BenchmarkRunner() {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | "both">("both")
  const [selectedLevels, setSelectedLevels] = useState<EscalationLevel[]>([1, 2, 3, 4, 5])
  const [selectedJudgeModel, setSelectedJudgeModel] = useState<string>(DEFAULT_JUDGE_MODEL)
  const [selectedTransport, setSelectedTransport] = useState<TransportPolicy>("chat-first-fallback")
  const [selectedConversationMode, setSelectedConversationMode] = useState<ConversationMode>("stateful")

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const toggleLevel = (level: EscalationLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level].sort()
    )
  }

  const scenarioCount = useMemo(() => {
    if (selectedModule === "petrov") return PETROV_SCENARIOS.length
    if (selectedModule === "orwell") return ORWELL_SCENARIOS.length
    return ALL_SCENARIOS.length
  }, [selectedModule])

  const totalPrompts = selectedModels.length * selectedLevels.length * scenarioCount

  const costEstimate = useMemo(() => {
    if (selectedModels.length === 0 || selectedLevels.length === 0) {
      return {
        totalUsd: 0,
        modelUsd: 0,
        judgeUsd: 0,
        modelInputTokens: 0,
        modelOutputTokens: 0,
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
      }
    }

    const promptsPerModel = scenarioCount * selectedLevels.length
    const inputTokensPerModel = scenarioCount * selectedLevels.reduce((sum, level) => {
      return sum + ESTIMATED_MODEL_INPUT_TOKENS_BY_LEVEL[level]
    }, 0)
    const outputTokensPerModel = promptsPerModel * ESTIMATED_MODEL_OUTPUT_TOKENS_PER_PROMPT

    const aggregateModelInputTokens = inputTokensPerModel * selectedModels.length
    const aggregateModelOutputTokens = outputTokensPerModel * selectedModels.length

    const modelUsd = selectedModels.reduce((sum, modelId) => {
      const pricing = getEstimatedPricingByModelKey(modelId)
      const thisModelCost =
        (inputTokensPerModel / 1_000_000) * pricing.input +
        (outputTokensPerModel / 1_000_000) * pricing.output
      return sum + thisModelCost
    }, 0)

    const judgePromptCount = promptsPerModel * selectedModels.length
    const judgeInputTokens = judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT
    const judgeOutputTokens = judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT
    const judgePricing = getEstimatedPricingByModelKey(selectedJudgeModel)
    const judgeUsd =
      (judgeInputTokens / 1_000_000) * judgePricing.input +
      (judgeOutputTokens / 1_000_000) * judgePricing.output

    return {
      totalUsd: modelUsd + judgeUsd,
      modelUsd,
      judgeUsd,
      modelInputTokens: aggregateModelInputTokens,
      modelOutputTokens: aggregateModelOutputTokens,
      judgeInputTokens,
      judgeOutputTokens,
    }
  }, [scenarioCount, selectedJudgeModel, selectedLevels, selectedModels])

  const formatUsd = (value: number) => `$${value.toFixed(2)}`
  const formatTokens = (value: number) => value.toLocaleString("en-US")

  const runCommand = useMemo(() => {
    if (selectedModels.length === 0) return "Select at least one model."
    const modelsArg = selectedModels.join(",")
    const levelsArg = selectedLevels.join(",")
    const commonArgs = `--module=${selectedModule} --models=${modelsArg} --levels=${levelsArg} --judge-model=${selectedJudgeModel} --transport=${selectedTransport}`
    if (selectedConversationMode === "stateless") {
      return `pnpm bench:run-isolated ${commonArgs}`
    }
    return `pnpm bench:run ${commonArgs} --conversation-mode=stateful`
  }, [selectedConversationMode, selectedJudgeModel, selectedLevels, selectedModels, selectedModule, selectedTransport])

  return (
    <div className="flex flex-col gap-8">
      <Card className="bg-card border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-sm font-bold tracking-wider text-foreground uppercase">
            Local Benchmark Runner
          </h2>
        </div>

        <p className="font-mono text-xs text-muted-foreground mb-6">
          This page only builds commands. It never calls model APIs directly from the browser.
        </p>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Module
          </label>
          <div className="flex gap-2">
            {(["both", "petrov", "orwell"] as const).map((moduleOption) => (
              <button
                key={moduleOption}
                onClick={() => setSelectedModule(moduleOption)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors uppercase ${selectedModule === moduleOption
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                {moduleOption === "both" ? "Both Modules" : `${moduleOption} Module`}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Conversation Mode
          </label>
          <div className="flex gap-2">
            {(["stateful", "stateless"] as ConversationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedConversationMode(mode)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${selectedConversationMode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                {mode === "stateful" ? "Stateful Escalation" : "Isolated Prompts"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Escalation Levels
          </label>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as EscalationLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${selectedLevels.includes(level)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Judge Model
          </label>
          <div className="flex flex-wrap gap-2">
            {JUDGE_MODEL_OPTIONS.map((judgeOption) => (
              <button
                key={judgeOption.id}
                onClick={() => setSelectedJudgeModel(judgeOption.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${selectedJudgeModel === judgeOption.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                {judgeOption.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Transport Policy
          </label>
          <div className="flex gap-2">
            {(["chat-first-fallback", "chat-only"] as TransportPolicy[]).map((tp) => (
              <button
                key={tp}
                onClick={() => setSelectedTransport(tp)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${selectedTransport === tp
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                {tp}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Models ({selectedModels.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${selectedModels.includes(model.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span className="opacity-50 mr-1">{model.provider}/</span>
                {model.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-primary" />
            <p className="font-mono text-xs font-bold uppercase">Generated Command</p>
          </div>
          <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">{runCommand}</code>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
          <p className="font-mono text-xs font-bold uppercase mb-2">Estimated Cost (USD)</p>
          <div className="grid gap-1 font-mono text-[11px] text-muted-foreground">
            <p>
              Total estimate: <span className="text-foreground">{formatUsd(costEstimate.totalUsd)}</span>
            </p>
            <p>
              Model calls: <span className="text-foreground">{formatUsd(costEstimate.modelUsd)}</span>
            </p>
            <p>
              Judge calls: <span className="text-foreground">{formatUsd(costEstimate.judgeUsd)}</span>
            </p>
            <p>
              Model tokens (in/out):{" "}
              <span className="text-foreground">
                {formatTokens(costEstimate.modelInputTokens)} / {formatTokens(costEstimate.modelOutputTokens)}
              </span>
            </p>
            <p>
              Judge tokens (in/out):{" "}
              <span className="text-foreground">
                {formatTokens(costEstimate.judgeInputTokens)} / {formatTokens(costEstimate.judgeOutputTokens)}
              </span>
            </p>
          </div>
          <p className="font-mono text-[10px] mt-3 text-muted-foreground">
            Estimate uses static per-1M token pricing plus level-based token assumptions. Actual billed cost may vary.
          </p>
        </div>
      </Card>

      <Card className="bg-card border-border p-6">
        <h3 className="font-mono text-sm font-bold tracking-wider text-foreground uppercase mb-4">
          Run Steps
        </h3>
        <ol className="font-mono text-xs text-muted-foreground space-y-2 list-decimal pl-4">
          <li>Put your key in `.env.local` as `OPENROUTER_API_KEY=...`.</li>
          <li>Run the generated command from your terminal.</li>
          <li>
            Optional: publish a specific run as latest with <code>pnpm bench:publish --run-id=&lt;run-id&gt;</code>.
          </li>
        </ol>
        <p className="font-mono text-[10px] mt-4 text-muted-foreground uppercase">
          Selected workload: {scenarioCount} scenarios x {selectedLevels.length} levels x {" "}
          {selectedModels.length} models = {totalPrompts} prompts
        </p>
      </Card>

      <Card className="bg-amber-500/5 border-amber-500/30 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-mono text-xs text-amber-200 font-bold uppercase mb-1">
              {selectedConversationMode === "stateful"
                ? "Stateful Escalation Mode"
                : "Isolated Prompt Mode"}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
              {selectedConversationMode === "stateful" ? (
                <>
                  Each scenario-model pair runs as one escalating conversation (L1-&gt;L5). If a model call fails,
                  later levels are still attempted with reset history for that pair.
                </>
              ) : (
                "Each scenario-model-level prompt runs with a fresh context and no prior history. Use this to measure compliance for prompts in isolation."
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
