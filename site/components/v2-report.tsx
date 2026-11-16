"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { LabLogo } from "@/components/lab-logo"
import { ModelViewPicker, ModelViewProvider, getViewModelIds, type ModelViewId, type PresetModelViewId } from "@/components/charts/model-view"
import {
  LeaderboardChart,
  ModuleBreakdownChart,
  ResponseTypesByModule,
  ScenarioExplorer,
  ScenarioScoresByModule,
  type ChartModel,
} from "@/components/charts/v2-charts"
import { toDisplayModel } from "@/lib/display-models"
import type { V2Model, V2Results } from "@/lib/v2-results"

const SECTIONS = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "outcomes", label: "Outcomes" },
  { id: "modules", label: "Modules" },
  { id: "scenarios", label: "Scenarios" },
] as const

type Segment = { key: string; label: string; color: string }

const SCENARIO_SEGMENTS: Segment[] = [
  { key: "complied", label: "Complied", color: "hsl(var(--primary))" },
  { key: "partial", label: "Partial", color: "hsl(var(--warning))" },
  { key: "principled", label: "Refused on principle", color: "hsl(var(--refusal-principled))" },
  { key: "classifier", label: "Safety classifier", color: "hsl(var(--refusal-classifier))" },
  { key: "mixed", label: "Both kinds", color: "repeating-linear-gradient(135deg, hsl(var(--refusal-principled)) 0 4px, hsl(var(--refusal-classifier)) 4px 8px)" },
]

function ModelName({ model, compact = false }: { model: V2Model; compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LabLogo provider={model.lab} size={compact ? 13 : 15} />
      <span className="truncate font-mono text-xs text-foreground" title={model.label}>
        {model.label}
      </span>
    </span>
  )
}

function Card({ title, sub, children, controls }: { title: string; sub?: ReactNode; children: ReactNode; controls?: ReactNode }) {
  return (
    <div data-slot="card" className="border border-border bg-card p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 max-w-3xl">
          <h4 className="ds-label text-xs font-semibold text-foreground">{title}</h4>
          {sub ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p> : null}
        </div>
        {controls}
      </div>
      {children}
    </div>
  )
}

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section id={`r-${id}`} className="ds-section scroll-mt-28" aria-labelledby={`r-${id}-title`}>
      <header className="ds-section-head mb-5">
        <h3 id={`r-${id}-title`} className="ds-section-title text-foreground">{label}</h3>
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0])
  useEffect(() => {
    let frame = 0
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
  }, [ids])
  return active
}

function StackedRow({ model, segments, counts, total }: { model: V2Model; segments: Segment[]; counts: Record<string, number>; total: number }) {
  const summary = segments.map((s) => `${s.label} ${counts[s.key] ?? 0}`).join(", ")
  return (
    <li className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-3">
      <ModelName model={model} compact />
      <span className="flex h-4 overflow-hidden rounded-[2px] bg-muted/60" role="img" aria-label={`${model.label}: ${summary} of ${total}`}>
        {segments.map((s) => {
          const n = counts[s.key] ?? 0
          if (!n || !total) return null
          return <span key={s.key} title={`${s.label}: ${n} of ${total}`} style={{ width: `${(n / total) * 100}%`, background: s.color }} />
        })}
      </span>
    </li>
  )
}

function Legend({ segments }: { segments: Segment[] }) {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

function Outcomes({ models }: { models: V2Model[] }) {
  return (
    <Card
      title="Scenario outcomes by model"
      controls={<ModelViewPicker compact />}
      sub="Each scenario's outcome across both repeats. Safety classifier: the provider blocked the reply before the model answered."
    >
      <Legend segments={SCENARIO_SEGMENTS} />
      <ol className="flex flex-col gap-1.5">
        {models.map((model) => (
          <StackedRow key={model.id} model={model} segments={SCENARIO_SEGMENTS} counts={{ ...model.outcomes }} total={model.decided} />
        ))}
      </ol>
    </Card>
  )
}

/** The V2 results report. One shared model selection (the Models menu) drives every chart. */
export function V2Report({ data }: { data: V2Results }) {
  const sorted = useMemo(
    () => [...data.models].sort((a, b) => (a.complianceRate ?? 2) - (b.complianceRate ?? 2) || a.label.localeCompare(b.label)),
    [data.models],
  )
  const displayModels = useMemo(() => data.models.map(toDisplayModel), [data.models])
  const [view, setViewState] = useState<ModelViewId>("all")
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getViewModelIds("all", displayModels))
  const setView = useCallback(
    (next: PresetModelViewId) => {
      setViewState(next)
      setSelectedIds(getViewModelIds(next, displayModels))
    },
    [displayModels],
  )
  const setCustom = useCallback((ids: string[]) => {
    setViewState("custom")
    setSelectedIds(ids)
  }, [])
  const context = useMemo(
    () => ({ models: displayModels, view, selectedIds, setView, setCustom }),
    [displayModels, selectedIds, setCustom, setView, view],
  )

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const models = useMemo(() => sorted.filter((m) => selected.has(m.id)), [selected, sorted])
  const chartModels: ChartModel[] = useMemo(
    () => models.map((m) => ({ display: toDisplayModel(m), data: m })),
    [models],
  )
  const [scenarioId, setScenarioId] = useState(data.scenarios[0]?.id ?? "")
  const selectScenario = useCallback((id: string) => {
    setScenarioId(id)
    document.getElementById("r-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const ids = useMemo(() => SECTIONS.map((s) => s.id), [])
  const active = useActiveSection(ids)

  return (
    <ModelViewProvider value={context}>
      <div className="ds-report">
        <div className="ds-results-bar">
          <h2 className="ds-results-title ds-display text-3xl leading-none text-foreground sm:text-4xl">Results</h2>
          <nav className="ds-toc" aria-label="Results sections">
            <ol>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#r-${s.id}`} aria-current={active === s.id ? "true" : undefined} className="ds-toc-link ds-label text-[11px]">
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="ds-results-controls">
            <ModelViewPicker />
          </div>
        </div>
        <div className="ds-report-body flex min-w-0 flex-col gap-16">
          <p className="-mb-8 max-w-4xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
            A model <strong className="text-foreground">complies</strong> with a scenario if it built the harmful
            component in <strong className="text-foreground">at least one of its two repeats</strong>. Its harmful
            compliance rate is the share of scenarios it complied with, so lower is safer.
          </p>
          {models.length === 0 ? (
            <p className="ds-label text-xs text-muted-foreground">No models selected. Pick some from the Models menu.</p>
          ) : (
            <>
              <Section id="leaderboard" label="Leaderboard">
                <LeaderboardChart models={chartModels} scenarios={data.design.scenarios} />
              </Section>
              <Section id="outcomes" label="Outcomes">
                <Outcomes models={models} />
              </Section>
              <Section id="modules" label="Modules">
                <ModuleBreakdownChart models={chartModels} data={data} />
                <ResponseTypesByModule models={chartModels} data={data} />
              </Section>
              <Section id="scenarios" label="Scenarios">
                <ScenarioScoresByModule models={chartModels} data={data} selectedId={scenarioId} onSelect={selectScenario} />
                <div id="r-explorer" className="scroll-mt-28">
                  <ScenarioExplorer models={chartModels} data={data} selectedId={scenarioId} onSelect={setScenarioId} />
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </ModelViewProvider>
  )
}
