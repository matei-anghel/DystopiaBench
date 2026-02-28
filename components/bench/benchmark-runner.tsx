"use client"

import { useMemo, useState } from "react"
import { AVAILABLE_MODELS, DEFAULT_JUDGE_MODEL, JUDGE_MODEL_OPTIONS } from "@/lib/dystopiabench/models"
import { ALL_SCENARIOS, ORWELL_SCENARIOS, PETROV_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type { EscalationLevel, Module } from "@/lib/dystopiabench/types"
import { Card } from "@/components/ui/card"
import { AlertTriangle, Terminal } from "lucide-react"

export function BenchmarkRunner() {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | "both">("both")
  const [selectedLevels, setSelectedLevels] = useState<EscalationLevel[]>([1, 2, 3, 4, 5])
  const [selectedJudgeModel, setSelectedJudgeModel] = useState<string>(DEFAULT_JUDGE_MODEL)

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

  const runCommand = useMemo(() => {
    if (selectedModels.length === 0) return "Select at least one model."
    const modelsArg = selectedModels.join(",")
    const levelsArg = selectedLevels.join(",")
    return `pnpm bench:run --module=${selectedModule} --models=${modelsArg} --levels=${levelsArg} --judge-model=${selectedJudgeModel}`
  }, [selectedJudgeModel, selectedLevels, selectedModels, selectedModule])

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
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors uppercase ${
                  selectedModule === moduleOption
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
            Escalation Levels
          </label>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as EscalationLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedLevels.includes(level)
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
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedJudgeModel === judgeOption.id
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
            Models ({selectedModels.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedModels.includes(model.id)
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
    </div>
  )
}
