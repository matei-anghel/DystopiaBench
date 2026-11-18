"use client"

import { useMemo, type CSSProperties } from "react"
import { ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { LabLogo, ModelBarXAxisTick, getModelAxisBottomMargin } from "@/components/lab-logo"
import { indexDisplayModels, type DisplayModel } from "@/lib/display-models"
import {
  MODULES,
  REPEAT_LABELS,
  complianceRate,
  labelMix,
  moduleLabel,
  scenarioComplianceRate,
  scenarioIdsByModule,
} from "@/lib/v2-analytics"
import type { V2Model, V2Results } from "@/lib/v2-results"
import { getScenarioSummary } from "@/lib/v2-scenarios"
import {
  AGGREGATE_BAR,
  AXIS_TICK,
  BAR_CURSOR,
  BAR_VALUE_LABEL,
  BASELINE_AXIS,
  Card,
  ChartSummary,
  ChartTooltip,
  GRID_PROPS,
  MAX_LABELLED_BARS,
  PERCENT_TICKS,
  SectionHeader,
  barLayout,
  compareSafestFirst,
  rateTone,
} from "./shared"

/** A model with its V2 data, as the charts take it. */
export interface ChartModel {
  display: DisplayModel
  data: V2Model
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function RateLine({ value, unit = "harmful compliance" }: { value: number | null; unit?: string }) {
  return (
    <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: rateTone(value) }}>
      {value === null ? "-" : `${value}%`} <span className="text-[11px] font-normal text-muted-foreground">{unit}</span>
    </p>
  )
}

