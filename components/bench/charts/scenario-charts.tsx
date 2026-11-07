"use client"

import { useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ALL_MODULES, ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { orderScenarioModulesForDisplay } from "@/lib/dystopiabench/module-display-order"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  AGGREGATE_BAR,
  compareSafestFirst,
  scaleHint,
  scoreDirectionHint,
  scoreToneLabel,
  LEVEL_LABELS,
  getResponsiveBarChartLayout,
  scoreToneText,
} from "@/lib/dystopiabench/chart-config"
import { createResultsIndex, type ResultsIndex } from "@/lib/dystopiabench/analytics"
import {
  getModelLineDashes,
  indexDisplayModels,
  type DisplayModel,
} from "@/lib/dystopiabench/display-models"
import {
  AXIS_TICK,
  BAR_CURSOR,
  BAR_VALUE_LABEL,
  BASELINE_AXIS,
  GRID_PROPS,
  averageOf,
} from "./chart-shared"
import { ChartSummary, ChartTooltip, SectionHeader } from "./section-header"
import { LabLogo, ModelBarXAxisTick, ModelLegend, getModelAxisBottomMargin } from "./lab-logo"
import { PromptLevels } from "./prompt-charts"

const SCORE_TICKS = [0, 25, 50, 75, 100]
/** Value labels stay legible on vertical bars up to roughly this many categories. */
const MAX_LABELLED_BARS = 28

function scenarioLevelKey(scenarioId: string, level: number): string {
  return `${scenarioId}::${level}`
}

function scenarioModelLevelKey(scenarioId: string, modelId: string, level: number): string {
  return `${scenarioId}::${modelId}::${level}`
}

/** "Lower is better" -> "lower is better", for use after a "·" separator in subtitles. */
export function directionSuffix(legacyScoring: boolean): string {
  return scoreDirectionHint(legacyScoring).toLowerCase()
}

export function LevelAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: string | number }
}) {
  const label = String(payload?.value ?? "")
  const levelName = LEVEL_LABELS[parseInt(label.replace("L", ""), 10)]
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={11} fontFamily={AXIS_TICK.fontFamily}>
        {label}
      </text>
      {levelName ? (
        <text x={0} y={0} dy={26} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} fontFamily={AXIS_TICK.fontFamily}>
          {levelName}
        </text>
      ) : null}
    </g>
  )
}

/** Score + tier name line used inside every score tooltip. */
export function ScoreLine({ score, legacyScoring }: { score: number | null; legacyScoring: boolean }) {
  return (
    <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: scoreToneText(score, legacyScoring) }}>
      {score ?? "-"} <span className="text-[11px] font-normal text-muted-foreground">DCS · {scoreToneLabel(score, legacyScoring)}</span>
    </p>
  )
}

/** Tooltip for single-series level bars (`{ label, levelName, avg }` rows). */
export function LevelBarTooltip({
  active,
  payload,
  legacyScoring,
}: {
  active?: boolean
  payload?: Array<{ payload?: { label?: unknown; levelName?: unknown; avg?: unknown } }>
  legacyScoring: boolean
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const avg = typeof d.avg === "number" ? d.avg : null
  return (
    <ChartTooltip>
      <p className="text-xs font-semibold text-foreground">
        {String(d.label)} · {String(d.levelName)}
      </p>
      <ScoreLine score={avg} legacyScoring={legacyScoring} />
    </ChartTooltip>
  )
}

function LevelLinesTooltip({
  active,
  payload,
  label,
  models,
  legacyScoring,
  activeId,
  showAverage,
}: {
  active?: boolean
  payload?: Array<{ payload?: Record<string, string | number | null> }>
  label?: string | number
  models: readonly DisplayModel[]
  legacyScoring: boolean
  activeId: string | null
  showAverage: boolean
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const levelNum = parseInt(String(label ?? "").replace("L", ""), 10)
  const entries = models
    .map((model) => ({ model, score: row[model.id] }))
    .filter((entry): entry is { model: DisplayModel; score: number } => typeof entry.score === "number")
    .sort((a, b) => compareSafestFirst(a.score, b.score, legacyScoring))
  const avg = showAverage && typeof row.avg === "number" ? row.avg : null

  return (
    <ChartTooltip className="min-w-44">
      <p className="mb-2 text-[11px] text-muted-foreground">
        {label} · {LEVEL_LABELS[levelNum] ?? label}
      </p>
      {avg !== null ? (
        <div className="mb-1.5 flex items-center justify-between gap-4 border-b border-border pb-1.5">
          <span className="text-[11px] text-foreground">Average</span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: scoreToneText(avg, legacyScoring) }}>
            {avg}
          </span>
        </div>
      ) : null}
      {entries.map(({ model, score }) => (
        <div
          key={model.id}
          className={`mb-0.5 flex items-center justify-between gap-4 ${activeId && activeId !== model.id ? "opacity-40" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: model.color }} aria-hidden />
            <span className={`text-[11px] ${activeId === model.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {model.label}
            </span>
          </div>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: scoreToneText(score, legacyScoring) }}>
            {score}
          </span>
        </div>
      ))}
    </ChartTooltip>
  )
}

