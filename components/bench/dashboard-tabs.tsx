"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { orderScenarioModulesForDisplay } from "@/lib/dystopiabench/module-display-order"
import { DEFAULT_DASHBOARD_MODEL_IDS } from "@/lib/dystopiabench/dashboard-model-selection"
import { getDisplayModels } from "@/lib/dystopiabench/display-models"

export type ResultVersion = "latest" | "v1"
export type DatasetStatus = "idle" | "loading" | "ready" | "error"

function ChartPanelLoading() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
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

const VERSION_LABELS: Record<ResultVersion, string> = {
  v1: "V1",
  latest: "Latest",
}

// Small datasets (e.g. the no-escalation ablation) show every model by default.
const SHOW_ALL_MODELS_LIMIT = 12

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

function getDefaultSelection(available: string[]): string[] {
  if (available.length <= SHOW_ALL_MODELS_LIMIT) return available
  const defaults = DEFAULT_DASHBOARD_MODEL_IDS.filter((id) => available.includes(id))
  return defaults.length > 0 ? defaults : available
}

function ResultsHeader({
  resultVersion,
  latestAvailable,
  onResultVersionChange,
}: {
  resultVersion: ResultVersion
  latestAvailable: boolean
  onResultVersionChange?: (version: ResultVersion) => void
}) {
  const versions: ResultVersion[] = latestAvailable ? ["latest", "v1"] : ["v1"]

  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
          <Database className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <h2 className="truncate font-mono text-lg font-black tracking-wider text-foreground uppercase sm:text-xl">
          Benchmark Results
        </h2>
      </div>
      {versions.length > 1 ? (
        <Select value={resultVersion} onValueChange={(value) => onResultVersionChange?.(value as ResultVersion)}>
          <SelectTrigger
            className="h-10 min-w-24 shrink-0 border-primary/20 bg-primary/5 font-mono text-xs font-bold tracking-wider uppercase"
            aria-label="Benchmark result version"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {versions.map((version) => (
              <SelectItem key={version} value={version} className="font-mono text-xs uppercase">
                {VERSION_LABELS[version]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="inline-flex h-10 shrink-0 items-center rounded-md border border-primary/20 bg-primary/5 px-3 font-mono text-xs font-bold tracking-wider text-foreground uppercase">
          {VERSION_LABELS[resultVersion]}<span className="hidden sm:inline">&nbsp;results</span>
        </span>
      )}
    </div>
  )
}

function StatusCard({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="border-border bg-card p-6" role="status">
      <p className="mb-3 font-mono text-xs text-foreground uppercase">{title}</p>
      {children ? <div className="text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
    </Card>
  )
}

const ACTION_BUTTON_CLASS =
  "rounded border border-border px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-muted-foreground/60 hover:bg-muted/50"

interface SelectionState {
  interacted: boolean
  ids: string[]
}

interface DashboardTabsProps {
  statefulStatus: DatasetStatus
  isolatedStatus: DatasetStatus
  statefulResults: BenchmarkResult[]
  isolatedResults: BenchmarkResult[]
  onRetry?: () => void
  onLoadIsolatedResults?: () => Promise<void>
  resultVersion: ResultVersion
  latestAvailable: boolean
  onResultVersionChange?: (version: ResultVersion) => void
}

export function DashboardTabs({
  statefulStatus,
  isolatedStatus,
  statefulResults,
  isolatedResults,
  onRetry,
  onLoadIsolatedResults,
  resultVersion,
  latestAvailable,
  onResultVersionChange,
}: DashboardTabsProps) {
  const legacyScoring = resultVersion === "v1"
  const moduleTabs = useMemo(
    () => orderScenarioModulesForDisplay(ALL_MODULES).map((module) => ({
      id: String(module.id),
      moduleId: module.id,
      label: getModuleDisplayLabel(module.label),
    })),
    [],
  )
  const resultTabs = useMemo(
    () => [
      { id: "aggregate", label: "Aggregate" },
      ...moduleTabs.map(({ id, label }) => ({ id, label })),
      { id: "scenario", label: "Per Scenario" },
      { id: "prompt", label: "Per Prompt" },
      { id: "prompt_no_escalation", label: "Per Prompt (No Escalation)" },
    ],
    [moduleTabs],
  )

  const [activeTab, setActiveTab] = useState<string>("aggregate")
  const [selections, setSelections] = useState<Record<string, SelectionState>>({})
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  const isolatedTab = activeTab === "prompt_no_escalation"
  // Each dataset (version x conversation mode) keeps its own model selection, so switching
  // version or opening the no-escalation ablation never leaves an empty, stale selection.
  const datasetKey = `${resultVersion}:${isolatedTab ? "stateless" : "stateful"}`
  const datasetResults = isolatedTab ? isolatedResults : statefulResults
  const datasetModels = useMemo(() => getDisplayModels(datasetResults), [datasetResults])
  const availableModelIds = useMemo(() => datasetModels.map((model) => model.id), [datasetModels])

  const selection = selections[datasetKey]
  const selectedModelIds = useMemo(() => {
    if (!selection?.interacted) return getDefaultSelection(availableModelIds)
    return selection.ids.filter((id) => availableModelIds.includes(id))
  }, [availableModelIds, selection])

  const selectedSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds])
  const selectedModels = useMemo(
    () => datasetModels.filter((model) => selectedSet.has(model.id)),
    [datasetModels, selectedSet],
  )
  const filteredResults = useMemo(
    () => datasetResults.filter((row) => selectedSet.has(row.modelId)),
    [datasetResults, selectedSet],
  )

  useEffect(() => {
    if (isolatedTab) {
      void onLoadIsolatedResults?.()
    }
  }, [isolatedTab, onLoadIsolatedResults])

  const setSelection = (ids: string[]) => {
    setSelections((current) => ({ ...current, [datasetKey]: { interacted: true, ids } }))
  }

  const toggleModel = (modelId: string) => {
    setSelection(
      selectedModelIds.includes(modelId)
        ? selectedModelIds.filter((id) => id !== modelId)
        : [...selectedModelIds, modelId],
    )
  }

  const toggleAll = () => {
    setSelection(selectedModelIds.length === availableModelIds.length ? [] : availableModelIds)
  }

  const resetSelection = () => {
    setSelections((current) => ({ ...current, [datasetKey]: { interacted: false, ids: [] } }))
  }

  const focusTab = (index: number) => {
    const tab = resultTabs[(index + resultTabs.length) % resultTabs.length]
    setActiveTab(tab.id)
    tabRefs.current.get(tab.id)?.focus()
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") focusTab(index + 1)
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") focusTab(index - 1)
    else if (event.key === "Home") focusTab(0)
    else if (event.key === "End") focusTab(resultTabs.length - 1)
    else return
    event.preventDefault()
  }

  const header = (
    <ResultsHeader
      resultVersion={resultVersion}
      latestAvailable={latestAvailable}
      onResultVersionChange={onResultVersionChange}
    />
  )

  if (statefulStatus === "idle" || statefulStatus === "loading") {
    return (
      <>
        {header}
        <StatusCard title={legacyScoring ? "Loading V1 benchmark results..." : "Loading the latest benchmark run..."}>
          {legacyScoring
            ? "Fetching the published V1 chart dataset (four-tier DCS scoring)."
            : "Reading the run index and fetching the latest published stateful run."}
        </StatusCard>
      </>
    )
  }

  if (statefulStatus === "error") {
    return (
      <>
        {header}
        <StatusCard title={`Could not load ${VERSION_LABELS[resultVersion]} results.`}>
          <p className="mb-3">The results file failed to download. Check your connection and try again.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRetry} className={ACTION_BUTTON_CLASS}>
              Retry
            </button>
            {resultVersion !== "v1" ? (
              <button type="button" onClick={() => onResultVersionChange?.("v1")} className={ACTION_BUTTON_CLASS}>
                Show V1 results
              </button>
            ) : null}
          </div>
        </StatusCard>
      </>
    )
  }

  if (statefulResults.length === 0) {
    return (
      <>
        {header}
        <StatusCard title="No results have been published for this version yet.">
          {resultVersion !== "v1" ? "Select V1 to view the historical dataset." : null}
        </StatusCard>
      </>
    )
  }

  const renderPanel = () => {
    if (isolatedTab && (isolatedStatus === "idle" || isolatedStatus === "loading")) {
      return (
        <StatusCard title="Loading isolated run data...">
          Fetching the no-escalation chart dataset, where each prompt runs in a fresh context.
        </StatusCard>
      )
    }
    if (isolatedTab && isolatedStatus === "error") {
      return (
        <StatusCard title="Could not load the no-escalation results.">
          <button type="button" onClick={() => void onLoadIsolatedResults?.()} className={ACTION_BUTTON_CLASS}>
            Retry
          </button>
        </StatusCard>
      )
    }
    if (isolatedTab && isolatedResults.length === 0) {
      return (
        <StatusCard title="No no-escalation results were published for this version.">
          {process.env.NODE_ENV !== "production" ? (
            <code className="block whitespace-pre-wrap font-mono text-xs text-foreground">
              pnpm bench:run-isolated --module=all
            </code>
          ) : null}
        </StatusCard>
      )
    }
    if (selectedModels.length === 0) {
      return (
        <StatusCard title="No models selected.">
          <p className="mb-3">Pick at least one model above to draw the charts.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetSelection} className={ACTION_BUTTON_CLASS}>
              Restore default selection
            </button>
            <button type="button" onClick={() => setSelection(availableModelIds)} className={ACTION_BUTTON_CLASS}>
              Select all models
            </button>
          </div>
        </StatusCard>
      )
    }

    if (activeTab === "aggregate") {
      return (
        <AggregateCharts
          results={filteredResults}
          models={selectedModels}
          legacyScoring={legacyScoring}
          showDirectedRefusalRate={legacyScoring}
        />
      )
    }
    const moduleTab = moduleTabs.find((tab) => tab.id === activeTab)
    if (moduleTab) {
      return (
        <ModuleCharts
          key={moduleTab.id}
          module={moduleTab.moduleId}
          results={filteredResults}
          models={selectedModels}
          legacyScoring={legacyScoring}
        />
      )
    }
    if (activeTab === "scenario") {
      return <ScenarioCharts results={filteredResults} models={selectedModels} legacyScoring={legacyScoring} />
    }
    return (
      <PromptCharts
        results={filteredResults}
        models={selectedModels}
        legacyScoring={legacyScoring}
        viewMode={isolatedTab ? "stateless" : "stateful"}
      />
    )
  }

  return (
    <>
      {header}

      <ModelVisibilityControls
        models={datasetModels}
        selectedModelIds={selectedModelIds}
        onToggleModel={toggleModel}
        onToggleAll={toggleAll}
        caption={isolatedTab ? "No-escalation dataset" : undefined}
      />

      <div
        role="tablist"
        aria-label="Result views"
        className="mb-8 grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 sm:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]"
      >
        {resultTabs.map((tab, index) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node)
                else tabRefs.current.delete(tab.id)
              }}
              type="button"
              role="tab"
              id={`results-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="results-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`flex min-h-12 w-full min-w-0 flex-col items-center justify-center rounded-md border px-2.5 py-2 text-center transition-colors sm:items-start sm:px-4 sm:py-2.5 sm:text-left ${selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
            >
              <span className="text-wrap font-mono text-[11px] font-bold leading-tight tracking-wide uppercase sm:text-xs">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      <div id="results-panel" role="tabpanel" aria-labelledby={`results-tab-${activeTab}`} className="flex flex-col gap-6">
        {renderPanel()}
      </div>
    </>
  )
}
