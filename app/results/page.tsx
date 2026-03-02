"use client"

import { useMemo, useState } from "react"
import { BenchHeader } from "@/components/bench/header"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { useBenchmarkData } from "@/hooks/use-benchmark-data"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { Database } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const TABS = [
  { id: "aggregate", label: "Aggregate", sub: "All models - Both modules" },
  { id: "petrov", label: "Petrov", sub: "Infrastructure - Weapons - Safety Override" },
  { id: "orwell", label: "Orwell", sub: "Surveillance - Population Control - Censorship" },
  { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
  { id: "prompt", label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
] as const

type TabId = (typeof TABS)[number]["id"]

function normalizeSelection(selected: string[], available: string[], { initial = false } = {}): string[] {
  const next = selected.filter((id) => available.includes(id))
  if (initial && next.length === 0) return available
  return next
}

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("aggregate")
  const { results, runs, selectedRunId, setSelectedRunId, manifest } = useBenchmarkData()
  const availableModelIds = useMemo(
    () => AVAILABLE_MODELS.map((model) => model.id).filter((id) => results.some((row) => row.modelId === id)),
    [results],
  )
  const [hasInteracted, setHasInteracted] = useState(false)
  const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])
  const selectedModelIds = useMemo(
    () => normalizeSelection(rawSelectedModelIds, availableModelIds, { initial: !hasInteracted }),
    [availableModelIds, rawSelectedModelIds, hasInteracted],
  )

  const filteredResults = useMemo(() => {
    const selectedSet = new Set(selectedModelIds)
    return results.filter((row) => selectedSet.has(row.modelId))
  }, [results, selectedModelIds])

  const modelCount = selectedModelIds.length
  const scenarioCount = new Set(filteredResults.map((r) => r.scenarioId)).size

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
      if (next.length === availableModelIds.length) {
        return []
      }
      return availableModelIds
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-10 2xl:max-w-[1760px]">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
                Benchmark Results
              </h1>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {filteredResults.length.toLocaleString()} tests - {modelCount}/{availableModelIds.length} models - {scenarioCount} scenarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedRunId} onValueChange={(value) => void setSelectedRunId(value)}>
              <SelectTrigger className="w-[240px] h-8 text-xs font-mono">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest Run</SelectItem>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {new Date(run.timestamp).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {manifest ? (
          <p className="font-mono text-[10px] text-muted-foreground mb-6 uppercase">
            Run {manifest.runId} - judge {manifest.metadata.judgeModel} - avg DCS {manifest.summary.averageDcs}
          </p>
        ) : null}

        <ModelVisibilityControls
          modelIds={availableModelIds}
          selectedModelIds={selectedModelIds}
          onToggleModel={toggleModel}
          onToggleAll={toggleAll}
        />

        <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex flex-col items-start rounded-md border px-4 py-2.5 transition-colors ${activeTab === tab.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                }`}
            >
              <span className="font-mono text-xs font-bold tracking-wide uppercase">{tab.label}</span>
              <span
                className={`font-mono text-[9px] mt-0.5 ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
                  }`}
              >
                {tab.sub}
              </span>
            </button>
          ))}
        </div>

        {activeTab === "aggregate" && <AggregateCharts results={filteredResults} />}
        {activeTab === "petrov" && <ModuleCharts module="petrov" results={filteredResults} selectedModelIds={selectedModelIds} />}
        {activeTab === "orwell" && <ModuleCharts module="orwell" results={filteredResults} selectedModelIds={selectedModelIds} />}
        {activeTab === "scenario" && <ScenarioCharts results={filteredResults} selectedModelIds={selectedModelIds} />}
        {activeTab === "prompt" && <PromptCharts results={filteredResults} selectedModelIds={selectedModelIds} />}

        <footer className="mt-14 border-t border-border pt-6 pb-8">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground text-center uppercase">
            {manifest
              ? `DystopiaBench - Schema v${manifest.schemaVersion} - Prompt set ${manifest.metadata.benchmarkPromptVersion} - Research use only`
              : "DystopiaBench - Research use only"}
          </p>
        </footer>
      </main>
    </div>
  )
}
