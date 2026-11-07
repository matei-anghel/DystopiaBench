"use client"

import { useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, LabelList,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  getAggregateByModel,
  getComplianceDistribution,
  getEscalationCurve,
  getEscalationCurveByModel,
  createResultsIndex,
} from "@/lib/dystopiabench/analytics"
import {
  COMPLIANCE_COLORS,
  COMPLIANCE_NAMES,
  MODULE_COLORS,
  themedChartColor,
  compareSafestFirst,
  scaleHint,
  scoreToneLabel,
  LEVEL_LABELS,
  getResponsiveBarChartLayout,
  scoreToneText,
} from "@/lib/dystopiabench/chart-config"
import {
  getModelLineDashes,
  indexDisplayModels,
  type DisplayModel,
} from "@/lib/dystopiabench/display-models"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { orderScenarioModulesForDisplay } from "@/lib/dystopiabench/module-display-order"
import { AXIS_TICK, BAR_CURSOR, BAR_VALUE_LABEL, BASELINE_AXIS, GRID_PROPS, averageOf } from "./chart-shared"
import { ChartSummary, ChartTooltip, SectionHeader } from "./section-header"
import { LabLogo, ModelBarXAxisTick, ModelLegend, getModelAxisBottomMargin } from "./lab-logo"

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function ScoreLine({ score, legacyScoring }: { score: number | null; legacyScoring: boolean }) {
  return (
    <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: scoreToneText(score, legacyScoring) }}>
      {score ?? "-"} <span className="text-[11px] font-normal text-muted-foreground">DCS · {scoreToneLabel(score, legacyScoring)}</span>
    </p>
  )
}

function ModelBarTooltip({
  active,
  payload,
  legacyScoring,
  modelsById,
}: {
  active?: boolean
  payload?: Array<{ payload: { modelId: string; avgScore: number } }>
  legacyScoring: boolean
  modelsById: Map<string, DisplayModel>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const model = modelsById.get(d.modelId)
  return (
    <ChartTooltip>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LabLogo provider={model?.provider} size={12} />
        {model?.provider}
      </p>
      <p className="text-xs font-semibold text-foreground">{model?.label ?? d.modelId}</p>
      <ScoreLine score={d.avgScore} legacyScoring={legacyScoring} />
    </ChartTooltip>
  )
}

function ModelLinesTooltip({
  active,
  payload,
  label,
  legacyScoring,
  modelsById,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string | number; value: number | null; color: string }>
  label?: string
  legacyScoring: boolean
  modelsById: Map<string, DisplayModel>
}) {
  if (!active || !payload?.length) return null
  const levelNum = parseInt(String(label ?? "").replace("L", ""), 10)
  return (
    <ChartTooltip className="min-w-44">
      <p className="mb-2 text-[11px] text-muted-foreground">
        {label} · {LEVEL_LABELS[levelNum] ?? label}
      </p>
      {payload
        .filter((entry): entry is typeof entry & { value: number } => typeof entry.value === "number")
        .sort((a, b) => compareSafestFirst(a.value, b.value, legacyScoring))
        .map((entry) => {
          const model = modelsById.get(String(entry.dataKey))
          return (
            <div key={entry.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: model?.color ?? entry.color }} aria-hidden />
                <span className="text-[11px] text-muted-foreground">{model?.label ?? entry.dataKey}</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: scoreToneText(entry.value, legacyScoring) }}>
                {entry.value}
              </span>
            </div>
          )
        })}
    </ChartTooltip>
  )
}

function ModelBarChart({
  data,
  modelsById,
  legacyScoring,
}: {
  data: ReturnType<typeof getAggregateByModel>
  modelsById: Map<string, DisplayModel>
  legacyScoring: boolean
}) {
  const barLayout = getResponsiveBarChartLayout({ categoryCount: data.length })
  const axisBottom = getModelAxisBottomMargin(data.map((entry) => entry.modelId), modelsById)
  const safest = data[0]
  const leastSafe = data[data.length - 1]
  const nameOf = (modelId: string) => modelsById.get(modelId)?.label ?? modelId

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Dystopian Compliance Score"
        sub={`Mean over all scenarios and levels · ${scaleHint(legacyScoring)}`}
      />
      <div className="h-[calc(240px+var(--axis-h))] md:h-[calc(340px+var(--axis-h))]" style={{ "--axis-h": `${axisBottom}px` } as React.CSSProperties}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 0, right: 4, top: 20, bottom: axisBottom }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              type="category"
              dataKey="modelId"
              tick={<ModelBarXAxisTick models={modelsById} />}
              {...BASELINE_AXIS}
              interval={0}
            />
            <YAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ModelBarTooltip legacyScoring={legacyScoring} modelsById={modelsById} />} cursor={BAR_CURSOR} />
            <Bar dataKey="avgScore" radius={[2, 2, 0, 0]} maxBarSize={barLayout.maxBarSize} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
              ))}
              {data.length <= 28 ? <LabelList dataKey="avgScore" {...BAR_VALUE_LABEL} fontSize={data.length > 16 ? 10 : 11} /> : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {safest && leastSafe && data.length > 1 ? (
        <ChartSummary>
          Safest: {nameOf(safest.modelId)} ({safest.avgScore}). Least safe: {nameOf(leastSafe.modelId)} ({leastSafe.avgScore}).
        </ChartSummary>
      ) : null}
    </Card>
  )
}

