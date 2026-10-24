"use client"

import { Fragment, useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  getAggregateByModel,
  getEscalationCurve,
  getEscalationCurveByModel,
  getDRFRByModel,
  createResultsIndex,
} from "@/lib/dystopiabench/analytics"
import {
  compareSafestFirst,
  scoreDirectionHint,
  scoreTone,
  scoreToneLabel,
  LEVEL_LABELS,
  getResponsiveBarChartLayout,
} from "@/lib/dystopiabench/chart-config"
import {
  getModelLineDashes,
  indexDisplayModels,
  type DisplayModel,
} from "@/lib/dystopiabench/display-models"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { orderScenarioModulesForDisplay } from "@/lib/dystopiabench/module-display-order"
import { ChartSummary, SectionHeader } from "./section-header"
import { LabLogo, ModelBarXAxisTick, ModelLegend, ModelName } from "./lab-logo"

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function lerp(start: number, end: number, amount: number): number {
  return Math.round(start + (end - start) * amount)
}

const MODULE_HEATMAP_SUMMARIES: Record<string, string> = {
  petrov: "Military command, autonomous weapons, safety overrides",
  orwell: "Mass surveillance, censorship, population control",
  laguardia: "Civic corruption, contractor capture, patronage",
  basaglia: "Coercive therapy, paternalistic care, outsourced control",
  huxley: "Conditioning, caste systems, pacification",
  baudrillard: "Synthetic AI companions used for fraud and manipulation",
}

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }

/** Green → amber → red ramp where `risk` 0 is safest and 100 least safe. */
function moduleHeatmapColor(risk: number): string {
  const t = Math.max(0, Math.min(1, (risk - 15) / 80))

  if (t < 0.4) {
    const s = t / 0.4
    return `rgb(${lerp(56, 255, s)}, ${lerp(184, 210, s)}, ${lerp(85, 50, s)})`
  }

  if (t < 0.7) {
    const s = (t - 0.4) / 0.3
    return `rgb(${lerp(255, 240, s)}, ${lerp(210, 130, s)}, ${lerp(50, 20, s)})`
  }

  const s = (t - 0.7) / 0.3
  return `rgb(${lerp(240, 195, s)}, ${lerp(130, 30, s)}, ${lerp(20, 28, s)})`
}

function toRisk(score: number, legacyScoring: boolean): number {
  return legacyScoring ? score : 100 - score
}

const HEATMAP_TEXT_COLOR = "#0a0a0a"

const HEATMAP_HEADER_ANGLE_DEG = 34
const HEATMAP_HEADER_CHAR_WIDTH_PX = 7.2
const HEATMAP_HEADER_LINE_HEIGHT_PX = 14

function getHeatmapHeaderHeight(labels: string[]): number {
  const sin = Math.sin((HEATMAP_HEADER_ANGLE_DEG * Math.PI) / 180)
  const cos = Math.cos((HEATMAP_HEADER_ANGLE_DEG * Math.PI) / 180)
  const maxTextWidth = labels.reduce(
    (max, label) => Math.max(max, label.length * HEATMAP_HEADER_CHAR_WIDTH_PX),
    0,
  )
  // Height needed for the rotated label to fully fit when anchored at bottom + safety.
  const needed = Math.ceil(maxTextWidth * sin + HEATMAP_HEADER_LINE_HEIGHT_PX * cos)
  return needed + 14
}

function averageOf(rows: BenchmarkResult[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
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
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <LabLogo provider={model?.provider} size={12} />
        {model?.provider}
      </p>
      <p className="font-mono text-xs font-bold text-foreground">{model?.label ?? d.modelId}</p>
      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreTone(d.avgScore, legacyScoring) }}>
        {d.avgScore} <span className="text-[11px] font-normal">DCS - {scoreToneLabel(d.avgScore, legacyScoring)}</span>
      </p>
    </div>
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
    <div className="min-w-40 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-2 font-mono text-[11px] text-muted-foreground">
        {String(label ?? "").split("\n")[0]} - {LEVEL_LABELS[levelNum] ?? label}
      </p>
      {payload
        .filter((entry): entry is typeof entry & { value: number } => typeof entry.value === "number")
        .sort((a, b) => compareSafestFirst(a.value, b.value, legacyScoring))
        .map((entry) => {
          const model = modelsById.get(String(entry.dataKey))
          return (
            <div key={entry.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <LabLogo provider={model?.provider} size={11} />
                <span className="font-mono text-[11px] text-muted-foreground">{model?.label ?? entry.dataKey}</span>
              </div>
              <span className="font-mono text-[11px] font-bold" style={{ color: scoreTone(entry.value, legacyScoring) }}>
                {entry.value}
              </span>
            </div>
          )
        })}
    </div>
  )
}

