"use client"

import { useMemo, useState } from "react"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database } from "lucide-react"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import type { RunManifestV2 } from "@/lib/dystopiabench/schemas"
import type { RunIndexItem } from "@/lib/dystopiabench/load-results"

const BASE_RESULT_TABS = [
  { id: "aggregate", label: "Aggregate", sub: "All models - Both modules" },
  { id: "petrov", label: "Petrov", sub: "Infrastructure - Weapons - Safety Override" },
  { id: "orwell", label: "Orwell", sub: "Surveillance - Population Control - Censorship" },
  { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
] as const

type TabId = "aggregate" | "petrov" | "orwell" | "scenario" | "prompt"
type SelectedRunId = "latest" | string

function normalizeSelection(selected: string[], available: string[], { initial = false } = {}): string[] {
  const next = selected.filter((id) => available.includes(id))
  if (initial && next.length === 0) return available
  return next
}

interface ResultsModeSectionProps {
  title: string
  subtitle: string
  conversationMode: "stateful" | "stateless"
  runs: RunIndexItem[]
  selectedRunId: SelectedRunId
  onSelectRun: (runId: SelectedRunId) => Promise<void>
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
  loading: boolean
  loadError: string | null
  emptyCommand: string
}

export function ResultsModeSection({
  title,
  subtitle,
  conversationMode,
  runs,
  selectedRunId,
  onSelectRun,
  results,
  manifest,
  loading,
  loadError,
  emptyCommand,
}: ResultsModeSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>("aggregate")
  const [hasInteracted, setHasInteracted] = useState(false)
  const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])

  const availableModelIds = useMemo(
    () => AVAILABLE_MODELS.map((model) => model.id).filter((id) => results.some((row) => row.modelId === id)),
    [results],
  )
  const selectedModelIds = useMemo(
    () => normalizeSelection(rawSelectedModelIds, availableModelIds, { initial: !hasInteracted }),
    [availableModelIds, rawSelectedModelIds, hasInteracted],
  )
  const filteredResults = useMemo(() => {
    const selectedSet = new Set(selectedModelIds)
    return results.filter((row) => selectedSet.has(row.modelId))
  }, [results, selectedModelIds])
  const scenarioCount = new Set(filteredResults.map((row) => row.scenarioId)).size

  const toggleModel = (modelId: string) => {
    setHasInteracted(true)
    setRawSelectedModelIds((current) => {
      const next = normalizeSelection(current, availableModelIds, { initial: !hasInteracted })
      if (!next.includes(modelId)) return [...next, modelId]
      return next.filter((id) => id !== modelId)
    })
  }

  const toggleAll = () => {
    setHasInteracted(true)
    setRawSelectedModelIds((current) => {
      const next = normalizeSelection(current, availableModelIds, { initial: !hasInteracted })
      if (next.length === availableModelIds.length) return []
      return availableModelIds
    })
  }

  const hasResults = results.length > 0
  const runLabel = title.toLowerCase()
  const resultTabs = useMemo(
    () => [
      ...BASE_RESULT_TABS,
      conversationMode === "stateless"
        ? { id: "prompt" as const, label: "Per Prompt (No Escalation)", sub: "L1-L5 isolated prompts - Deep dive" }
        : { id: "prompt" as const, label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
    ],
    [conversationMode],
  )

  return (
    <section className="rounded-lg border border-border bg-card/30 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-mono text-lg font-black tracking-wider text-foreground uppercase">
              {title}
            </h2>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {subtitle}
            </p>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mt-1">
              {filteredResults.length.toLocaleString()} tests - {selectedModelIds.length}/{availableModelIds.length} models - {scenarioCount} scenarios
            </p>
          </div>
        </div>

        <Select value={selectedRunId} onValueChange={(value) => void onSelectRun(value)}>
          <SelectTrigger className="w-[280px] h-8 text-xs font-mono">
            <SelectValue placeholder="Select a run" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest {title}</SelectItem>
            {runs.map((run) => (
              <SelectItem key={run.id} value={run.id}>
                {new Date(run.timestamp).toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {manifest ? (
        <p className="font-mono text-[10px] text-muted-foreground mb-6 uppercase">
          Run {manifest.runId} - judge {manifest.metadata.judgeModel} - avg DCS {manifest.summary.averageDcs}
        </p>
      ) : null}

      {loading ? (
        <Card className="border-border bg-muted/20 p-6">
          <p className="font-mono text-xs text-muted-foreground uppercase">Loading {runLabel} results...</p>
        </Card>
      ) : null}

      {!loading && loadError ? (
        <Card className="border-border bg-muted/20 p-6">
          <p className="font-mono text-xs text-destructive uppercase">Failed to load run: {loadError}</p>
        </Card>
      ) : null}

      {!loading && !loadError && !hasResults ? (
        <Card className="border-border bg-muted/20 p-6">
          <p className="font-mono text-xs text-muted-foreground uppercase mb-3">
            No {runLabel} run data found.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase">Command</p>
          <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">{emptyCommand}</code>
        </Card>
      ) : null}

      {!loading && !loadError && hasResults ? (
        <>
          <ModelVisibilityControls
            modelIds={availableModelIds}
            selectedModelIds={selectedModelIds}
            onToggleModel={toggleModel}
            onToggleAll={toggleAll}
          />

          <div className="mb-8 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
            {resultTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full min-w-0 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${activeTab === tab.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                  }`}
              >
                <span className="font-mono text-xs font-bold tracking-wide uppercase">{tab.label}</span>
                <span className={`mt-0.5 font-mono text-[9px] leading-relaxed ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"}`}>
                  {tab.sub}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "aggregate" && <AggregateCharts results={filteredResults} />}
          {activeTab === "petrov" && <ModuleCharts module="petrov" results={filteredResults} selectedModelIds={selectedModelIds} />}
          {activeTab === "orwell" && <ModuleCharts module="orwell" results={filteredResults} selectedModelIds={selectedModelIds} />}
          {activeTab === "scenario" && <ScenarioCharts results={filteredResults} selectedModelIds={selectedModelIds} />}
          {activeTab === "prompt" && (
            <PromptCharts
              results={filteredResults}
              selectedModelIds={selectedModelIds}
              viewMode={conversationMode}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