function EscalationCurveChart({
  data,
  models,
  modelsById,
  legacyScoring,
}: {
  data: ReturnType<typeof getEscalationCurveByModel>
  models: DisplayModel[]
  modelsById: Map<string, DisplayModel>
  legacyScoring: boolean
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const dashes = useMemo(() => getModelLineDashes(models), [models])
  const first = data[0]
  const last = data[data.length - 1]
  const levelMean = (row: (typeof data)[number] | undefined) => {
    if (!row) return null
    const values = models.map((model) => row[model.id]).filter((value): value is number => typeof value === "number")
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  }
  const startMean = levelMean(first)
  const endMean = levelMean(last)

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Score by level"
        sub="L1 is a legitimate request, L5 asks for operational detail"
      />
      <div className="h-[260px] md:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="level" tick={AXIS_TICK} {...BASELINE_AXIS} padding={{ left: 12, right: 12 }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ModelLinesTooltip legacyScoring={legacyScoring} modelsById={modelsById} />} cursor={{ stroke: "hsl(var(--border))" }} />
            {models.map((model) => {
              const dimmed = activeId !== null && activeId !== model.id
              return (
                <Line
                  key={model.id}
                  type="linear"
                  dataKey={model.id}
                  stroke={model.color}
                  strokeWidth={activeId === model.id ? 3 : 1.75}
                  strokeOpacity={dimmed ? 0.12 : 1}
                  strokeDasharray={dashes.get(model.id)}
                  dot={dimmed ? false : { r: 2.5, fill: model.color, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  onMouseEnter={() => setActiveId(model.id)}
                  onMouseLeave={() => setActiveId(null)}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {startMean !== null && endMean !== null ? (
        <ChartSummary>
          Across the selected models the mean DCS moves from {startMean} at L1 to {endMean} at L5.
        </ChartSummary>
      ) : null}
      <ModelLegend models={models} dashes={dashes} activeId={activeId} onActiveChange={setActiveId} />
    </Card>
  )
}

const MODULE_SUMMARIES: Record<string, string> = {
  petrov: "Military command, autonomous weapons, safety overrides",
  orwell: "Mass surveillance, censorship, population control",
  laguardia: "Civic corruption, contractor capture, patronage",
  basaglia: "Coercive therapy, paternalistic care, outsourced control",
  huxley: "Conditioning, caste systems, pacification",
  baudrillard: "Synthetic AI companions used for fraud and manipulation",
}


function useModuleEntries() {
  return useMemo(
    () =>
      orderScenarioModulesForDisplay(ALL_MODULES).map((module) => ({
        id: String(module.id),
        label: getModuleDisplayLabel(module.label),
        summary: MODULE_SUMMARIES[String(module.id)] ?? module.description,
        color: themedChartColor(MODULE_COLORS[String(module.id)] ?? "#888888"),
      })),
    [],
  )
}

/** Mean DCS per level for each module on one chart, labelled at the line ends. */
export function ModuleEscalationChart({ results, legacyScoring }: { results: BenchmarkResult[]; legacyScoring: boolean }) {
  const modules = useModuleEntries()
  const [activeId, setActiveId] = useState<string | null>(null)
  const data = useMemo(() => {
    const curves = modules.map((module) => getEscalationCurve(results.filter((result) => String(result.module) === module.id)))
    return [1, 2, 3, 4, 5].map((level, index) => {
      const row: Record<string, string | number | null> = { level: `L${level}` }
      modules.forEach((module, moduleIndex) => {
        row[module.id] = curves[moduleIndex][index]?.avgScore ?? null
      })
      return row
    })
  }, [modules, results])

  // Zoom to the data (with headroom) so the spread between modules is visible.
  const values = data.flatMap((row) => modules.map((module) => row[module.id])).filter((value): value is number => typeof value === "number")
  const low = values.length ? Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10) : 0
  const high = values.length ? Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10) : 100
  const ticks = Array.from({ length: Math.round((high - low) / 10) + 1 }, (_, index) => low + index * 10)

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Score by level and module"
        sub="Mean of the selected models"
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="h-[280px] md:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="level" tick={AXIS_TICK} {...BASELINE_AXIS} padding={{ left: 12, right: 12 }} />
            <YAxis domain={[low, high]} ticks={ticks} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const levelNum = parseInt(String(label ?? "").replace("L", ""), 10)
                const rows = payload
                  .filter((entry) => typeof entry.value === "number")
                  .sort((a, b) => compareSafestFirst(a.value as number, b.value as number, legacyScoring))
                return (
                  <ChartTooltip className="min-w-44">
                    <p className="mb-2 text-[11px] text-muted-foreground">{label} · {LEVEL_LABELS[levelNum] ?? label}</p>
                    {rows.map((entry) => (
                      <div key={String(entry.dataKey)} className="mb-0.5 flex items-center justify-between gap-4">
                        <span className="text-[11px] text-muted-foreground">
                          {modules.find((module) => module.id === entry.dataKey)?.label ?? String(entry.dataKey)}
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: scoreToneText(entry.value as number, legacyScoring) }}>
                          {entry.value as number}
                        </span>
                      </div>
                    ))}
                  </ChartTooltip>
                )
              }}
            />
            {modules.map((module) => {
              const dimmed = activeId !== null && activeId !== module.id
              return (
                <Line
                  key={module.id}
                  type="linear"
                  dataKey={module.id}
                  stroke={module.color}
                  strokeWidth={activeId === module.id ? 3 : 2}
                  strokeOpacity={dimmed ? 0.15 : 1}
                  dot={dimmed ? false : { r: 3, fill: module.color, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  onMouseEnter={() => setActiveId(module.id)}
                  onMouseLeave={() => setActiveId(null)}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col justify-center gap-1 md:border-l md:border-border md:pl-4" aria-label="Modules at L5" onMouseLeave={() => setActiveId(null)}>
        <li className="ds-label mb-1 text-[10px] text-muted-foreground">At L5</li>
        {[...modules]
          .sort((left, right) => compareSafestFirst(
            data[data.length - 1]?.[left.id] as number | null,
            data[data.length - 1]?.[right.id] as number | null,
            legacyScoring,
          ))
          .map((module) => {
            const value = data[data.length - 1]?.[module.id]
            return (
              <li
                key={module.id}
                tabIndex={0}
                onMouseEnter={() => setActiveId(module.id)}
                onFocus={() => setActiveId(module.id)}
                onBlur={() => setActiveId(null)}
                className={`flex items-center gap-2 font-mono text-[11px] transition-opacity ${activeId && activeId !== module.id ? "opacity-40" : ""}`}
              >
                <span className="h-0.5 w-3.5 shrink-0" style={{ background: module.color }} aria-hidden />
                <span className="flex-1 text-muted-foreground">{module.label}</span>
                <span className="tabular-nums text-foreground">{typeof value === "number" ? value : "-"}</span>
              </li>
            )
          })}
      </ul>
      </div>
      <p className="sr-only">
        {modules
          .map((module) => `${module.label}: ${data.map((row) => `${row.level} ${row[module.id] ?? "no data"}`).join(", ")}`)
          .join(". ")}
      </p>
    </Card>
  )
}

/** Share of responses per compliance tier, one 100% bar per module plus the overall mix. */
export function ResponseTiersByModule({ results }: { results: BenchmarkResult[] }) {
  const modules = useModuleEntries()
  const rows = useMemo(
    () => [
      { id: "all", label: "All modules", tiers: getComplianceDistribution(results) },
      ...modules.map((module) => ({
        id: module.id,
        label: module.label,
        tiers: getComplianceDistribution(results.filter((result) => String(result.module) === module.id)),
      })),
    ],
    [modules, results],
  )
  const tierKeys = rows[0]?.tiers.map((tier) => tier.key) ?? []

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader label="Response types" sub="Share of responses the judges rated refusal, hesitant, compliant or proactive" />
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.id} className={`grid grid-cols-[7rem_1fr] items-center gap-3 ${row.id === "all" ? "mb-2 border-b border-border pb-3" : ""}`}>
            <span className={`font-mono text-[11px] ${row.id === "all" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
            <div className="flex h-5 w-full overflow-hidden rounded-[2px]" title={row.tiers.map((tier) => `${COMPLIANCE_NAMES[tier.key]} ${tier.pct}%`).join(" · ")}>
              {row.tiers.map((tier) =>
                tier.pct > 0 ? (
                  <div
                    key={tier.key}
                    className="flex items-center justify-center font-mono text-[10px] tabular-nums"
                    style={{
                      width: `${tier.pct}%`,
                      background: COMPLIANCE_COLORS[tier.key],
                      color: tier.key === "proactive" || tier.key === "compliant" ? "#fff" : "hsl(var(--foreground))",
                    }}
                  >
                    {tier.pct >= 7 ? `${tier.pct}%` : ""}
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3" aria-label="Legend">
        {tierKeys.map((key) => (
          <li key={key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: COMPLIANCE_COLORS[key] }} aria-hidden />
            {COMPLIANCE_NAMES[key]}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Each model's average DCS within each module: one small panel of lab-coloured bars per module. */
export function ModuleBreakdownChart({
  results,
  models,
  legacyScoring,
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const modules = useModuleEntries()
  const scores = useMemo(() => {
    const byKey = new Map<string, BenchmarkResult[]>()
    for (const result of results) {
      const key = `${result.modelId}::${String(result.module)}`
      const rows = byKey.get(key)
      if (rows) rows.push(result)
      else byKey.set(key, [result])
    }
    return (modelId: string, moduleId: string) => averageOf(byKey.get(`${modelId}::${moduleId}`) ?? [])
  }, [results])

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Score by module"
        sub="Each model's mean within a module, safest first"
      />
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((moduleEntry) => {
          const rows = models
            .map((model) => ({ model, score: scores(model.id, moduleEntry.id) }))
            .sort((left, right) =>
              compareSafestFirst(left.score, right.score, legacyScoring) || left.model.label.localeCompare(right.model.label),
            )

          return (
            <div key={moduleEntry.id} className="min-w-0">
              <h4 className="mb-2.5 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
                <span className="ds-label text-[11px] font-semibold text-foreground">{moduleEntry.label}</span>
                <a href={`/module/${moduleEntry.id}`} className="truncate text-[11px] text-muted-foreground hover:text-foreground" title={moduleEntry.summary}>
                  {moduleEntry.summary}
                </a>
              </h4>
              <div className="flex flex-col gap-1">
                {rows.map((row) => {
                  const score = row.score
                  return (
                    <div
                      key={row.model.id}
                      className="flex min-w-0 items-center gap-2"
                      title={`${row.model.label} | ${moduleEntry.label}: ${score ?? "no data"}`}
                    >
                      <span className="flex w-36 shrink-0 items-center justify-end gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <span className="truncate">{row.model.label}</span>
                        <LabLogo provider={row.model.provider} size={12} />
                      </span>
                      <div className="flex h-3.5 min-w-0 flex-1 items-center gap-1.5">
                        {score == null ? (
                          <span className="font-mono text-[10px] text-muted-foreground">-</span>
                        ) : (
                          <>
                            <div className="h-full rounded-[1px]" style={{ width: `${clampScore(score)}%`, background: row.model.color }} />
                            <span className="font-mono text-[10px] tabular-nums text-foreground">{score}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** Leaderboard: average DCS per model, safest first. */
export function LeaderboardChart({ results, models, legacyScoring }: { results: BenchmarkResult[]; models: DisplayModel[]; legacyScoring: boolean }) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const modelsById = useMemo(() => indexDisplayModels(models), [models])
  const data = useMemo(
    () => getAggregateByModel(results, resultsIndex).sort((left, right) => compareSafestFirst(left.avgScore, right.avgScore, legacyScoring)),
    [legacyScoring, results, resultsIndex],
  )
  return <ModelBarChart data={data} modelsById={modelsById} legacyScoring={legacyScoring} />
}

/** Per-model escalation curve across L1-L5. */
export function ModelEscalationChart({ results, models, legacyScoring }: { results: BenchmarkResult[]; models: DisplayModel[]; legacyScoring: boolean }) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const modelsById = useMemo(() => indexDisplayModels(models), [models])
  const modelsWithData = useMemo(() => models.filter((model) => resultsIndex.byModel.has(model.id)), [models, resultsIndex])
  const data = useMemo(() => getEscalationCurveByModel(results, resultsIndex), [results, resultsIndex])
  return <EscalationCurveChart data={data} models={modelsWithData} modelsById={modelsById} legacyScoring={legacyScoring} />
}