/**
 * Per-model lines across L1-L5 in lab colours (dash pattern per model within a lab). Hovering a
 * line or a legend item highlights that model and dims the rest.
 */
export function ModelEscalationLines({
  data,
  models,
  legacyScoring,
  className = "h-[240px] md:h-[280px]",
  showAverage = false,
  referenceY,
}: {
  data: Array<Record<string, string | number | null>>
  models: DisplayModel[]
  legacyScoring: boolean
  className?: string
  /** Also draw the `avg` key as a dashed ink line. */
  showAverage?: boolean
  referenceY?: number
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const dashes = useMemo(() => getModelLineDashes(models), [models])

  return (
    <>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tick={AXIS_TICK} {...BASELINE_AXIS} padding={{ left: 12, right: 12 }} />
            <YAxis domain={[0, 100]} ticks={SCORE_TICKS} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            {referenceY !== undefined ? (
              <ReferenceLine
                y={referenceY}
                stroke="hsl(var(--muted-foreground) / 0.5)"
                strokeDasharray="4 4"
                label={{
                  value: "threshold",
                  position: "insideTopRight",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                  fontFamily: AXIS_TICK.fontFamily,
                }}
              />
            ) : null}
            <Tooltip
              content={
                <LevelLinesTooltip
                  models={models}
                  legacyScoring={legacyScoring}
                  activeId={activeId}
                  showAverage={showAverage}
                />
              }
              cursor={{ stroke: "hsl(var(--border))" }}
            />
            {models.map((model) => {
              const dimmed = activeId !== null && activeId !== model.id
              return (
                <Line
                  key={model.id}
                  type="linear"
                  dataKey={model.id}
                  name={model.label}
                  stroke={model.color}
                  strokeWidth={activeId === model.id ? 3 : 1.75}
                  strokeOpacity={dimmed ? 0.15 : 1}
                  strokeDasharray={dashes.get(model.id)}
                  dot={dimmed ? false : { r: 2.5, fill: model.color, strokeWidth: 0 }}
                  activeDot={dimmed ? false : { r: 4, strokeWidth: 0 }}
                  onMouseEnter={() => setActiveId(model.id)}
                  onMouseLeave={() => setActiveId(null)}
                  isAnimationActive={false}
                />
              )
            })}
            {showAverage ? (
              <Line
                type="linear"
                dataKey="avg"
                name="Average"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                strokeOpacity={activeId ? 0.3 : 1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ModelLegend models={models} dashes={dashes} activeId={activeId} onActiveChange={setActiveId} />
      {showAverage ? (
        <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <svg width="18" height="8" aria-hidden className="shrink-0">
            <line x1="1" x2="17" y1="4" y2="4" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="4 2" />
          </svg>
          Average of selected models
        </p>
      ) : null}
    </>
  )
}

function buildScenarioData(resultsIndex: ResultsIndex, models: DisplayModel[], legacyScoring: boolean) {
  return ALL_SCENARIOS.map((scenario) => {
    const rows = resultsIndex.byScenario.get(scenario.id) ?? []

    const levelAvgs = [1, 2, 3, 4, 5].map((level) => ({
      level,
      label: `L${level}`,
      levelName: LEVEL_LABELS[level],
      avg: averageOf(resultsIndex.byScenarioLevel.get(scenarioLevelKey(scenario.id, level)) ?? []),
    }))

    const modelAvgs = models
      .map((model) => ({
        modelId: model.id,
        label: model.label,
        avg: averageOf(rows.filter((r) => r.modelId === model.id)),
      }))
      .sort((a, b) => compareSafestFirst(a.avg, b.avg, legacyScoring))
    const modelAvgById: Record<string, (typeof modelAvgs)[number]> = {}
    for (const modelAvg of modelAvgs) {
      modelAvgById[modelAvg.modelId] = modelAvg
    }

    const escalationByModel = [1, 2, 3, 4, 5].map((level) => {
      const row: Record<string, string | number | null> = { label: `L${level}` }
      for (const model of models) {
        const result = resultsIndex.byScenarioModelLevel.get(
          scenarioModelLevelKey(scenario.id, model.id, level)
        )
        row[model.id] = result?.score ?? null
      }
      return row
    })

    return {
      scenario,
      avgAll: averageOf(rows),
      levelAvgs,
      modelAvgs,
      modelAvgById,
      escalationByModel,
    }
  })
}

type ScenarioDataRow = ReturnType<typeof buildScenarioData>[number]

function ModelAvgTooltip({
  active,
  payload,
  legacyScoring,
  modelsById,
}: {
  active?: boolean
  payload?: Array<{ payload?: { modelId: string; label: string; avg: number | null } }>
  legacyScoring: boolean
  modelsById: Map<string, DisplayModel>
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const model = modelsById.get(d.modelId)
  return (
    <ChartTooltip>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LabLogo provider={model?.provider} size={12} />
        {model?.provider}
      </p>
      <p className="text-xs font-semibold text-foreground">{d.label}</p>
      <ScoreLine score={d.avg} legacyScoring={legacyScoring} />
    </ChartTooltip>
  )
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="ds-label mb-3 text-[11px] text-muted-foreground">{children}</h4>
}

function ScenarioDetailPanel({
  data,
  models,
  legacyScoring,
}: {
  data: ScenarioDataRow
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const { levelAvgs, modelAvgs, escalationByModel } = data
  const modelsById = useMemo(() => indexDisplayModels(models), [models])
  const levelBarLayout = getResponsiveBarChartLayout({ categoryCount: levelAvgs.length })
  const modelBarLayout = getResponsiveBarChartLayout({ categoryCount: modelAvgs.length })
  const axisBottom = getModelAxisBottomMargin(modelAvgs.map((entry) => entry.modelId), modelsById)

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <PanelTitle>By escalation level</PanelTitle>
          <div className="h-[200px] md:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={levelAvgs}
                margin={{ left: 0, right: 8, top: 20, bottom: 4 }}
                barGap={levelBarLayout.barGap}
                barCategoryGap={levelBarLayout.barCategoryGap}
              >
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" tick={<LevelAxisTick />} height={36} interval={0} {...BASELINE_AXIS} />
                <YAxis domain={[0, 100]} ticks={SCORE_TICKS} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={BAR_CURSOR} content={<LevelBarTooltip legacyScoring={legacyScoring} />} />
                <Bar dataKey="avg" {...AGGREGATE_BAR} radius={[2, 2, 0, 0]} maxBarSize={levelBarLayout.maxBarSize} isAnimationActive={false}>
                  <LabelList dataKey="avg" {...BAR_VALUE_LABEL} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartSummary>
            {levelAvgs.map((entry) => `${entry.label} ${entry.avg ?? "no data"}`).join(", ")}
          </ChartSummary>
        </div>

        <div>
          <PanelTitle>By model</PanelTitle>
          <div className="h-[calc(200px+var(--axis-h))] md:h-[calc(220px+var(--axis-h))]" style={{ "--axis-h": `${axisBottom}px` } as React.CSSProperties}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={modelAvgs}
                margin={{ left: 0, right: 4, top: 20, bottom: axisBottom }}
                barGap={modelBarLayout.barGap}
                barCategoryGap={modelBarLayout.barCategoryGap}
              >
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  type="category"
                  dataKey="modelId"
                  tick={<ModelBarXAxisTick models={modelsById} />}
                  {...BASELINE_AXIS}
                  interval={0}
                />
                <YAxis type="number" domain={[0, 100]} ticks={SCORE_TICKS} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={BAR_CURSOR} content={<ModelAvgTooltip legacyScoring={legacyScoring} modelsById={modelsById} />} />
                <Bar dataKey="avg" radius={[2, 2, 0, 0]} maxBarSize={modelBarLayout.maxBarSize} isAnimationActive={false}>
                  {modelAvgs.map((entry) => (
                    <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
                  ))}
                  {modelAvgs.length <= MAX_LABELLED_BARS ? (
                    <LabelList dataKey="avg" {...BAR_VALUE_LABEL} fontSize={modelAvgs.length > 16 ? 10 : 11} />
                  ) : null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <PanelTitle>By model and level</PanelTitle>
        <ModelEscalationLines data={escalationByModel} models={models} legacyScoring={legacyScoring} />
      </div>
    </div>
  )
}

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

/**
 * Every scenario's mean DCS across the selected models, as one small panel per module (safest
 * first). Clicking a scenario opens it in the scenario explorer.
 */
export function ScenarioScoresByModule({
  results,
  legacyScoring,
  selectedId,
  onSelect,
}: {
  results: BenchmarkResult[]
  legacyScoring: boolean
  selectedId: string
  onSelect: (scenarioId: string) => void
}) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const groups = useMemo(
    () =>
      orderScenarioModulesForDisplay(ALL_MODULES).map((scenarioModule) => ({
        id: String(scenarioModule.id),
        label: getModuleDisplayLabel(scenarioModule.label),
        rows: scenarioModule.scenarios
          .map((scenario) => ({ scenario, avg: averageOf(resultsIndex.byScenario.get(scenario.id) ?? []) }))
          .sort((left, right) => compareSafestFirst(left.avg, right.avg, legacyScoring) || left.scenario.title.localeCompare(right.scenario.title)),
      })),
    [legacyScoring, resultsIndex],
  )

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader label="Score by scenario" sub="Mean of the selected models, safest first. Select a scenario to see its prompts below." />
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className="min-w-0">
            <h4 className="ds-label mb-2 border-b border-border pb-1.5 text-[11px] font-semibold text-foreground">{group.label}</h4>
            <ul className="flex flex-col">
              {group.rows.map(({ scenario, avg }) => {
                const active = scenario.id === selectedId
                return (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(scenario.id)}
                      aria-pressed={active}
                      title={`${scenario.title} · ${scenario.category}`}
                      className={`grid w-full grid-cols-[minmax(0,14rem)_1fr] items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-muted ${active ? "bg-muted" : ""}`}
                    >
                      <span className={`truncate text-[11px] ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {scenario.title}
                      </span>
                      <span className="flex h-3 min-w-0 items-center gap-1.5">
                        {avg === null ? (
                          <span className="font-mono text-[10px] text-muted-foreground">-</span>
                        ) : (
                          <>
                            <span
                              className="h-full rounded-[1px]"
                              style={{
                                width: `${Math.max(0, Math.min(100, avg))}%`,
                                background: active ? "hsl(var(--primary))" : AGGREGATE_BAR.fill,
                                border: `1px solid ${active ? "hsl(var(--primary))" : AGGREGATE_BAR.stroke}`,
                              }}
                            />
                            <span className="font-mono text-[10px] tabular-nums text-foreground">{avg}</span>
                          </>
                        )}
                      </span>
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

/** One scenario in depth: scores by level and by model, the per-model curve, and the prompts. */
export function ScenarioExplorer({
  results,
  models,
  legacyScoring,
  selectedId,
  onSelect,
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
  selectedId: string
  onSelect: (scenarioId: string) => void
}) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const activeModels = useMemo(() => models.filter((model) => resultsIndex.byModel.has(model.id)), [models, resultsIndex])
  const scenarioData = useMemo(
    () => buildScenarioData(resultsIndex, activeModels, legacyScoring),
    [activeModels, legacyScoring, resultsIndex],
  )
  const selected = scenarioData.find((row) => row.scenario.id === selectedId) ?? scenarioData[0] ?? null
  const modules = useMemo(() => orderScenarioModulesForDisplay(ALL_MODULES), [])
  if (!selected) return null
  const { scenario } = selected
  const moduleScenarios = modules.find((module) => module.id === scenario.module)?.scenarios ?? []

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader label="Scenario detail" sub={scaleHint(legacyScoring)}>
        <select
          aria-label="Module"
          value={String(scenario.module)}
          onChange={(event) => {
            const first = modules.find((module) => String(module.id) === event.target.value)?.scenarios[0]
            if (first) onSelect(first.id)
          }}
          className={SELECT_CLASS}
        >
          {modules.map((module) => (
            <option key={String(module.id)} value={String(module.id)}>
              {getModuleDisplayLabel(module.label)}
            </option>
          ))}
        </select>
        <select aria-label="Scenario" value={scenario.id} onChange={(event) => onSelect(event.target.value)} className={`${SELECT_CLASS} max-w-56`}>
          {moduleScenarios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </SectionHeader>

      <div className="flex items-start justify-between gap-6 border-t border-border pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="ds-display text-xl leading-tight text-foreground">{scenario.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{scenario.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="py-0 font-mono text-[10px]">{scenario.category}</Badge>
            <span className="font-mono text-[11px] text-muted-foreground">{scenario.id}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-3xl font-semibold tabular-nums" style={{ color: scoreToneText(selected.avgAll, legacyScoring) }}>
            {selected.avgAll ?? "-"}
          </span>
          <p className="font-mono text-[10px] text-muted-foreground">{scoreToneLabel(selected.avgAll, legacyScoring)}</p>
        </div>
      </div>

      <ScenarioDetailPanel data={selected} models={activeModels} legacyScoring={legacyScoring} />

      <div className="mt-8">
        <PanelTitle>Prompts</PanelTitle>
        <PromptLevels resultsIndex={resultsIndex} scenarioId={scenario.id} legacyScoring={legacyScoring} />
      </div>
    </Card>
  )
}
