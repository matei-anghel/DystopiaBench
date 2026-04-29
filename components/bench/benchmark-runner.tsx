"use client"

import { useMemo, useState } from "react"
import {
  AVAILABLE_MODELS,
  DEFAULT_JUDGE_MODEL,
  ESTIMATED_PRICING_LAST_SYNC_DATE,
  ESTIMATED_PRICING_SOURCE_LABEL,
  getEstimatedPricingByModelKey,
  JUDGE_MODEL_OPTIONS,
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
  PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
} from "@/lib/dystopiabench/models"
import { ALL_MODULES, ALL_SCENARIOS, getScenariosByModule } from "@/lib/dystopiabench/scenarios"
import type { EscalationLevel, Module } from "@/lib/dystopiabench/types"
import type {
  ConversationMode,
  JudgeStrategy,
  ProviderPrecisionPolicy,
} from "@/lib/dystopiabench/runner"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Terminal } from "lucide-react"

const FIXED_ESCALATION_LEVELS: EscalationLevel[] = [1, 2, 3, 4, 5]

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
const STANDARD_REPLICATES = 3

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

const JUDGE_SELECT_ITEM_CLASSNAME =
  "focus:bg-red-500/15 focus:text-foreground data-[highlighted]:bg-red-500/15 data-[highlighted]:text-foreground data-[state=checked]:bg-red-500/15 data-[state=checked]:text-foreground"

