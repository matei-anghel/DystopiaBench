"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { RunManifestV2 } from "@/lib/dystopiabench/schemas"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_MODULES, ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"

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

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

function normalizeSelection(selected: string[], available: string[], { initial = false } = {}): string[] {
  const next = selected.filter((id) => available.includes(id))
  if (initial && next.length === 0) return available
  return next
}

interface DashboardTabsProps {
  statefulResults: BenchmarkResult[]
  isolatedResults: BenchmarkResult[]
  statefulManifest?: RunManifestV2 | null
  isolatedManifest?: RunManifestV2 | null
}

export function DashboardTabs({
  statefulResults,
  isolatedResults,
  statefulManifest,
  isolatedManifest,
}: DashboardTabsProps) {
  const moduleTabs = useMemo(
    () => ALL_MODULES.map((module) => ({
      id: String(module.id),
      moduleId: module.id,
      label: getModuleDisplayLabel(module.label),
      sub: `${module.scenarios.length} scenarios - charts + heatmap`,
    })),
    [],
  )
  const resultTabs = useMemo(
    () => [
      { id: "aggregate", label: "Aggregate", sub: `All models - ${ALL_MODULES.length} modules` },
      ...moduleTabs.map(({ id, label, sub }) => ({ id, label, sub })),
      { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
      { id: "prompt", label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
      { id: "prompt_no_escalation", label: "Per Prompt (No Escalation)", sub: "L1-L5 isolated prompts - Deep dive" },
    ],
    [moduleTabs],
  )

  const [activeTab, setActiveTab] = useState<string>("aggregate")
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
  const scenarioCount = new Set(activeResults.map((row) => row.scenarioId)).size
  const activeManifest = activeTab === "prompt_no_escalation" ? isolatedManifest : statefulManifest

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
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
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

      {activeManifest ? (
        <div className="mb-8 grid gap-4 lg:grid-cols-4">
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bundle</p>
            <p className="mt-2 font-mono text-sm text-foreground">
              {activeManifest.metadata.benchmarkDefinition?.benchmarkBundleId ?? "unknown"}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Tier {activeManifest.metadata.benchmarkDefinition?.releaseTier ?? "core-public"}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Risk Slices</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              L1-L2 {activeManifest.summary.riskSlices?.l1L2AverageDcs ?? "n/a"} / L3-L5 {activeManifest.summary.riskSlices?.l3L5AverageDcs ?? "n/a"}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Reliable {activeManifest.summary.riskSlices?.reliabilityAdjustedAverageDcs ?? "n/a"}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Experiment</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              {activeManifest.metadata.experimentId ?? "not set"}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Replicates {activeManifest.metadata.replicates ?? 1}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Aux Labels</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              Coverage {activeManifest.summary.auxiliaryLabelCoverage?.rowCoverageRate ?? 0}%
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Harm-aware {activeManifest.summary.auxiliaryLabelCoverage?.harmAwarenessRate ?? 0}%
            </p>
          </Card>
        </div>
      ) : null}

      <div className="mb-8 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
        {resultTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex w-full min-w-0 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${activeTab === tab.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
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
      {moduleTabs.map((tab) => (
        activeTab === tab.id ? (
          <ModuleCharts
            key={tab.id}
            module={tab.moduleId}
            results={filteredStatefulResults}
            selectedModelIds={selectedModelIds}
          />
        ) : null
      ))}
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
            <p className="mb-3 font-mono text-xs text-muted-foreground uppercase">
              No isolated run data found.
            </p>
            <p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase">Command</p>
            <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">
              pnpm bench:run-isolated --module=both
            </code>
          </Card>
        )
      )}
    </>
  )
}
