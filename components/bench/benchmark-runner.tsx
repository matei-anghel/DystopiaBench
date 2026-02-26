"use client"

import { useState, useCallback } from "react"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { ALL_SCENARIOS, PETROV_SCENARIOS, ORWELL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type {
  Module,
  EscalationLevel,
  ScenarioResult,
  ComplianceRating,
  BenchmarkRun,
} from "@/lib/dystopiabench/types"
import { COMPLIANCE_LABELS, COMPLIANCE_SCORES } from "@/lib/dystopiabench/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

type RunStatus = "idle" | "running" | "completed" | "failed"

interface RunResult {
  scenarioId: string
  scenarioTitle: string
  modelId: string
  modelLabel: string
  level: EscalationLevel
  response: string
  compliance: ComplianceRating
  score: number
}

export function BenchmarkRunner() {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | "both">("both")
  const [selectedLevels, setSelectedLevels] = useState<EscalationLevel[]>([1, 2, 3, 4, 5])
  const [status, setStatus] = useState<RunStatus>("idle")
  const [results, setResults] = useState<RunResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" })
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const toggleLevel = (level: EscalationLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level].sort()
    )
  }

  const toggleResultExpand = (key: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const getScenarios = () => {
    if (selectedModule === "petrov") return PETROV_SCENARIOS
    if (selectedModule === "orwell") return ORWELL_SCENARIOS
    return ALL_SCENARIOS
  }

  const runBenchmark = useCallback(async () => {
    const scenarios = getScenarios()
    const models = AVAILABLE_MODELS.filter((m) => selectedModels.includes(m.id))

    if (models.length === 0 || selectedLevels.length === 0) return

    const controller = new AbortController()
    setAbortController(controller)
    setStatus("running")
    setResults([])

    const totalRuns = scenarios.length * models.length * selectedLevels.length
    setProgress({ current: 0, total: totalRuns, label: "Starting..." })

    let current = 0

    try {
      for (const scenario of scenarios) {
        for (const model of models) {
          for (const level of selectedLevels) {
            if (controller.signal.aborted) throw new Error("Aborted")

            const prompt = scenario.escalationPrompts.find((p) => p.level === level)
            if (!prompt) continue

            setProgress({
              current,
              total: totalRuns,
              label: `${model.label} / ${scenario.id} / L${level}`,
            })

            try {
              const res = await fetch("/api/bench", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  modelString: model.modelString,
                  prompt: prompt.prompt,
                  scenarioId: scenario.id,
                }),
                signal: controller.signal,
              })

              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
                setResults((prev) => [
                  ...prev,
                  {
                    scenarioId: scenario.id,
                    scenarioTitle: scenario.title,
                    modelId: model.id,
                    modelLabel: model.label,
                    level,
                    response: `Error: ${errorData.error || res.statusText}`,
                    compliance: "full_refusal" as ComplianceRating,
                    score: 0,
                  },
                ])
              } else {
                const data = await res.json()
                setResults((prev) => [
                  ...prev,
                  {
                    scenarioId: scenario.id,
                    scenarioTitle: scenario.title,
                    modelId: model.id,
                    modelLabel: model.label,
                    level,
                    response: data.response,
                    compliance: data.compliance,
                    score: COMPLIANCE_SCORES[data.compliance as ComplianceRating] ?? 0,
                  },
                ])
              }
            } catch (err: unknown) {
              if (err instanceof Error && err.name === "AbortError") throw err
              setResults((prev) => [
                ...prev,
                {
                  scenarioId: scenario.id,
                  scenarioTitle: scenario.title,
                  modelId: model.id,
                  modelLabel: model.label,
                  level,
                  response: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
                  compliance: "full_refusal" as ComplianceRating,
                  score: 0,
                },
              ])
            }

            current++
            setProgress({
              current,
              total: totalRuns,
              label: `${model.label} / ${scenario.id} / L${level}`,
            })
          }
        }
      }

      setStatus("completed")
    } catch {
      setStatus("failed")
    } finally {
      setAbortController(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModels, selectedModule, selectedLevels])

  const stopBenchmark = () => {
    abortController?.abort()
    setStatus("failed")
  }

  const complianceColor = (c: ComplianceRating) => {
    switch (c) {
      case "full_refusal": return "text-accent"
      case "soft_refusal": return "text-chart-2"
      case "partial_compliance": return "text-warning"
      case "soft_compliance": return "text-primary"
      case "full_compliance": return "text-destructive"
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Control Panel */}
      <Card className="bg-card border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-sm font-bold tracking-wider text-foreground uppercase">
            Benchmark Configuration
          </h2>
        </div>

        {/* Module Selection */}
        <div className="mb-6">
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block">
            Module
          </label>
          <div className="flex gap-2">
            {(["both", "petrov", "orwell"] as const).map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors uppercase ${
                  selectedModule === mod
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {mod === "both" ? "Both Modules" : `${mod} Module`}
              </button>
            ))}
          </div>
        </div>

        {/* Escalation Levels */}
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

        {/* Model Selection */}
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

        {/* Run Controls */}
        <div className="flex items-center gap-4">
          {status === "running" ? (
            <Button
              onClick={stopBenchmark}
              variant="destructive"
              className="font-mono text-xs tracking-wider uppercase gap-2"
            >
              <Square className="h-3 w-3" />
              Abort
            </Button>
          ) : (
            <Button
              onClick={runBenchmark}
              disabled={selectedModels.length === 0 || selectedLevels.length === 0}
              className="font-mono text-xs tracking-wider uppercase gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-3 w-3" />
              Run Benchmark
            </Button>
          )}
          {status !== "idle" && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {progress.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <Progress
                value={(progress.current / Math.max(progress.total, 1)) * 100}
              />
            </div>
          )}
          {status === "completed" && (
            <div className="flex items-center gap-1 text-accent">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-mono text-xs">Complete</span>
            </div>
          )}
          {status === "failed" && (
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-mono text-xs">Stopped</span>
            </div>
          )}
        </div>
      </Card>

      {/* Live Results */}
      {results.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">
              Results ({results.length})
            </h3>
            {status === "running" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
          </div>
          <ScrollArea className="max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-border">
              {results.map((r, i) => {
                const key = `${r.scenarioId}-${r.modelId}-${r.level}-${i}`
                const isExpanded = expandedResults.has(key)

                return (
                  <div key={key} className="p-4">
                    <button
                      onClick={() => toggleResultExpand(key)}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-20">
                          {r.scenarioId}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {r.modelLabel}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          L{r.level}
                        </span>
                        <span className={`font-mono text-[10px] font-bold ${complianceColor(r.compliance)}`}>
                          {COMPLIANCE_LABELS[r.compliance]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-mono text-sm font-bold ${complianceColor(r.compliance)}`}>
                          {r.score}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 rounded-md bg-muted/50 p-3">
                        <p className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                          Model Response
                        </p>
                        <p className="text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
                          {r.response}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  )
}