export function BenchmarkRunner() {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<Module[]>(() => ALL_MODULES.map((module) => module.id))
  const [selectedJudgeStrategy, setSelectedJudgeStrategy] = useState<JudgeStrategy>("pair-with-tiebreak")
  const [selectedPrimaryJudgeModel, setSelectedPrimaryJudgeModel] = useState<string>(DEFAULT_JUDGE_MODEL)
  const [selectedSecondaryJudgeModel, setSelectedSecondaryJudgeModel] =
    useState<string>(PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL)
  const [selectedTiebreakerJudgeModel, setSelectedTiebreakerJudgeModel] =
    useState<string>(PAIR_WITH_TIEBREAK_ARBITER_MODEL)
  const [selectedConversationMode, setSelectedConversationMode] = useState<ConversationMode>("stateful")
  const [selectedProviderPrecision, setSelectedProviderPrecision] =
    useState<ProviderPrecisionPolicy>("default")
  const [replicateMode, setReplicateMode] = useState<"standard" | "custom">("standard")
  const [customReplicateInput, setCustomReplicateInput] = useState<string>(String(STANDARD_REPLICATES))

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => (prev.includes(id) ? prev.filter((model) => model !== id) : [...prev, id]))
  }

  const selectAllModels = () => {
    setSelectedModels(AVAILABLE_MODELS.map((model) => model.id))
  }

  const deselectAllModels = () => {
    setSelectedModels([])
  }

  const toggleModule = (id: Module) => {
    setSelectedModules((prev) => (prev.includes(id) ? prev.filter((moduleId) => moduleId !== id) : [...prev, id]))
  }

  const selectAllModules = () => {
    setSelectedModules(ALL_MODULES.map((module) => module.id))
  }

  const scenarioCount = useMemo(() => {
    if (selectedModules.length === ALL_MODULES.length) return ALL_SCENARIOS.length
    return selectedModules.reduce((sum, moduleId) => sum + getScenariosByModule(moduleId).length, 0)
  }, [selectedModules])

  const moduleOptions = useMemo<Array<{ id: Module; label: string }>>(
    () =>
      ALL_MODULES.map((module) => ({
        id: module.id,
        label: getModuleDisplayLabel(module.label),
      })),
    []
  )

  const modelsByProvider = useMemo(() => {
    const groups = new Map<string, typeof AVAILABLE_MODELS>()
    for (const model of AVAILABLE_MODELS) {
      const existing = groups.get(model.provider) ?? []
      existing.push(model)
      groups.set(model.provider, existing)
    }
    return [...groups.entries()]
  }, [])

  const customReplicates = Number.parseInt(customReplicateInput, 10)
  const hasValidCustomReplicates = Number.isInteger(customReplicates) && customReplicates > 0
  const selectedReplicates =
    replicateMode === "custom" && hasValidCustomReplicates ? customReplicates : STANDARD_REPLICATES
  const totalPrompts = selectedModels.length * FIXED_ESCALATION_LEVELS.length * scenarioCount * selectedReplicates
  const allModelsSelected = selectedModels.length === AVAILABLE_MODELS.length
  const allModulesSelected = selectedModules.length === ALL_MODULES.length

  const costEstimate = useMemo(() => {
    if (selectedModels.length === 0) {
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

    const promptsPerModel = scenarioCount * FIXED_ESCALATION_LEVELS.length * selectedReplicates
    const inputTokensPerModel = scenarioCount * selectedReplicates * FIXED_ESCALATION_LEVELS.reduce((sum, level) => {
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
    const primaryJudgePricing = getEstimatedPricingByModelKey(selectedPrimaryJudgeModel)
    const secondaryJudgePricing = getEstimatedPricingByModelKey(selectedSecondaryJudgeModel)
    const tiebreakerJudgePricing = getEstimatedPricingByModelKey(selectedTiebreakerJudgeModel)
    const judgeInputTokens =
      selectedJudgeStrategy === "pair-with-tiebreak"
        ? judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT * 3
        : judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT
    const judgeOutputTokens =
      selectedJudgeStrategy === "pair-with-tiebreak"
        ? judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT * 3
        : judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT
    const judgeUsd =
      selectedJudgeStrategy === "pair-with-tiebreak"
        ? (
            (judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT / 1_000_000) * primaryJudgePricing.input +
            (judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT / 1_000_000) *
              primaryJudgePricing.output +
            (judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT / 1_000_000) *
              secondaryJudgePricing.input +
            (judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT / 1_000_000) *
              secondaryJudgePricing.output +
            (judgePromptCount * ESTIMATED_JUDGE_INPUT_TOKENS_PER_PROMPT / 1_000_000) *
              tiebreakerJudgePricing.input +
            (judgePromptCount * ESTIMATED_JUDGE_OUTPUT_TOKENS_PER_PROMPT / 1_000_000) *
              tiebreakerJudgePricing.output
          )
        : (judgeInputTokens / 1_000_000) * primaryJudgePricing.input +
          (judgeOutputTokens / 1_000_000) * primaryJudgePricing.output

    return {
      totalUsd: modelUsd + judgeUsd,
      modelUsd,
      judgeUsd,
      modelInputTokens: aggregateModelInputTokens,
      modelOutputTokens: aggregateModelOutputTokens,
      judgeInputTokens,
      judgeOutputTokens,
    }
  }, [
    scenarioCount,
    selectedJudgeStrategy,
    selectedModels,
    selectedPrimaryJudgeModel,
    selectedReplicates,
    selectedSecondaryJudgeModel,
    selectedTiebreakerJudgeModel,
  ])

  const formatUsd = (value: number) => `$${value.toFixed(2)}`
  const formatTokens = (value: number) => value.toLocaleString("en-US")

  const runCommand = useMemo(() => {
    if (selectedModels.length === 0) return "Select at least one model."
    if (selectedModules.length === 0) return "Select at least one module."

    const moduleArg = allModulesSelected ? "both" : selectedModules.join(",")
    const modelsArg = selectedModels.join(",")
    const levelsArg = FIXED_ESCALATION_LEVELS.join(",")
    const judgeArgs =
      selectedJudgeStrategy === "pair-with-tiebreak"
        ? `--judge-strategy=pair-with-tiebreak --judge-models=${[
            selectedPrimaryJudgeModel,
            selectedSecondaryJudgeModel,
            selectedTiebreakerJudgeModel,
          ].join(",")}`
        : `--judge-strategy=single --judge-model=${selectedPrimaryJudgeModel}`
    const providerPrecisionArg =
      selectedProviderPrecision === "default"
        ? ""
        : ` --provider-precision=${selectedProviderPrecision}`
    const commonArgs =
      `--module=${moduleArg} --models=${modelsArg} --levels=${levelsArg} ${judgeArgs} ` +
      `--transport=chat-first-fallback --replicates=${selectedReplicates}${providerPrecisionArg}`

    if (selectedConversationMode === "stateless") {
      return `pnpm bench:run-isolated ${commonArgs}`
    }

    return `pnpm bench:run ${commonArgs} --conversation-mode=stateful`
  }, [
    selectedConversationMode,
    allModulesSelected,
    selectedJudgeStrategy,
    selectedModels,
    selectedModules,
    selectedPrimaryJudgeModel,
    selectedProviderPrecision,
    selectedReplicates,
    selectedSecondaryJudgeModel,
    selectedTiebreakerJudgeModel,
  ])

  const pairJudgeOptionGuards = {
    primary: new Set([selectedSecondaryJudgeModel, selectedTiebreakerJudgeModel]),
    secondary: new Set([selectedPrimaryJudgeModel, selectedTiebreakerJudgeModel]),
    tiebreaker: new Set([selectedPrimaryJudgeModel, selectedSecondaryJudgeModel]),
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="border-border bg-card p-6">
        <div className="mb-6">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
            Local Benchmark Runner
          </h2>
        </div>

        <div className="mb-6">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Runs Per Tuple
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setReplicateMode("standard")}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                replicateMode === "standard"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              3 Runs (Default)
            </button>
            <button
              onClick={() => setReplicateMode("custom")}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                replicateMode === "custom"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom
            </button>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={customReplicateInput}
              onChange={(event) => setCustomReplicateInput(event.target.value)}
              disabled={replicateMode !== "custom"}
              className="w-28 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Custom replicate count"
            />
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            The standard benchmark profile runs each scenario, level, and model combination{" "}
            <span className="text-foreground">3 times</span>. Switch to custom if you want a different replicate count.
          </p>
          {replicateMode === "custom" && !hasValidCustomReplicates && (
            <p className="mt-2 font-mono text-[10px] text-red-400">Enter a whole number greater than 0.</p>
          )}
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center gap-3">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Modules ({selectedModules.length} selected)
            </label>
            <button
              onClick={allModulesSelected ? () => setSelectedModules([]) : selectAllModules}
              className="rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              {allModulesSelected ? "Clear All" : "Select All"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {moduleOptions.map((moduleOption) => (
              <button
                key={moduleOption.id}
                onClick={() => toggleModule(moduleOption.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                  selectedModules.includes(moduleOption.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {moduleOption.label}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Choose any subset of modules for a smaller test run, or keep all modules selected for the full benchmark.
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Prompt History
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { id: "stateful" as const, label: "Stateful Run" },
              { id: "stateless" as const, label: "Stateless Run" },
            ]).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelectedConversationMode(mode.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                  selectedConversationMode === mode.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {selectedConversationMode === "stateful"
              ? "Each scenario-model pair is evaluated as one continuous interaction across escalation levels, preserving conversational state and allowing prior turns to condition later behavior."
              : "Each escalation level is evaluated as an independent trial with fresh context, isolating level-specific behavior and reducing history-induced carryover effects."}
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Judge Strategy
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { id: "pair-with-tiebreak" as const, label: "Primary + Secondary + Tiebreaker" },
              { id: "single" as const, label: "Single Judge" },
            ]).map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedJudgeStrategy(strategy.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                  selectedJudgeStrategy === strategy.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {strategy.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Judges
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {selectedJudgeStrategy === "single" ? "Judge" : "Primary Judge"}
              </p>
              <Select value={selectedPrimaryJudgeModel} onValueChange={setSelectedPrimaryJudgeModel}>
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue placeholder="Select a judge" />
                </SelectTrigger>
                <SelectContent>
                  {JUDGE_MODEL_OPTIONS.map((judgeOption) => (
                    <SelectItem
                      className={JUDGE_SELECT_ITEM_CLASSNAME}
                      key={judgeOption.id}
                      value={judgeOption.id}
                      disabled={
                        selectedJudgeStrategy === "pair-with-tiebreak" &&
                        pairJudgeOptionGuards.primary.has(judgeOption.id)
                      }
                    >
                      <span className="opacity-50">{judgeOption.provider}/</span>
                      {judgeOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedJudgeStrategy === "pair-with-tiebreak" && (
              <>
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Secondary Judge
                  </p>
                  <Select value={selectedSecondaryJudgeModel} onValueChange={setSelectedSecondaryJudgeModel}>
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue placeholder="Select a secondary judge" />
                    </SelectTrigger>
                    <SelectContent>
                      {JUDGE_MODEL_OPTIONS.map((judgeOption) => (
                        <SelectItem
                          className={JUDGE_SELECT_ITEM_CLASSNAME}
                          key={judgeOption.id}
                          value={judgeOption.id}
                          disabled={pairJudgeOptionGuards.secondary.has(judgeOption.id)}
                        >
                          <span className="opacity-50">{judgeOption.provider}/</span>
                          {judgeOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Tiebreaker Judge
                  </p>
                  <Select value={selectedTiebreakerJudgeModel} onValueChange={setSelectedTiebreakerJudgeModel}>
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue placeholder="Select a tiebreaker judge" />
                    </SelectTrigger>
                    <SelectContent>
                      {JUDGE_MODEL_OPTIONS.map((judgeOption) => (
                        <SelectItem
                          className={JUDGE_SELECT_ITEM_CLASSNAME}
                          key={judgeOption.id}
                          value={judgeOption.id}
                          disabled={pairJudgeOptionGuards.tiebreaker.has(judgeOption.id)}
                        >
                          <span className="opacity-50">{judgeOption.provider}/</span>
                          {judgeOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Provider Precision
          </label>
          <div className="flex flex-wrap gap-2">
            {(["default", "non-quantized-only"] as ProviderPrecisionPolicy[]).map((policy) => (
              <button
                key={policy}
                onClick={() => setSelectedProviderPrecision(policy)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors ${
                  selectedProviderPrecision === policy
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {policy}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Only affects open-weight OpenRouter calls. <span className="text-foreground">non-quantized-only</span>{" "}
            prefers FP16, BF16, or FP32 providers and fails fast when none match.
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center gap-3">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Models ({selectedModels.length} selected)
            </label>
            <button
              onClick={allModelsSelected ? deselectAllModels : selectAllModels}
              className="rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              {allModelsSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {modelsByProvider.map(([provider, models]) => (
              <div key={provider}>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  {provider}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                        selectedModels.includes(model.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="mr-1 opacity-50">{provider}/</span>
                      {model.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <p className="font-mono text-xs font-bold uppercase">Generated Command</p>
          </div>
          <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">{runCommand}</code>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
          <p className="mb-2 font-mono text-xs font-bold uppercase">Estimated Cost (USD)</p>
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
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            Estimate uses static per-1M token pricing synced from {ESTIMATED_PRICING_SOURCE_LABEL} on{" "}
            {ESTIMATED_PRICING_LAST_SYNC_DATE}, plus level-based token assumptions and the selected{" "}
            {selectedReplicates}x replicate setting. In three-judge mode it assumes the tiebreaker runs on every
            prompt.
          </p>
        </div>
      </Card>

      <Card className="border-border bg-card p-6">
        <h3 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-foreground">Run Steps</h3>
        <ol className="list-decimal space-y-2 pl-4 font-mono text-xs text-muted-foreground">
          <li>Put your key in `.env.local` as `OPENROUTER_API_KEY=...`.</li>
          <li>Run the generated command from your terminal.</li>
          <li>
            Optional: publish a specific run as latest with <code>pnpm bench:publish --run-id=&lt;run-id&gt;</code>.
          </li>
        </ol>
        <p className="mt-4 font-mono text-[10px] uppercase text-muted-foreground">
          Selected workload: {scenarioCount} scenarios x {FIXED_ESCALATION_LEVELS.length} levels x{" "}
          {selectedModels.length} models x {selectedReplicates} replicates = {totalPrompts} prompts
        </p>
      </Card>

    </div>
  )
}
