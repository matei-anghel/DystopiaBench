"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ModelViewPicker,
  ModelViewProvider,
  getViewModelIds,
  type ModelViewId,
  type PresetModelViewId,
} from "@/components/bench/charts/model-view"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { getDisplayModels } from "@/lib/dystopiabench/display-models"

export type ResultVersion = "latest" | "v1"
export type DatasetStatus = "idle" | "loading" | "ready" | "error"

function ChartLoading() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <p className="ds-label text-[11px] text-muted-foreground">Loading chart</p>
    </div>
  )
}

// Recharts and the analytics helpers stay out of the initial bundle.
const charts = () => import("@/components/bench/charts/aggregate-charts")
const scenarioCharts = () => import("@/components/bench/charts/scenario-charts")
const LeaderboardChart = dynamic(() => charts().then((mod) => mod.LeaderboardChart), { ssr: false, loading: ChartLoading })
const ModelEscalationChart = dynamic(() => charts().then((mod) => mod.ModelEscalationChart), { ssr: false, loading: ChartLoading })
const ModuleEscalationChart = dynamic(() => charts().then((mod) => mod.ModuleEscalationChart), { ssr: false, loading: ChartLoading })
const ModuleBreakdownChart = dynamic(() => charts().then((mod) => mod.ModuleBreakdownChart), { ssr: false, loading: ChartLoading })
const ResponseTiersByModule = dynamic(() => charts().then((mod) => mod.ResponseTiersByModule), { ssr: false, loading: ChartLoading })
const ScenarioScoresByModule = dynamic(() => scenarioCharts().then((mod) => mod.ScenarioScoresByModule), { ssr: false, loading: ChartLoading })
const ScenarioExplorer = dynamic(() => scenarioCharts().then((mod) => mod.ScenarioExplorer), { ssr: false, loading: ChartLoading })
const NoEscalationChart = dynamic(
  () => import("@/components/bench/charts/no-escalation-chart").then((mod) => mod.NoEscalationChart),
  { ssr: false, loading: ChartLoading },
)

const VERSION_LABELS: Record<ResultVersion, string> = {
  v1: "V1",
  latest: "Latest",
}

const SECTIONS = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "escalation", label: "Escalation" },
  { id: "modules", label: "Modules" },
  { id: "scenarios", label: "Scenarios" },
  { id: "no-escalation", label: "No escalation" },
] as const

// Small datasets show every model by default.
const SHOW_ALL_MODELS_LIMIT = 12