function ModelBarTooltip({
  active,
  payload,
  modelsById,
  unit,
  detail,
}: {
  active?: boolean
  payload?: Array<{ payload: { modelId: string; value: number | null } }>
  modelsById: Map<string, DisplayModel>
  unit?: string
  detail?: (modelId: string) => string | null
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const model = modelsById.get(d.modelId)
  const extra = detail?.(d.modelId)
  return (
    <ChartTooltip>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LabLogo provider={model?.provider} size={12} />
        {model?.provider}
      </p>
      <p className="text-xs font-semibold text-foreground">{model?.label ?? d.modelId}</p>
      <RateLine value={d.value} unit={unit} />
      {extra ? <p className="mt-0.5 text-[11px] text-muted-foreground">{extra}</p> : null}
    </ChartTooltip>
  )
}

/** Vertical lab-coloured bars, one per model, with the lab logo and angled name under each bar. */
function ModelBars({
  data,
  modelsById,
  unit,
  detail,
  heights = "h-[calc(240px+var(--axis-h))] md:h-[calc(340px+var(--axis-h))]",
  domain = [0, 100],
  ticks = PERCENT_TICKS,
}: {
  data: { modelId: string; value: number | null }[]
  modelsById: Map<string, DisplayModel>
  unit?: string
  detail?: (modelId: string) => string | null
  heights?: string
  domain?: [number, number]
  ticks?: number[]
}) {
  const layout = barLayout(data.length)
  const axisBottom = getModelAxisBottomMargin(data.map((entry) => entry.modelId), modelsById)
  // The first bar's angled name runs left of the plot; leave room so it is not clipped.
  const firstLabel = data[0] ? (modelsById.get(data[0].modelId)?.label ?? data[0].modelId).length : 0
  const axisLeft = Math.max(0, Math.ceil(firstLabel * 6.2 * 1.1 * Math.cos((40 * Math.PI) / 180)) - 40)
  return (
    <div className={heights} style={{ "--axis-h": `${axisBottom}px` } as CSSProperties}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ left: axisLeft, right: 4, top: 20, bottom: axisBottom }}
          barGap={layout.barGap}
          barCategoryGap={layout.barCategoryGap}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis type="category" dataKey="modelId" tick={<ModelBarXAxisTick models={modelsById} />} {...BASELINE_AXIS} interval={0} />
          <YAxis type="number" domain={domain} ticks={ticks} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
          <Tooltip content={<ModelBarTooltip modelsById={modelsById} unit={unit} detail={detail} />} cursor={BAR_CURSOR} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={layout.maxBarSize} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
            ))}
            {data.length <= MAX_LABELLED_BARS ? (
              <LabelList dataKey="value" {...BAR_VALUE_LABEL} fontSize={data.length > 16 ? 10 : 11} />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Leaderboard: harmful compliance rate per model, safest first. */
export function LeaderboardChart({ models, scenarios }: { models: ChartModel[]; scenarios: number }) {
  const modelsById = useMemo(() => indexDisplayModels(models.map((m) => m.display)), [models])
  const byId = useMemo(() => new Map(models.map((m) => [m.display.id, m.data])), [models])
  const data = useMemo(
    () =>
      models
        .map((m) => ({ modelId: m.display.id, value: complianceRate(m.data) }))
        .sort((a, b) => compareSafestFirst(a.value, b.value) || a.modelId.localeCompare(b.modelId)),
    [models],
  )
  const safest = data[0]
  const leastSafe = data[data.length - 1]
  const nameOf = (id: string) => modelsById.get(id)?.label ?? id

  return (
    <Card>
      <SectionHeader
        label="Harmful compliance rate"
        sub={`Share of the ${scenarios} scenarios where the model built the harmful component`}
      />
      <ModelBars
        data={data}
        modelsById={modelsById}
        detail={(id) => {
          const m = byId.get(id)
          return m ? `${m.outcomes.complied} of ${m.decided} scenarios` : null
        }}
      />
      {safest && leastSafe && data.length > 1 ? (
        <ChartSummary>
          Safest: {nameOf(safest.modelId)} ({safest.value}%). Least safe: {nameOf(leastSafe.modelId)} ({leastSafe.value}%).
        </ChartSummary>
      ) : null}
    </Card>
  )
}

/** Each model's compliance rate within each module: one small panel of lab-coloured bars per module. */
export function ModuleBreakdownChart({ models, data }: { models: ChartModel[]; data: V2Results }) {
  const byModule = useMemo(() => scenarioIdsByModule(data), [data])
  return (
    <Card>
      <SectionHeader label="Compliance by module" sub="Six scenarios per module" />
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((moduleEntry) => {
          const ids = byModule.get(moduleEntry.id)
          const rows = models
            .map((m) => ({ model: m.display, value: complianceRate(m.data, ids), cell: m.data.byModule[moduleEntry.id] }))
            .sort((a, b) => compareSafestFirst(a.value, b.value) || a.model.label.localeCompare(b.model.label))
          return (
            <div key={moduleEntry.id} className="min-w-0">
              <h5 className="mb-2.5 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
                <span className="ds-label text-[11px] font-semibold text-foreground">{moduleEntry.label}</span>
                <span className="truncate text-[11px] text-muted-foreground">{moduleEntry.theme}</span>
              </h5>
              <div className="flex flex-col gap-1">
                {rows.map((row) => (
                  <div
                    key={row.model.id}
                    className="flex min-w-0 items-center gap-2"
                    title={`${row.model.label} | ${moduleEntry.label}: ${row.cell ? `${row.cell.complied} of ${row.cell.scenarios} scenarios` : "no data"}`}
                  >
                    <span className="flex w-36 shrink-0 items-center justify-end gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <span className="truncate">{row.model.label}</span>
                      <LabLogo provider={row.model.provider} size={12} />
                    </span>
                    <div className="flex h-3.5 min-w-0 flex-1 items-center gap-1.5">
                      {row.value === null ? (
                        <span className="font-mono text-[10px] text-muted-foreground">-</span>
                      ) : (
                        <>
                          <div className="h-full rounded-[1px]" style={{ width: `${clamp(row.value)}%`, background: row.model.color }} />
                          <span className="font-mono text-[10px] tabular-nums text-foreground">{row.value}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function MixBar({ mix, title }: { mix: ReturnType<typeof labelMix>; title: string }) {
  return (
    <div className="flex h-5 w-full overflow-hidden rounded-[2px]" title={`${title}: ${mix.map((m) => `${m.label} ${m.pct}%`).join(" · ")}`}>
      {mix.map((m) =>
        m.count > 0 ? (
          <div
            key={m.key}
            className="flex items-center justify-center font-mono text-[10px] tabular-nums"
            style={{ width: `${(m.count / Math.max(1, mix.reduce((s, x) => s + x.count, 0))) * 100}%`, background: m.color, color: m.ink }}
          >
            {m.pct >= 7 ? `${m.pct}%` : ""}
          </div>
        ) : null,
      )}
    </div>
  )
}

function LabelLegend() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3" aria-label="Legend">
      {REPEAT_LABELS.map((entry) => (
        <li key={entry.key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: entry.color }} aria-hidden />
          {entry.label}
        </li>
      ))}
    </ul>
  )
}

/** Share of replies per review label, one 100% bar per module plus the overall mix. */
export function ResponseTypesByModule({ models, data }: { models: ChartModel[]; data: V2Results }) {
  const byModule = useMemo(() => scenarioIdsByModule(data), [data])
  const rows = useMemo(() => {
    const raw = models.map((m) => m.data)
    return [
      { id: "all", label: "All modules", mix: labelMix(raw) },
      ...MODULES.map((m) => ({ id: m.id, label: m.label, mix: labelMix(raw, byModule.get(m.id)) })),
    ]
  }, [byModule, models])

  return (
    <Card>
      <SectionHeader label="Review labels by module" sub={`Percent of all ${rows[0].mix.reduce((n, m) => n + m.count, 0).toLocaleString("en-US")} graded replies from the selected models.`} />
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.id} className={`grid grid-cols-[7rem_1fr] items-center gap-3 ${row.id === "all" ? "mb-2 border-b border-border pb-3" : ""}`}>
            <span className={`font-mono text-[11px] ${row.id === "all" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
            <MixBar mix={row.mix} title={row.label} />
          </div>
        ))}
      </div>
      <LabelLegend />
    </Card>
  )
}

/** Every scenario's compliance across the selected models, one small panel per module (safest first). */
export function ScenarioScoresByModule({
  models,
  data,
  selectedId,
  onSelect,
}: {
  models: ChartModel[]
  data: V2Results
  selectedId: string
  onSelect: (scenarioId: string) => void
}) {
  const groups = useMemo(() => {
    const raw = models.map((m) => m.data)
    return MODULES.map((moduleEntry) => ({
      ...moduleEntry,
      rows: data.scenarios
        .filter((s) => s.module === moduleEntry.id)
        .map((s) => ({ id: s.id, value: scenarioComplianceRate(raw, s.id) }))
        .sort((a, b) => compareSafestFirst(a.value, b.value) || a.id.localeCompare(b.id)),
    }))
  }, [data.scenarios, models])

  return (
    <Card>
      <SectionHeader
        label="Compliance by scenario"
        sub="Percent of models that built the harmful component. Click any scenario to open it in the explorer below."
      />
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className="min-w-0">
            <h5 className="mb-2 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
              <span className="ds-label text-[11px] font-semibold text-foreground">{group.label}</span>
              <span className="truncate text-[11px] text-muted-foreground">{group.theme}</span>
            </h5>
            <ul className="flex flex-col">
              {group.rows.map(({ id, value }) => {
                const active = id === selectedId
                const summary = getScenarioSummary(id)
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      aria-pressed={active}
                      title={summary ? `${id} · ${summary.title}` : id}
                      className={`group grid w-full cursor-pointer grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-2 rounded-sm border-l-2 px-1 py-1 text-left transition-colors hover:bg-muted ${active ? "border-primary bg-muted" : "border-transparent"}`}
                    >
                      <span
                        className={`truncate text-[11px] underline-offset-2 group-hover:text-foreground group-hover:underline ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {summary?.title ?? id}
                      </span>
                      <span className="flex h-3 min-w-0 items-center gap-1.5">
                        {value === null ? (
                          <span className="font-mono text-[10px] text-muted-foreground">-</span>
                        ) : (
                          <>
                            <span
                              className="h-full rounded-[1px]"
                              style={{
                                width: `${clamp(value)}%`,
                                background: active ? "hsl(var(--primary))" : AGGREGATE_BAR.fill,
                                border: `1px solid ${active ? "hsl(var(--primary))" : AGGREGATE_BAR.stroke}`,
                              }}
                            />
                            <span className="font-mono text-[10px] tabular-nums text-foreground">{value}</span>
                          </>
                        )}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className={`h-3.5 w-3.5 transition-colors group-hover:text-foreground ${active ? "text-primary" : "text-muted-foreground/50"}`}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

const SELECT_CLASS = "h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground"

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h5 className="ds-label mb-3 text-[11px] text-muted-foreground">{children}</h5>
}

/** One scenario in depth: its outcome mix, each model's delivered repeats, and every reply's label. */
export function ScenarioExplorer({
  models,
  data,
  selectedId,
  onSelect,
}: {
  models: ChartModel[]
  data: V2Results
  selectedId: string
  onSelect: (scenarioId: string) => void
}) {
  const scenario = data.scenarios.find((s) => s.id === selectedId) ?? data.scenarios[0]
  const modelsById = useMemo(() => indexDisplayModels(models.map((m) => m.display)), [models])
  const raw = useMemo(() => models.map((m) => m.data), [models])
  const ids = useMemo(() => (scenario ? new Set([scenario.id]) : new Set<string>()), [scenario])
  const bars = useMemo(
    () =>
      scenario
        ? models
            .map((m) => {
              const labels = m.data.cells[scenario.id] ?? []
              return { modelId: m.display.id, value: labels.length ? Math.round((labels.filter((l) => l === "delivered").length / labels.length) * 100) : null }
            })
            .sort((a, b) => compareSafestFirst(a.value, b.value) || a.modelId.localeCompare(b.modelId))
        : [],
    [models, scenario],
  )
  if (!scenario) return null
  const summary = getScenarioSummary(scenario.id)
  const moduleEntry = MODULES.find((m) => m.id === scenario.module)
  const moduleScenarios = data.scenarios.filter((s) => s.module === scenario.module)
  const rate = scenarioComplianceRate(raw, scenario.id)
  const complied = raw.filter((m) => (m.cells[scenario.id] ?? []).includes("delivered")).length
  const mix = labelMix(raw, ids)

  return (
    <Card>
      <SectionHeader label="Scenario detail">
        <select
          aria-label="Module"
          value={scenario.module}
          onChange={(event) => {
            const first = data.scenarios.find((s) => s.module === event.target.value)
            if (first) onSelect(first.id)
          }}
          className={SELECT_CLASS}
        >
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select aria-label="Scenario" value={scenario.id} onChange={(event) => onSelect(event.target.value)} className={`${SELECT_CLASS} max-w-56`}>
          {moduleScenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {getScenarioSummary(s.id)?.title ?? s.id}
            </option>
          ))}
        </select>
      </SectionHeader>

      <div className="flex items-start justify-between gap-6 border-t border-border pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="ds-display text-xl leading-tight text-foreground">{summary?.title ?? `Scenario ${scenario.id}`}</p>
          {summary ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{summary.summary}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-border px-1.5 py-0 font-mono text-[10px] text-foreground">
              {moduleLabel(scenario.module)}{moduleEntry ? ` · ${moduleEntry.theme}` : ""}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{scenario.id}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            A paraphrase written for readers, not the prompt the models saw. The prompts stay private so they cannot leak
            into training data.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-3xl font-semibold tabular-nums" style={{ color: rateTone(rate) }}>
            {rate === null ? "-" : `${rate}%`}
          </span>
          <p className="font-mono text-[10px] text-muted-foreground">
            {complied} of {raw.length} models complied
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-8">
        <div>
          <PanelTitle>Response types</PanelTitle>
          <MixBar mix={mix} title={summary?.title ?? scenario.id} />
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {mix.map((m) => (
              <li key={m.key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: m.color }} aria-hidden />
                {m.label}
                <span className="tabular-nums text-foreground">{m.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <PanelTitle>By model · share of repeats delivered</PanelTitle>
          <ModelBars
            data={bars}
            modelsById={modelsById}
            unit="of repeats delivered"
            heights="h-[calc(220px+var(--axis-h))] md:h-[calc(260px+var(--axis-h))]"
          />
        </div>
      </div>
    </Card>
  )
}
