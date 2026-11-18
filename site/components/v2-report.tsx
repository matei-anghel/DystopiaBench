"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
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

type Segment = { key: string; label: string; color: string; ink: string }

const SCENARIO_SEGMENTS: Segment[] = [
  { key: "complied", label: "Complied", color: "hsl(var(--primary))", ink: "hsl(var(--primary-foreground))" },
  { key: "partial", label: "Partial", color: "hsl(var(--warning))", ink: "hsl(var(--warning-foreground))" },
  { key: "principled", label: "Refused on principle", color: "hsl(var(--refusal-principled))", ink: "#fff" },
  { key: "classifier", label: "Safety classifier", color: "hsl(var(--refusal-classifier))", ink: "#fff" },
  { key: "mixed", label: "Both kinds", color: "repeating-linear-gradient(135deg, hsl(var(--refusal-principled)) 0 4px, hsl(var(--refusal-classifier)) 4px 8px)", ink: "#fff" },
]

const ROW_GRID = "grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-3"

/** Evenly spaced whole-number ticks from 0 to total, about four intervals. */
function countTicks(total: number): number[] {
  if (total <= 0) return [0]
  const step = Math.max(1, Math.round(total / 4))
  const ticks: number[] = []
  for (let t = 0; t < total; t += step) ticks.push(t)
  if (total - ticks[ticks.length - 1] < step / 2) ticks.pop()
  return [...ticks, total]
}

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
    <li className={ROW_GRID}>
      <ModelName model={model} compact />
      <span className="flex h-5 overflow-hidden rounded-[2px] bg-muted/60" role="img" aria-label={`${model.label}: ${summary} of ${total}`}>
        {segments.map((s) => {
          const n = counts[s.key] ?? 0
          if (!n || !total) return null
          const share = n / total
          return (
            <span
              key={s.key}
              title={`${s.label}: ${n} of ${total}`}
              className="flex items-center justify-center font-mono text-[10px] tabular-nums"
              style={{ width: `${share * 100}%`, background: s.color, color: s.ink }}
            >
              <span className={share < 0.08 ? "hidden md:inline" : undefined}>{n}</span>
            </span>
          )
        })}
      </span>
    </li>
  )
}

function CountAxis({ total, unit }: { total: number; unit: string }) {
  const ticks = countTicks(total)
  return (
    <div className={`${ROW_GRID} mt-2`} aria-hidden>
      <span className="text-right font-mono text-[10px] text-muted-foreground">{unit}</span>
      <div className="relative h-4 border-t border-border">
        {ticks.map((t) => {
          const pct = (t / total) * 100
          const align = t === 0 ? "translate-x-0" : t === total ? "-translate-x-full" : "-translate-x-1/2"
          return (
            <span key={t} className={`absolute top-0 flex flex-col items-center ${align}`} style={{ left: `${pct}%` }}>
              <span className="h-1 w-px bg-border" />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{t}</span>
            </span>
          )
        })}
      </div>
    </div>
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

function Outcomes({ models, scenarios }: { models: V2Model[]; scenarios: number }) {
  return (
    <Card
      title="Scenario outcomes by model"
      controls={<ModelViewPicker compact />}
      sub={`Scenarios out of ${scenarios}, safest model first.`}
    >
      <Legend segments={SCENARIO_SEGMENTS} />
      <ol className="flex flex-col gap-1.5">
        {models.map((model) => (
          <StackedRow key={model.id} model={model} segments={SCENARIO_SEGMENTS} counts={{ ...model.outcomes }} total={model.decided} />
        ))}
      </ol>
      <CountAxis total={scenarios} unit="scenarios" />
    </Card>
  )
}

/**
 * True while the in-page section tabs have scrolled up under the top bar and the report is still on screen, so a
 * copy of the tabs can be shown in the bar. Returns the header slot to render into, or null.
 */
function useDockedTabs(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const header = document.querySelector<HTMLElement>(".ds-header")
      const toc = document.getElementById("ds-results-toc")
      const body = document.querySelector<HTMLElement>(".ds-report-body")
      const target = document.getElementById("ds-header-slot")
      if (!header || !toc || !body || !target) return setSlot(null)
      const line = header.getBoundingClientRect().bottom
      const docked = toc.getBoundingClientRect().bottom <= line && body.getBoundingClientRect().bottom > line + 48
      setSlot(docked ? target : null)
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
  }, [])
  return slot
}

function SectionTabs({ active, className, id }: { active: string; className: string; id?: string }) {
  const listRef = useRef<HTMLOListElement | null>(null)
  // Keep the active tab in view when the strip is narrower than its tabs (phones); never scrolls the page.
  useEffect(() => {
    const list = listRef.current
    const link = list?.querySelector<HTMLElement>("[aria-current]")
    if (!list || !link || list.scrollWidth <= list.clientWidth) return
    list.scrollLeft = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2
  }, [active])
  return (
    <nav id={id} className={className} aria-label="Results sections">
      <ol ref={listRef}>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#r-${s.id}`} aria-current={active === s.id ? "true" : undefined} className="ds-toc-link ds-label text-[11px]">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
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
  const dockSlot = useDockedTabs()

  return (
    <ModelViewProvider value={context}>
      <div className="ds-report">
        <div className="ds-results-bar">
          <h2 className="ds-results-title ds-display text-3xl leading-none text-foreground sm:text-4xl">Results</h2>
          <SectionTabs id="ds-results-toc" active={active} className="ds-toc" />
          {dockSlot ? createPortal(<SectionTabs active={active} className="ds-toc ds-toc-dock" />, dockSlot) : null}
          <div className="ds-results-controls">
            <ModelViewPicker />
          </div>
        </div>
        <div className="ds-report-body flex min-w-0 flex-col gap-16">
          {models.length === 0 ? (
            <p className="ds-label text-xs text-muted-foreground">No models selected. Pick some from the Models menu.</p>
          ) : (
            <>
              <Section id="leaderboard" label="Leaderboard">
                <LeaderboardChart models={chartModels} scenarios={data.design.scenarios} />
              </Section>
              <Section id="outcomes" label="Outcomes">
                <Outcomes models={models} scenarios={data.design.scenarios} />
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
