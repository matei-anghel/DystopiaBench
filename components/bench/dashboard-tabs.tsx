"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"

function ChartPanelLoading() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Loading chart panel...
      </p>
    </div>
  )
}

const AggregateCharts = dynamic(
  () => import("@/components/bench/charts/aggregate-charts").then((mod) => mod.AggregateCharts),
  { ssr: false, loading: ChartPanelLoading },
)

const ModuleCharts = dynamic(
  () => import("@/components/bench/charts/module-charts").then((mod) => mod.ModuleCharts),
  { ssr: false, loading: ChartPanelLoading },
)

const ScenarioCharts = dynamic(
  () => import("@/components/bench/charts/scenario-charts").then((mod) => mod.ScenarioCharts),
  { ssr: false, loading: ChartPanelLoading },
)

const PromptCharts = dynamic(
  () => import("@/components/bench/charts/prompt-charts").then((mod) => mod.PromptCharts),
  { ssr: false, loading: ChartPanelLoading },
)

const RESULT_TABS = [
  { id: "aggregate", label: "Aggregate", sub: "All models - Both modules" },
  { id: "petrov", label: "Petrov", sub: "Infrastructure - Weapons - Safety Override" },
  { id: "orwell", label: "Orwell", sub: "Surveillance - Population Control - Censorship" },
  { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
  { id: "prompt", label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
  { id: "prompt_no_escalation", label: "Per Prompt (No Escalation)", sub: "L1-L5 isolated prompts - Deep dive" },
] as const

type TabId = (typeof RESULT_TABS)[number]["id"]

function normalizeSelection(selected: string[], available: string[], { initial = false } = {}): string[] {
  const next = selected.filter((id) => available.includes(id))
  if (initial && next.length === 0) return available
  return next
}

interface DashboardTabsProps {
  statefulResults: BenchmarkResult[]
  isolatedResults: BenchmarkResult[]
}

export function DashboardTabs({
  statefulResults,
  isolatedResults,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("aggregate")
  const [hasInteracted, setHasInteracted] = useState(false)
  const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])

  const availableModelIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of statefulResults) ids.add(row.modelId)
    for (const row of isolatedResults) ids.add(row.modelId)
    return [...ids]
  }, [statefulResults, isolatedResults])

  const selectedModelIds = useMemo(
    () => normalizeSelection(rawSelectedModelIds, availableModelIds, { initial: !hasInteracted }),
    [availableModelIds, rawSelectedModelIds, hasInteracted],
  )

  const selectedSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds])
  const filteredStatefulResults = useMemo(
    () => statefulResults.filter((row) => selectedSet.has(row.modelId)),
    [selectedSet, statefulResults],
  )
  const filteredIsolatedResults = useMemo(
    () => isolatedResults.filter((row) => selectedSet.has(row.modelId)),
    [isolatedResults, selectedSet],
  )

  const activeResults = activeTab === "prompt_no_escalation" ? filteredIsolatedResults : filteredStatefulResults
  const scenarioCount = new Set(activeResults.map((r) => r.scenarioId)).size

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

  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
            Benchmark Results
          </p>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            {activeResults.length.toLocaleString()} tests - {selectedModelIds.length}/{availableModelIds.length} models - {scenarioCount} scenarios
          </p>
        </div>
      </div>

      <ModelVisibilityControls
        modelIds={availableModelIds}
        selectedModelIds={selectedModelIds}
        onToggleModel={toggleModel}
        onToggleAll={toggleAll}
      />

      <div className="mb-8 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
        {RESULT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex w-full min-w-0 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${activeTab === tab.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              }`}
          >
            <span className="font-mono text-xs font-bold tracking-wide uppercase">
              {tab.label}
            </span>
            <span className={`mt-0.5 font-mono text-[9px] leading-relaxed ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"}`}>
              {tab.sub}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "aggregate" && <AggregateCharts results={filteredStatefulResults} />}
      {activeTab === "petrov" && <ModuleCharts module="petrov" results={filteredStatefulResults} selectedModelIds={selectedModelIds} />}
      {activeTab === "orwell" && <ModuleCharts module="orwell" results={filteredStatefulResults} selectedModelIds={selectedModelIds} />}
      {activeTab === "scenario" && <ScenarioCharts results={filteredStatefulResults} selectedModelIds={selectedModelIds} />}
      {activeTab === "prompt" && (
        <PromptCharts
          results={filteredStatefulResults}
          selectedModelIds={selectedModelIds}
          viewMode="stateful"
        />
      )}
      {activeTab === "prompt_no_escalation" && (
        filteredIsolatedResults.length > 0 ? (
          <PromptCharts
            results={filteredIsolatedResults}
            selectedModelIds={selectedModelIds}
            viewMode="stateless"
          />
        ) : (
          <Card className="bg-card border-border p-6">
            <p className="font-mono text-xs text-muted-foreground uppercase mb-3">
              No isolated run data found.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase">Command</p>
            <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">
              pnpm bench:run-isolated --module=both
            </code>
          </Card>
        )
      )}
    </>
  )
}