function ResultsHeader({
  resultVersion,
  latestAvailable,
  onResultVersionChange,
  showModelPicker = false,
}: {
  resultVersion: ResultVersion
  latestAvailable: boolean
  onResultVersionChange?: (version: ResultVersion) => void
  showModelPicker?: boolean
}) {
  const versions: ResultVersion[] = latestAvailable ? ["latest", "v1"] : ["v1"]

  return (
    <div className="ds-results-head mb-8 flex flex-wrap items-end justify-between gap-4">
      <h2 className="ds-display text-3xl leading-none text-foreground sm:text-4xl">Results</h2>
      <div className="flex items-center gap-2">
        {showModelPicker ? <ModelViewPicker /> : null}
        {versions.length > 1 ? (
          <Select value={resultVersion} onValueChange={(value) => onResultVersionChange?.(value as ResultVersion)}>
            <SelectTrigger className="h-9 min-w-20 shrink-0 bg-background font-mono text-xs" aria-label="Benchmark result version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {versions.map((version) => (
                <SelectItem key={version} value={version} className="font-mono text-xs">
                  {VERSION_LABELS[version]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-border px-3 font-mono text-xs text-foreground">
            {VERSION_LABELS[resultVersion]}
          </span>
        )}
      </div>
    </div>
  )
}

function StatusCard({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="border-border bg-card p-6" role="status">
      <p className="ds-label mb-3 text-xs text-foreground">{title}</p>
      {children ? <div className="text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
    </Card>
  )
}

const ACTION_BUTTON_CLASS =
  "rounded border border-border px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-muted-foreground/60 hover:bg-muted/50"

/** Tracks which report section is in view, for the section nav. */
function useActiveSection(ids: readonly string[], enabled: boolean) {
  const [active, setActive] = useState<string>(ids[0])
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    // The active section is the last one whose top has scrolled past a line 45% of the way
    // down the viewport.
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.45
      let current = ids[0]
      for (const id of ids) {
        const node = document.getElementById(`r-${id}`)
        if (node && node.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [enabled, ids])
  return active
}

function ReportSection({
  id,
  label,
  children,
  pair = false,
}: {
  id: string
  label: string
  children: ReactNode
  /** Two charts that may sit side by side in denser directions. */
  pair?: boolean
}) {
  return (
    <section id={`r-${id}`} className="ds-section scroll-mt-28" aria-labelledby={`r-${id}-title`}>
      <header className="ds-section-head mb-5">
        <h3 id={`r-${id}-title`} className="ds-section-title text-foreground">
          {label}
        </h3>
      </header>
      <div className={`flex flex-col gap-6 ${pair ? "ds-pair" : ""}`}>{children}</div>
    </section>
  )
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

/** The results report: one scrolling page of sections with a section nav (no tabs). */
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
  const [selections, setSelections] = useState<Partial<Record<ResultVersion, { view: ModelViewId; ids: string[] }>>>({})
  const [scenarioId, setScenarioId] = useState<string>(ALL_SCENARIOS[0]?.id ?? "")

  const datasetModels = useMemo(() => getDisplayModels(statefulResults), [statefulResults])
  const availableModelIds = useMemo(() => datasetModels.map((model) => model.id), [datasetModels])
  const selection = selections[resultVersion]
  const defaultView: PresetModelViewId = availableModelIds.length <= SHOW_ALL_MODELS_LIMIT ? "all" : "featured"
  const view = selection?.view ?? defaultView
  const selectedModelIds = useMemo(() => {
    if (view !== "custom") return getViewModelIds(view, datasetModels)
    return (selection?.ids ?? []).filter((id) => availableModelIds.includes(id))
  }, [availableModelIds, datasetModels, selection, view])

  const selectedSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds])
  const selectedModels = useMemo(() => datasetModels.filter((model) => selectedSet.has(model.id)), [datasetModels, selectedSet])
  const filteredResults = useMemo(() => statefulResults.filter((row) => selectedSet.has(row.modelId)), [statefulResults, selectedSet])

  const modelView = useMemo(
    () => ({
      models: datasetModels,
      view,
      selectedIds: selectedModelIds,
      setView: (next: PresetModelViewId) => setSelections((current) => ({ ...current, [resultVersion]: { view: next, ids: [] } })),
      setCustom: (ids: string[]) => setSelections((current) => ({ ...current, [resultVersion]: { view: "custom", ids } })),
    }),
    [datasetModels, resultVersion, selectedModelIds, view],
  )

  const ready = statefulStatus === "ready" && statefulResults.length > 0
  useEffect(() => {
    if (ready) void onLoadIsolatedResults?.()
  }, [ready, onLoadIsolatedResults])

  const sectionIds = useMemo(() => SECTIONS.map((section) => section.id), [])
  const activeSection = useActiveSection(sectionIds, ready && selectedModels.length > 0)

  const header = (
    <ResultsHeader
      resultVersion={resultVersion}
      latestAvailable={latestAvailable}
      onResultVersionChange={onResultVersionChange}
      showModelPicker={ready}
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

  const selectScenario = (id: string) => {
    setScenarioId(id)
    document.getElementById("r-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <ModelViewProvider value={modelView}>
      {header}
      {selectedModels.length === 0 ? (
        <StatusCard title="No models selected.">
          <p className="mb-3">Pick at least one model in the Models menu to draw the charts.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => modelView.setView(defaultView)} className={ACTION_BUTTON_CLASS}>
              Restore default view
            </button>
            <button type="button" onClick={() => modelView.setView("all")} className={ACTION_BUTTON_CLASS}>
              Show all models
            </button>
          </div>
        </StatusCard>
      ) : (
        <div className="ds-report">
          <nav className="ds-toc" aria-label="Results sections">
            <ol>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#r-${section.id}`}
                    aria-current={activeSection === section.id ? "true" : undefined}
                    className="ds-toc-link ds-label text-[11px]"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="ds-report-body flex min-w-0 flex-col gap-16">
            <ReportSection {...SECTIONS[0]}>
              <LeaderboardChart results={filteredResults} models={selectedModels} legacyScoring={legacyScoring} />
            </ReportSection>

            <ReportSection {...SECTIONS[1]} pair>
              <ModelEscalationChart results={filteredResults} models={selectedModels} legacyScoring={legacyScoring} />
              <ModuleEscalationChart results={filteredResults} legacyScoring={legacyScoring} />
            </ReportSection>

            <ReportSection {...SECTIONS[2]}>
              <ModuleBreakdownChart results={filteredResults} models={selectedModels} legacyScoring={legacyScoring} />
              <ResponseTiersByModule results={filteredResults} />
            </ReportSection>

            <ReportSection {...SECTIONS[3]}>
              <ScenarioScoresByModule
                results={filteredResults}
                legacyScoring={legacyScoring}
                selectedId={scenarioId}
                onSelect={selectScenario}
              />
              <div id="r-explorer" className="scroll-mt-28">
                <ScenarioExplorer
                  results={filteredResults}
                  models={selectedModels}
                  legacyScoring={legacyScoring}
                  selectedId={scenarioId}
                  onSelect={setScenarioId}
                />
              </div>
            </ReportSection>

            <ReportSection {...SECTIONS[4]}>
              <NoEscalationChart
                stateful={statefulResults}
                stateless={isolatedResults}
                models={datasetModels}
                legacyScoring={legacyScoring}
                status={isolatedStatus}
              />
            </ReportSection>
          </div>
        </div>
      )}
    </ModelViewProvider>
  )
}