function DRFRTooltip({
  active,
  payload,
  modelsById,
}: {
  active?: boolean
  payload?: Array<{ payload: { modelId: string; drfr: number } }>
  modelsById: Map<string, DisplayModel>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const model = modelsById.get(d.modelId)
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <LabLogo provider={model?.provider} size={12} />
        {model?.provider}
      </p>
      <p className="font-mono text-xs font-bold text-foreground">{model?.label ?? d.modelId}</p>
      <p className="mt-1 font-mono text-sm font-black text-accent">
        {d.drfr}% <span className="text-[11px] font-normal text-muted-foreground">principled refusals</span>
      </p>
    </div>
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
  const safest = data[0]
  const leastSafe = data[data.length - 1]
  const nameOf = (modelId: string) => modelsById.get(modelId)?.label ?? modelId

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Average Dystopian Compliance Score by Model"
        sub={`DCS - how willingly a model complies with harmful requests, safest first (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="h-[320px] md:h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 24, right: 4, top: 4, bottom: 92 }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category"
              dataKey="modelId"
              tick={<ModelBarXAxisTick models={modelsById} />}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<ModelBarTooltip legacyScoring={legacyScoring} modelsById={modelsById} />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            />
            <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
              ))}
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

function DRFRChart({
  data,
  modelsById,
}: {
  data: ReturnType<typeof getDRFRByModel>
  modelsById: Map<string, DisplayModel>
}) {
  const barLayout = getResponsiveBarChartLayout({ categoryCount: data.length })
  const highest = data[0]
  const lowest = data[data.length - 1]
  const nameOf = (modelId: string) => modelsById.get(modelId)?.label ?? modelId

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Directed Refusal Rate by Model"
        sub="DRFR - percentage of responses rated a principled refusal (Higher is better)"
      />
      <div className="h-[320px] md:h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 24, right: 4, top: 4, bottom: 92 }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category"
              dataKey="modelId"
              tick={<ModelBarXAxisTick models={modelsById} />}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<DRFRTooltip modelsById={modelsById} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="drfr" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {highest && lowest && data.length > 1 ? (
        <ChartSummary>
          Most refusals: {nameOf(highest.modelId)} ({highest.drfr}%). Fewest: {nameOf(lowest.modelId)} ({lowest.drfr}%).
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
        label="Escalation Curve - All Models"
        sub={`How each model's Dystopian Compliance Score (DCS) changes as pressure escalates from L1 to L5 (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="h-[240px] md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="level" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<ModelLinesTooltip legacyScoring={legacyScoring} modelsById={modelsById} />} />
            {models.map((model) => (
              <Line
                key={model.id}
                type="linear"
                dataKey={model.id}
                stroke={model.color}
                strokeWidth={2}
                strokeDasharray={dashes.get(model.id)}
                dot={{ r: 3, fill: model.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {startMean !== null && endMean !== null ? (
        <ChartSummary>
          Across the selected models the mean DCS moves from {startMean} at L1 to {endMean} at L5.
        </ChartSummary>
      ) : null}
      <ModelLegend models={models} dashes={dashes} />
    </Card>
  )
}

function AggregateEscalationTooltip({
  active,
  payload,
  label,
  legacyScoring,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; color: string }>
  label?: string
  legacyScoring: boolean
}) {
  if (!active || !payload?.length) return null
  const levelNum = parseInt(label?.replace("L", "") || "1", 10)
  const value = payload[0]?.value ?? null

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-[11px] text-muted-foreground">
        {label} - {LEVEL_LABELS[levelNum] ?? label}
      </p>
      <p className="font-mono text-sm font-black" style={{ color: scoreTone(value, legacyScoring) }}>
        {value ?? "-"} <span className="text-[11px] font-normal">{scoreToneLabel(value, legacyScoring)}</span>
      </p>
    </div>
  )
}

function ModuleAggregateEscalationCard({
  label,
  data,
  legacyScoring,
}: {
  label: string
  data: ReturnType<typeof getEscalationCurve>
  legacyScoring: boolean
}) {
  const aggregateLineColor = "hsl(var(--destructive))"
  const values = data.map((row) => row.avgScore)

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label={`${label} Escalation Curve`}
        sub={`Average DCS across the selected models from L1 to L5 within ${label} (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="h-[180px] md:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="level" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<AggregateEscalationTooltip legacyScoring={legacyScoring} />} />
            <Line
              type="linear"
              dataKey="avgScore"
              stroke={aggregateLineColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: aggregateLineColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              label={{
                position: "top",
                offset: 8,
                fill: aggregateLineColor,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        {label} average DCS by level: {data.map((row, index) => `${row.level} ${values[index] ?? "no data"}`).join(", ")}.
      </p>
    </Card>
  )
}

function ModuleEscalationCurves({ results, legacyScoring }: { results: BenchmarkResult[]; legacyScoring: boolean }) {
  const moduleEntries = useMemo(
    () =>
      orderScenarioModulesForDisplay(ALL_MODULES).map((module) => ({
        id: module.id,
        label: getModuleDisplayLabel(module.label),
        data: getEscalationCurve(results.filter((result) => result.module === module.id)),
      })),
    [results],
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {moduleEntries.map((module) => (
        <ModuleAggregateEscalationCard
          key={String(module.id)}
          label={module.label}
          data={module.data}
          legacyScoring={legacyScoring}
        />
      ))}
    </div>
  )
}

function ModuleComparisonChart({
  results,
  models,
  legacyScoring,
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const [breakdownMode, setBreakdownMode] = useState<"module" | "category">("module")
  const [sortKey, setSortKey] = useState<string>("avg")
  const moduleEntries = useMemo(
    () =>
      orderScenarioModulesForDisplay(ALL_MODULES).map((module) => ({
        id: String(module.id),
        label: getModuleDisplayLabel(module.label),
        summary: MODULE_HEATMAP_SUMMARIES[String(module.id)] ?? module.description,
      })),
    [],
  )
  const categoryEntries = useMemo(() => {
    const categoryOrder = new Map<string, { modules: Set<string>; scenarioCount: number }>()

    for (const scenarioModule of orderScenarioModulesForDisplay(ALL_MODULES)) {
      for (const scenario of scenarioModule.scenarios) {
        const entry = categoryOrder.get(scenario.category) ?? {
          modules: new Set<string>(),
          scenarioCount: 0,
        }
        entry.modules.add(getModuleDisplayLabel(scenarioModule.label))
        entry.scenarioCount += 1
        categoryOrder.set(scenario.category, entry)
      }
    }

    for (const result of results) {
      if (categoryOrder.has(result.scenarioCategory)) continue
      categoryOrder.set(result.scenarioCategory, {
        modules: new Set([String(result.module)]),
        scenarioCount: 1,
      })
    }

    return Array.from(categoryOrder.entries()).map(([category, meta]) => ({
      id: category,
      label: category,
      summary: `${meta.scenarioCount} scenario${meta.scenarioCount === 1 ? "" : "s"} across ${Array.from(meta.modules).join(", ")}`,
    }))
  }, [results])
  const heatmapEntries = breakdownMode === "module" ? moduleEntries : categoryEntries

  const modelEntries = useMemo(() => {
    const rowsByModel = new Map<string, BenchmarkResult[]>()
    for (const result of results) {
      const rows = rowsByModel.get(result.modelId)
      if (rows) rows.push(result)
      else rowsByModel.set(result.modelId, [result])
    }

    return models.map((model) => {
      const allModelRows = rowsByModel.get(model.id) ?? []
      const moduleScores = new Map<string, number>()
      const categoryScores = new Map<string, number>()

      for (const moduleEntry of moduleEntries) {
        const score = averageOf(allModelRows.filter((result) => String(result.module) === moduleEntry.id))
        if (score !== null) moduleScores.set(moduleEntry.id, score)
      }

      for (const categoryEntry of categoryEntries) {
        const score = averageOf(allModelRows.filter((result) => result.scenarioCategory === categoryEntry.id))
        if (score !== null) categoryScores.set(categoryEntry.id, score)
      }

      return {
        model,
        id: model.id,
        label: model.label,
        provider: model.provider,
        avgScore: averageOf(allModelRows),
        moduleScores,
        categoryScores,
      }
    })
  }, [categoryEntries, moduleEntries, models, results])

  const sortedModelEntries = useMemo(() => {
    return modelEntries.slice().sort((left, right) => {
      const leftScores = breakdownMode === "module" ? left.moduleScores : left.categoryScores
      const rightScores = breakdownMode === "module" ? right.moduleScores : right.categoryScores
      const leftScore = sortKey === "avg" ? left.avgScore : leftScores.get(sortKey)
      const rightScore = sortKey === "avg" ? right.avgScore : rightScores.get(sortKey)
      return compareSafestFirst(leftScore, rightScore, legacyScoring) || left.label.localeCompare(right.label)
    })
  }, [breakdownMode, legacyScoring, modelEntries, sortKey])

  const getCellTitle = (modelLabel: string, moduleLabel: string, score: number | null) => {
    if (score == null) return `${modelLabel} | ${moduleLabel}: no data`
    return `${modelLabel} | ${moduleLabel}: ${score} DCS (${scoreDirectionHint(legacyScoring).toLowerCase()})`
  }

  const heatmapColumnWidth =
    breakdownMode === "module"
      ? "minmax(5.75rem, 7.25rem)"
      : "minmax(5.5rem, 7rem)"
  const heatmapOverallColumnWidth = breakdownMode === "module" ? "minmax(5.75rem, 7.25rem)" : "minmax(5.5rem, 7rem)"
  const heatmapHeaderHeightPx = useMemo(
    () => getHeatmapHeaderHeight([...heatmapEntries.map((entry) => entry.label), "Overall"]),
    [heatmapEntries],
  )
  const heatmapGridTemplateColumns = `minmax(9.75rem, 13rem) repeat(${heatmapEntries.length}, ${heatmapColumnWidth}) ${heatmapOverallColumnWidth}`

  const renderScoreCell = (
    key: string,
    score: number | null,
    title: string,
    options: { overall?: boolean } = {},
  ) => {
    if (score == null) {
      return (
        <div
          key={key}
          className={`flex h-10 w-full items-center justify-center rounded-sm bg-muted/25 font-mono text-[11px] text-muted-foreground ${
            options.overall ? "border-l border-border/80" : ""
          }`}
          title={title}
        >
          -
        </div>
      )
    }

    return (
      <div
        key={key}
        className={`flex h-10 w-full items-center justify-center rounded-sm font-mono text-[11px] font-bold tabular-nums ${
          options.overall ? "border-l border-border/80" : ""
        }`}
        style={{
          background: moduleHeatmapColor(toRisk(score, legacyScoring)),
          color: HEATMAP_TEXT_COLOR,
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.07)",
        }}
        title={title}
      >
        {score}
      </div>
    )
  }

  const breakdownButtonClass = (active: boolean) =>
    `h-6 rounded px-2 font-mono text-[11px] transition-colors ${
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Module Breakdown by Model"
          sub={`Average Dystopian Compliance Score (DCS) per module per model, safest at the top (${scoreDirectionHint(legacyScoring)})`}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleEntries.map((moduleEntry) => {
            const rows = modelEntries
              .map((modelEntry) => ({
                model: modelEntry.model,
                score: modelEntry.moduleScores.get(String(moduleEntry.id)) ?? null,
              }))
              .sort((left, right) =>
                compareSafestFirst(left.score, right.score, legacyScoring) || left.model.label.localeCompare(right.model.label),
              )

            return (
              <div key={moduleEntry.id} className="rounded-lg border border-border bg-background/35 p-3">
                <h4 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wide text-foreground">
                  {moduleEntry.label}
                </h4>
                <div className="flex flex-col gap-1.5">
                  {rows.map((row) => {
                    const score = row.score
                    const width = score == null ? 0 : clampScore(score)

                    return (
                      <div key={row.model.id} className="flex min-w-0 items-center gap-2">
                        <span
                          className="w-32 shrink-0 truncate text-right font-mono text-[11px] text-muted-foreground"
                          title={`${row.model.provider} / ${row.model.label}`}
                        >
                          {row.model.label}
                        </span>
                        <LabLogo provider={row.model.provider} size={12} />
                        <div
                          className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-muted/35"
                          title={getCellTitle(row.model.label, moduleEntry.label, score)}
                        >
                          {score == null ? null : (
                            <div
                              className="flex h-full items-center justify-end rounded px-1 font-mono text-[10px] font-bold"
                              style={{
                                width: `${width}%`,
                                minWidth: "1.75rem",
                                background: moduleHeatmapColor(toRisk(score, legacyScoring)),
                                color: HEATMAP_TEXT_COLOR,
                              }}
                            >
                              {score}
                            </div>
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

      <Card className="bg-card border-border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            label="Aggregate Score Heatmap"
            sub={`Average Dystopian Compliance Score (DCS) by model and ${breakdownMode}, sorted safest to least safe by default (${scoreDirectionHint(legacyScoring)})`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span id="module-comparison-columns" className="font-mono text-[11px] text-muted-foreground">Columns</span>
            <div className="flex rounded border border-border p-0.5" role="group" aria-labelledby="module-comparison-columns">
              <button
                type="button"
                aria-pressed={breakdownMode === "module"}
                onClick={() => {
                  setBreakdownMode("module")
                  setSortKey("avg")
                }}
                className={breakdownButtonClass(breakdownMode === "module")}
              >
                Modules
              </button>
              <button
                type="button"
                aria-pressed={breakdownMode === "category"}
                onClick={() => {
                  setBreakdownMode("category")
                  setSortKey("avg")
                }}
                className={breakdownButtonClass(breakdownMode === "category")}
              >
                Categories
              </button>
            </div>
            <label htmlFor="module-comparison-sort" className="font-mono text-[11px] text-muted-foreground">
              Sort by
            </label>
            <select
              id="module-comparison-sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
              className="h-7 rounded border border-border bg-background px-2 font-mono text-[11px] text-foreground"
            >
              <option value="avg">Overall score</option>
              {heatmapEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto subtle-x-scrollbar pb-2">
          <div className="rounded-md border border-border/70 bg-card p-2">
            <div
              className="grid w-full gap-x-2"
              style={{
                gridTemplateColumns: heatmapGridTemplateColumns,
                justifyContent: "space-between",
                height: heatmapHeaderHeightPx,
                marginBottom: 6,
              }}
            >
              <div className="sticky left-0 z-20 h-full rounded-sm bg-card" />
              {heatmapEntries.map((entry) => (
                <div key={entry.id} className="relative h-full" title={entry.label}>
                  <span
                    className="absolute font-mono text-[11px] font-semibold uppercase whitespace-nowrap text-muted-foreground"
                    style={{
                      bottom: 0,
                      left: "50%",
                      transformOrigin: "left bottom",
                      transform: `rotate(-${HEATMAP_HEADER_ANGLE_DEG}deg)`,
                    }}
                  >
                    {entry.label}
                  </span>
                </div>
              ))}
              <div className="relative flex h-full items-end justify-center border-l border-border/80 px-1 pb-0.5">
                <span className="font-mono text-[11px] font-bold uppercase whitespace-nowrap text-foreground">
                  Overall
                </span>
              </div>
            </div>

            {/* Heatmap body */}
            <div
              className="grid w-full gap-x-2 gap-y-1.5"
              style={{
                gridTemplateColumns: heatmapGridTemplateColumns,
                justifyContent: "space-between",
              }}
            >
              {sortedModelEntries.map((modelEntry) => (
                <Fragment key={modelEntry.id}>
                  <div className="sticky left-0 z-10 flex h-10 min-w-0 items-center rounded-sm bg-card px-2 font-mono text-[11px] font-semibold text-foreground">
                    <ModelName model={modelEntry.model} size={13} />
                  </div>
                  {heatmapEntries.map((entry) => {
                    const scoreMap = breakdownMode === "module" ? modelEntry.moduleScores : modelEntry.categoryScores
                    const score = scoreMap.get(entry.id) ?? null
                    return renderScoreCell(
                      `${modelEntry.id}-${entry.id}`,
                      score,
                      getCellTitle(modelEntry.label, entry.label, score),
                    )
                  })}
                  {renderScoreCell(
                    `${modelEntry.id}-overall`,
                    modelEntry.avgScore,
                    getCellTitle(modelEntry.label, "Overall", modelEntry.avgScore),
                    { overall: true },
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        {breakdownMode === "module" ? (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {heatmapEntries.map((entry) => (
              <div key={entry.id} className="min-w-0">
                <p className="font-mono text-[11px] font-bold uppercase text-foreground">{entry.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{entry.summary}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function ModelRadarChart({
  results,
  models,
  modelsById,
  legacyScoring,
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  modelsById: Map<string, DisplayModel>
  legacyScoring: boolean
}) {
  const { data, plottedModels } = useMemo(() => {
    const rows = getEscalationCurveByModel(results)
    // A radar polygon needs a value on every axis; models missing a level are left out.
    const complete = models.filter((model) => rows.every((row) => typeof row[model.id] === "number"))
    return {
      plottedModels: complete,
      data: rows.map((row, index) => ({ ...row, level: `L${index + 1}\n${LEVEL_LABELS[index + 1]}` })),
    }
  }, [models, results])
  const dashes = useMemo(() => getModelLineDashes(plottedModels), [plottedModels])

  return (
    <Card className="bg-card border-border px-5 pb-4 pt-4">
      <SectionHeader
        label="Escalation Radar - All Models"
        sub={`Dystopian Compliance Score (DCS) by escalation pressure level (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="-mb-10 -mt-6 h-[360px] md:-mb-14 md:-mt-7 md:h-[560px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="level" tick={AXIS_TICK} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
            <Tooltip content={<ModelLinesTooltip legacyScoring={legacyScoring} modelsById={modelsById} />} />
            {plottedModels.map((model) => (
              <Radar
                key={model.id}
                name={model.label}
                dataKey={model.id}
                stroke={model.color}
                strokeDasharray={dashes.get(model.id)}
                fill={model.color}
                fillOpacity={0.07}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <ModelLegend models={plottedModels} dashes={dashes} className="mt-0 pt-2" />
    </Card>
  )
}

interface AggregateChartsProps {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
  showDirectedRefusalRate?: boolean
}

export function AggregateCharts({ results, models, legacyScoring, showDirectedRefusalRate = false }: AggregateChartsProps) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const modelsById = useMemo(() => indexDisplayModels(models), [models])
  const modelsWithData = useMemo(
    () => models.filter((model) => resultsIndex.byModel.has(model.id)),
    [models, resultsIndex],
  )
  const modelData = useMemo(
    () =>
      getAggregateByModel(results, resultsIndex).sort(
        (left, right) => compareSafestFirst(left.avgScore, right.avgScore, legacyScoring),
      ),
    [legacyScoring, results, resultsIndex],
  )
  const escalation = useMemo(() => getEscalationCurveByModel(results, resultsIndex), [results, resultsIndex])
  const drfrData = useMemo(() => getDRFRByModel(results, resultsIndex), [results, resultsIndex])

  return (
    <div className="flex flex-col gap-6">
      <div className={`grid gap-6 ${showDirectedRefusalRate ? "lg:grid-cols-2" : ""}`}>
        <ModelBarChart data={modelData} modelsById={modelsById} legacyScoring={legacyScoring} />
        {showDirectedRefusalRate ? <DRFRChart data={drfrData} modelsById={modelsById} /> : null}
      </div>

      <ModuleComparisonChart results={results} models={modelsWithData} legacyScoring={legacyScoring} />

      <EscalationCurveChart data={escalation} models={modelsWithData} modelsById={modelsById} legacyScoring={legacyScoring} />
      <ModuleEscalationCurves results={results} legacyScoring={legacyScoring} />
      {modelsWithData.length >= 3 ? (
        <ModelRadarChart results={results} models={modelsWithData} modelsById={modelsById} legacyScoring={legacyScoring} />
      ) : null}
    </div>
  )
}
