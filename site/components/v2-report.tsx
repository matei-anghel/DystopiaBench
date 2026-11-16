"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { LabLogo } from "@/components/lab-logo"
import { ModelViewPicker, ModelViewProvider, getViewModelIds, type ModelViewId, type PresetModelViewId } from "@/components/charts/model-view"
import {
  LeaderboardChart,
  ModuleBreakdownChart,
  RepeatConsistencyChart,
  ResponseTypesByModule,
  ScenarioExplorer,
  ScenarioScoresByModule,
  type ChartModel,
} from "@/components/charts/v2-charts"
import { toDisplayModel } from "@/lib/display-models"
import { MODULES } from "@/lib/v2-analytics"
import type { V2Model, V2Results } from "@/lib/v2-results"

const SECTIONS = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "refusals", label: "Refusals" },
  { id: "modules", label: "Modules" },
  { id: "scenarios", label: "Scenarios" },
  { id: "consistency", label: "Consistency" },
] as const

type Segment = { key: string; label: string; color: string }

const SCENARIO_SEGMENTS: Segment[] = [
  { key: "complied", label: "Complied", color: "hsl(var(--primary))" },
  { key: "partial", label: "Partial", color: "hsl(var(--warning))" },
  { key: "principled", label: "Refused on principle", color: "hsl(var(--refusal-principled))" },
  { key: "classifier", label: "Safety classifier", color: "hsl(var(--refusal-classifier))" },
  { key: "mixed", label: "Both kinds", color: "repeating-linear-gradient(135deg, hsl(var(--refusal-principled)) 0 4px, hsl(var(--refusal-classifier)) 4px 8px)" },
]

const REPEAT_SEGMENTS: Segment[] = [
  { key: "delivered", label: "Delivered", color: "hsl(var(--primary))" },
  { key: "partial", label: "Partial", color: "hsl(var(--warning))" },
  { key: "principled", label: "Refused on principle", color: "hsl(var(--refusal-principled))" },
  { key: "classifier", label: "Safety classifier", color: "hsl(var(--refusal-classifier))" },
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
    <li className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem] sm:gap-3">
      <ModelName model={model} compact />
      <span className="flex h-4 overflow-hidden rounded-[2px] bg-muted/60" role="img" aria-label={`${model.label}: ${summary} of ${total}`}>
        {segments.map((s) => {
          const n = counts[s.key] ?? 0
          if (!n || !total) return null
          return <span key={s.key} title={`${s.label}: ${n} of ${total}`} style={{ width: `${(n / total) * 100}%`, background: s.color }} />
        })}
      </span>
      <span className="hidden text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
        {(counts.classifier ?? 0) > 0 ? `${counts.classifier} blocked` : ""}
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

function Refusals({ models }: { models: V2Model[] }) {
  const [unit, setUnit] = useState<"scenarios" | "repeats">("scenarios")
  const withClassifier = models.filter((m) => m.repeats.classifier > 0)
  const segments = unit === "scenarios" ? SCENARIO_SEGMENTS : REPEAT_SEGMENTS
  const toggle = (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Count by">
      {(["scenarios", "repeats"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={unit === value}
          onClick={() => setUnit(value)}
          className="rounded px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
        >
          {value === "scenarios" ? "Scenarios" : "Repeats"}
        </button>
      ))}
    </div>
  )
  return (
    <Card
      title="How each model said no"
      controls={<div className="flex flex-wrap items-center gap-2">{toggle}<ModelViewPicker compact /></div>}
      sub={
        unit === "scenarios"
          ? "Each scenario's outcome across its two repeats. Complied: at least one repeat delivered. A refusal is on principle when the model itself declined, and a safety-classifier refusal when the provider's classifier blocked the reply before it was returned."
          : "Every individual reply. A blocked repeat counts as one safety-classifier refusal; the other repeat of the same scenario was still sent."
      }
    >
      <Legend segments={segments} />
      <ol className="flex flex-col gap-1.5">
        {models.map((model) => {
          const counts: Record<string, number> = unit === "scenarios"
            ? { ...model.outcomes }
            : {
                delivered: model.repeats.delivered,
                partial: model.repeats.partial,
                principled: model.repeats.refused + model.repeats.redirected,
                classifier: model.repeats.classifier,
              }
          const total = unit === "scenarios" ? model.decided : model.repeatCount - (model.repeats.unlabelled ?? 0)
          return <StackedRow key={model.id} model={model} segments={segments} counts={counts} total={total} />
        })}
      </ol>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        {withClassifier.length === 0
          ? "No provider safety classifier blocked any reply in this run."
          : `Safety-classifier refusals appear for ${withClassifier
              .map((m) => `${m.label} (${m.repeats.classifier} of ${m.repeatCount} replies)`)
              .join(", ")}. Every other refusal came from the model itself.`}
      </p>
    </Card>
  )
}

function ModuleHeatmap({ models }: { models: V2Model[] }) {
  return (
    <Card
      title="Module heatmap"
      sub="Scenarios complied with (at least one of two repeats delivered), out of six per module. Darker is more compliant."
      controls={<ModelViewPicker compact />}
    >
      <div className="subtle-x-scrollbar overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              <th scope="col" className="ds-label w-52 pb-1 text-[10px] font-normal text-muted-foreground">Model</th>
              {MODULES.map((m) => (
                <th key={m.id} scope="col" className="pb-1 text-center align-bottom">
                  <span className="block font-mono text-[11px] font-semibold text-foreground">{m.label}</span>
                  <span className="block font-mono text-[10px] font-normal text-muted-foreground">{m.theme}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id}>
                <th scope="row" className="max-w-52 pr-2 font-normal"><ModelName model={model} compact /></th>
                {MODULES.map((m) => {
                  const cell = model.byModule[m.id]
                  const rate = cell && cell.scenarios ? cell.complied / cell.scenarios : null
                  return (
                    <td
                      key={m.id}
                      className="h-7 rounded-[2px] text-center font-mono text-[11px] tabular-nums"
                      style={{
                        background: rate === null ? "transparent" : `hsl(var(--risk-hi) / ${0.08 + rate * 0.92})`,
                        color: rate !== null && rate > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                      }}
                      title={cell ? `${model.label}, ${m.label}: ${cell.complied} of ${cell.scenarios}` : undefined}
                    >
                      {cell ? `${cell.complied}/${cell.scenarios}` : "–"}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          {models.length === 0 ? (
            <p className="ds-label text-xs text-muted-foreground">No models selected. Pick some from the Models menu.</p>
          ) : (
            <>
              <Section id="leaderboard" label="Leaderboard">
                <LeaderboardChart models={chartModels} scenarios={data.design.scenarios} />
              </Section>
              <Section id="refusals" label="Refusals">
                <Refusals models={models} />
              </Section>
              <Section id="modules" label="Modules">
                <ModuleBreakdownChart models={chartModels} data={data} />
                <ResponseTypesByModule models={chartModels} data={data} />
                <ModuleHeatmap models={models} />
              </Section>
              <Section id="scenarios" label="Scenarios">
                <ScenarioScoresByModule models={chartModels} data={data} selectedId={scenarioId} onSelect={selectScenario} />
                <div id="r-explorer" className="scroll-mt-28">
                  <ScenarioExplorer models={chartModels} data={data} selectedId={scenarioId} onSelect={setScenarioId} />
                </div>
              </Section>
              <Section id="consistency" label="Consistency">
                <RepeatConsistencyChart models={chartModels} />
              </Section>
            </>
          )}
        </div>
      </div>
    </ModelViewProvider>
  )
}
