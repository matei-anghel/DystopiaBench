"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { RunManifestV2 } from "@/lib/dystopiabench/schemas"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_MODULES, ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type { RunIndexItem } from "@/lib/dystopiabench/load-results"
import { getAvailablePromptLocales } from "@/lib/dystopiabench/analytics"
import { getLocaleLabel } from "@/lib/dystopiabench/locales"

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

const LanguageCharts = dynamic(
  () => import("@/components/bench/charts/language-charts").then((mod) => mod.LanguageCharts),
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

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "n/a"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a"
  return `$${value.toFixed(4)}`
}

function formatCount(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a"
  return value.toLocaleString("en-US")
}

interface DashboardTabsProps {
  statefulRuns?: RunIndexItem[]
  selectedStatefulRunId?: "latest" | string
  onSelectStatefulRunId?: (runId: "latest" | string) => Promise<void>
  statefulResults: BenchmarkResult[]
  isolatedResults: BenchmarkResult[]
  statefulManifest?: RunManifestV2 | null
  isolatedManifest?: RunManifestV2 | null
}

export function DashboardTabs({
  statefulRuns = [],
  selectedStatefulRunId = "latest",
  onSelectStatefulRunId,
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
      { id: "languages", label: "Languages", sub: "Cross-language leaderboard + module matrix" },
      { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
      { id: "prompt", label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
      { id: "prompt_no_escalation", label: "Per Prompt (No Escalation)", sub: "L1-L5 isolated prompts - Deep dive" },
    ],
    [moduleTabs],
  )

  const [activeTab, setActiveTab] = useState<string>("aggregate")
  const [hasModelInteracted, setHasModelInteracted] = useState(false)
  const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])
  const [hasLocaleInteracted, setHasLocaleInteracted] = useState(false)
  const [rawSelectedLocales, setRawSelectedLocales] = useState<string[]>([])

  const availableModelIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of statefulResults) ids.add(row.modelId)
    for (const row of isolatedResults) ids.add(row.modelId)
    return [...ids]
  }, [statefulResults, isolatedResults])

  const selectedModelIds = useMemo(
    () => normalizeSelection(rawSelectedModelIds, availableModelIds, { initial: !hasModelInteracted }),
    [availableModelIds, rawSelectedModelIds, hasModelInteracted],
  )

  const availableLocales = useMemo(
    () => getAvailablePromptLocales([...statefulResults, ...isolatedResults]),
    [isolatedResults, statefulResults],
  )

  const selectedLocales = useMemo(
    () => normalizeSelection(rawSelectedLocales, availableLocales, { initial: !hasLocaleInteracted }),
    [availableLocales, rawSelectedLocales, hasLocaleInteracted],
  )

  const selectedModelSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds])
  const selectedLocaleSet = useMemo(() => new Set(selectedLocales), [selectedLocales])

  const filteredStatefulResults = useMemo(
    () =>
      statefulResults.filter(
        (row) =>
          selectedModelSet.has(row.modelId) &&
          selectedLocaleSet.has(row.promptLocale ?? "en"),
      ),
    [selectedLocaleSet, selectedModelSet, statefulResults],
  )
  const filteredIsolatedResults = useMemo(
    () =>
      isolatedResults.filter(
        (row) =>
          selectedModelSet.has(row.modelId) &&
          selectedLocaleSet.has(row.promptLocale ?? "en"),
      ),
    [isolatedResults, selectedLocaleSet, selectedModelSet],
  )

  const activeResults = activeTab === "prompt_no_escalation" ? filteredIsolatedResults : filteredStatefulResults
  const scenarioCount = new Set(activeResults.map((row) => row.canonicalScenarioId ?? row.scenarioId)).size
  const activeManifest = activeTab === "prompt_no_escalation" ? isolatedManifest : statefulManifest

  const toggleModel = (modelId: string) => {
    setHasModelInteracted(true)
    setRawSelectedModelIds((current) => {
      const next = normalizeSelection(current, availableModelIds, { initial: !hasModelInteracted })
      if (!next.includes(modelId)) return [...next, modelId]
      return next.filter((id) => id !== modelId)
    })
  }

  const toggleAllModels = () => {
    setHasModelInteracted(true)
    setRawSelectedModelIds((current) => {
      const next = normalizeSelection(current, availableModelIds, { initial: !hasModelInteracted })
      if (next.length === availableModelIds.length) return []
      return availableModelIds
    })
  }

  const toggleLocale = (locale: string) => {
    setHasLocaleInteracted(true)
    setRawSelectedLocales((current) => {
      const next = normalizeSelection(current, availableLocales, { initial: !hasLocaleInteracted })
      if (!next.includes(locale)) return [...next, locale]
      return next.filter((value) => value !== locale)
    })
  }

  const toggleAllLocales = () => {
    setHasLocaleInteracted(true)
    setRawSelectedLocales((current) => {
      const next = normalizeSelection(current, availableLocales, { initial: !hasLocaleInteracted })
      if (next.length === availableLocales.length) return []
      return availableLocales
    })
  }

  const runGroups = useMemo(() => {
    const grouped = new Map<string, RunIndexItem[]>()
    for (const run of statefulRuns) {
      const key = run.metadata.experimentId ?? "Ungrouped"
      const rows = grouped.get(key)
      if (rows) {
        rows.push(run)
      } else {
        grouped.set(key, [run])
      }
    }
    return [...grouped.entries()]
  }, [statefulRuns])

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
            {activeResults.length.toLocaleString()} tests - {selectedModelIds.length}/{availableModelIds.length} models - {selectedLocales.length}/{availableLocales.length} locales - {scenarioCount} scenarios
          </p>
        </div>
      </div>

      {onSelectStatefulRunId ? (
        <div className="mb-6 grid gap-2">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Stateful Run
          </label>
          <select
            value={selectedStatefulRunId}
            onChange={(event) => void onSelectStatefulRunId(event.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground"
          >
            <option value="latest">Latest published stateful run</option>
            {runGroups.map(([group, runs]) => (
              <optgroup key={group} label={group}>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.id} • {(run.metadata.promptLocale ?? "en").toUpperCase()} • {run.date}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}

      <ModelVisibilityControls
        modelIds={availableModelIds}
        selectedModelIds={selectedModelIds}
        onToggleModel={toggleModel}
        onToggleAll={toggleAllModels}
      />

      {availableLocales.length > 0 ? (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Prompt Locales
            </p>
            <button
              onClick={toggleAllLocales}
              className="font-mono text-[10px] uppercase tracking-widest text-primary"
            >
              {selectedLocales.length === availableLocales.length ? "Clear" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableLocales.map((locale) => {
              const active = selectedLocaleSet.has(locale)
              return (
                <button
                  key={locale}
                  onClick={() => toggleLocale(locale)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-widest">{locale}</span>
                  <span className="block text-xs">{getLocaleLabel(locale)}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {activeManifest ? (
        <div className="mb-8 grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Locale</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              {(activeManifest.metadata.promptLocale ?? "en").toUpperCase()} • {getLocaleLabel(activeManifest.metadata.promptLocale ?? "en")}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Source {(activeManifest.metadata.sourceLocale ?? "en").toUpperCase()}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Runtime</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              Wall {formatDuration(activeManifest.summary.telemetry?.wallClockMs)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Calls {formatDuration(activeManifest.summary.telemetry?.overall.durationMs)}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cost</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              Total {formatUsd(activeManifest.summary.telemetry?.overall.costUsd)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Bench {formatUsd(activeManifest.summary.telemetry?.benchmark.costUsd)} / Judge {formatUsd(activeManifest.summary.telemetry?.judging.costUsd)}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tokens</p>
            <p className="mt-2 font-mono text-xs text-foreground">
              In {formatCount(activeManifest.summary.telemetry?.overall.inputTokens)} / Out {formatCount(activeManifest.summary.telemetry?.overall.outputTokens)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              Reason {formatCount(activeManifest.summary.telemetry?.overall.reasoningTokens)} / Text {formatCount(activeManifest.summary.telemetry?.overall.nonReasoningOutputTokens)}
            </p>
          </Card>
        </div>
      ) : null}

      <div className="mb-8 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
        {resultTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex w-full min-w-0 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${
              activeTab === tab.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
            }`}
          >
            <span className="font-mono text-xs font-bold tracking-wide uppercase">
              {tab.label}
            </span>
            <span className={`mt-0.5 font-mono text-[9px] leading-relaxed ${
              activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
            }`}>
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
      {activeTab === "languages" && <LanguageCharts results={filteredStatefulResults} />}
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
