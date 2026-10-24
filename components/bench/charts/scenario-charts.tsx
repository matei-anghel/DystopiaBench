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
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ALL_MODULES, ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  compareSafestFirst,
  scoreDirectionHint,
  scoreTone,
  scoreToneLabel,
  LEVEL_LABELS,
  getResponsiveBarChartLayout,
} from "@/lib/dystopiabench/chart-config"
import { createResultsIndex, type ResultsIndex } from "@/lib/dystopiabench/analytics"
import {
  getModelLineDashes,
  indexDisplayModels,
  type DisplayModel,
} from "@/lib/dystopiabench/display-models"
import { renderModuleIcon } from "../module-icon"
import { ChartSummary, SectionHeader } from "./section-header"
import { LabLogo, ModelBarXAxisTick, ModelLegend } from "./lab-logo"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
}

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }

const SCENARIO_TICK_MAX_LINE_LENGTH = 16
const SCENARIO_TICK_MAX_LINES = 3
const SCENARIO_Y_TICK_MAX_LINE_LENGTH = 28
const SCENARIO_Y_TICK_MAX_LINES = 2
function scenarioLevelKey(scenarioId: string, level: number): string {
  return `${scenarioId}::${level}`
}

function scenarioModelLevelKey(scenarioId: string, modelId: string, level: number): string {
  return `${scenarioId}::${modelId}::${level}`
}

function averageOf(rows: BenchmarkResult[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
}

function wrapTickLabel(value: string, maxLineLength = SCENARIO_TICK_MAX_LINE_LENGTH, maxLines = SCENARIO_TICK_MAX_LINES) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (currentLine && nextLine.length > maxLineLength) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = nextLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length <= maxLines) {
    return lines
  }

  const visibleLines = lines.slice(0, maxLines)
  const finalLine = visibleLines[maxLines - 1] ?? ""
  visibleLines[maxLines - 1] =
    finalLine.length >= maxLineLength ? `${finalLine.slice(0, maxLineLength - 1)}...` : `${finalLine}...`

  return visibleLines
}

function WrappedYAxisTick({
  x = 0,
  y = 0,
  payload,
  fontSize,
  lineHeight = 12,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  fontSize: number
  lineHeight?: number
}) {
  const value = payload?.value ?? ""
  const lines = wrapTickLabel(value, SCENARIO_Y_TICK_MAX_LINE_LENGTH, SCENARIO_Y_TICK_MAX_LINES)

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={`${value}-${index}`}
          x={0}
          y={0}
          dy={(index - (lines.length - 1) / 2) * lineHeight + 3}
          textAnchor="end"
          fill="hsl(var(--muted-foreground))"
          fontSize={fontSize}
          fontFamily="var(--font-mono)"
        >
          {line}
        </text>
      ))}
    </g>
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
  const dashes = useMemo(() => getModelLineDashes(models), [models])
  const levelBarLayout = getResponsiveBarChartLayout({ categoryCount: levelAvgs.length })
  const modelBarLayout = getResponsiveBarChartLayout({ categoryCount: modelAvgs.length })
  const direction = scoreDirectionHint(legacyScoring)

  return (
    <div className="flex flex-col gap-5 pt-4 border-t border-border mt-1">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Compliance Score (DCS) by Escalation Level - {direction}
          </h4>
          <div className="h-[170px] md:h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={levelAvgs}
                margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                barGap={levelBarLayout.barGap}
                barCategoryGap={levelBarLayout.barCategoryGap}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { label: string; levelName: string; avg: number | null }
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                        <p className="font-mono text-xs font-bold text-foreground">{d.label} - {d.levelName}</p>
                        <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreTone(d.avg, legacyScoring) }}>
                          {d.avg ?? "-"} <span className="text-[11px] font-normal">{scoreToneLabel(d.avg, legacyScoring)}</span>
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={levelBarLayout.maxBarSize} isAnimationActive={false}>
                  {levelAvgs.map((entry) => (
                    <Cell key={entry.level} fill={scoreTone(entry.avg, legacyScoring)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartSummary>
            {levelAvgs.map((entry) => `${entry.label} ${entry.avg ?? "no data"}`).join(", ")}
          </ChartSummary>
        </div>

        <div>
          <h4 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Compliance Score (DCS) by Model (all levels) - {direction}
          </h4>
          <div className="h-[280px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={modelAvgs}
                margin={{ left: 24, right: 4, top: 4, bottom: 92 }}
                barGap={modelBarLayout.barGap}
                barCategoryGap={modelBarLayout.barCategoryGap}
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
                <YAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { modelId: string; label: string; avg: number | null }
                    const model = modelsById.get(d.modelId)
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                        <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                          <LabLogo provider={model?.provider} size={12} />
                          {d.label}
                        </p>
                        <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreTone(d.avg, legacyScoring) }}>
                          {d.avg ?? "-"} <span className="text-[11px] font-normal">{scoreToneLabel(d.avg, legacyScoring)}</span>
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={modelBarLayout.maxBarSize} isAnimationActive={false}>
                  {modelAvgs.map((entry) => (
                    <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-3">
          Per-Model Escalation Curve (this scenario)
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={escalationByModel} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              formatter={(val: number, name: string) => [`${val ?? "-"} (${scoreToneLabel(val, legacyScoring)})`, `${name} DCS`]}
              labelFormatter={(label) => {
                const levelNum = parseInt(String(label).replace("L", ""), 10)
                return `${label} - ${LEVEL_LABELS[levelNum] ?? label}`
              }}
              contentStyle={TOOLTIP_STYLE}
            />
            {models.map((model) => (
              <Line
                key={model.id}
                type="linear"
                dataKey={model.id}
                stroke={model.color}
                strokeWidth={1.5}
                strokeDasharray={dashes.get(model.id)}
                dot={{ r: 2.5, fill: model.color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                name={model.label}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <ModelLegend models={models} dashes={dashes} />
      </div>
    </div>
  )
}

function AllScenariosBar({ data, legacyScoring }: { data: ScenarioDataRow[]; legacyScoring: boolean }) {
  const chartData = data
    .map((row) => ({
      id: row.scenario.id,
      title: row.scenario.title,
      avg: row.avgAll,
    }))
    .sort((a, b) => compareSafestFirst(a.avg, b.avg, legacyScoring) || a.title.localeCompare(b.title))
  const chartHeight = Math.max(480, chartData.length * 36)
  const scored = chartData.filter((entry) => entry.avg !== null)

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="All Scenarios - Average Compliance Score"
        sub={`Dystopian Compliance Score (DCS) across the selected models and all escalation levels per scenario, safest first (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="overflow-x-auto pb-2 subtle-x-scrollbar">
        <div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 4, right: 24, top: 8, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={AXIS_TICK}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="title"
                width={240}
                tick={<WrappedYAxisTick fontSize={10} />}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { id: string; title: string; avg: number | null }
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                      <p className="mb-1 font-mono text-[11px] text-muted-foreground">{d.id}</p>
                      <p className="font-mono text-xs font-bold text-foreground">{d.title}</p>
                      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreTone(d.avg, legacyScoring) }}>
                        {d.avg ?? "-"} <span className="text-[11px] font-normal">{scoreToneLabel(d.avg, legacyScoring)}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={scoreTone(entry.avg, legacyScoring)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {scored.length > 1 ? (
        <ChartSummary>
          Safest scenario: {scored[0].title} ({scored[0].avg}). Least safe: {scored[scored.length - 1].title} ({scored[scored.length - 1].avg}).
        </ChartSummary>
      ) : null}
    </Card>
  )
}

function ScenarioModelGrid({
  data,
  results,
  models,
  legacyScoring,
}: {
  data: ScenarioDataRow[]
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const grandAverage = averageOf(results)
  const modelAverages = useMemo(() => {
    const byModel = new Map<string, BenchmarkResult[]>()
    for (const row of results) {
      const rows = byModel.get(row.modelId)
      if (rows) rows.push(row)
      else byModel.set(row.modelId, [row])
    }
    return new Map(models.map((model) => [model.id, averageOf(byModel.get(model.id) ?? [])]))
  }, [models, results])

  const renderCell = (key: string, score: number | null, title: string, className: string, strong = false) => {
    if (score === null) {
      return (
        <div key={key} className={`${className} h-12 flex items-center justify-center rounded-sm bg-muted/30`} title={`${title}: no data`}>
          <span className="font-mono text-[11px] text-muted-foreground">-</span>
        </div>
      )
    }
    const tone = scoreTone(score, legacyScoring)
    return (
      <div
        key={key}
        className={`${className} h-12 flex items-center justify-center rounded-sm`}
        style={{ background: `${tone}${strong ? "40" : "28"}` }}
        title={`${title}: ${score}`}
      >
        <span className={`font-mono text-[11px] ${strong ? "font-black" : "font-bold"}`} style={{ color: tone }}>
          {score}
        </span>
      </div>
    )
  }

  return (
    <Card className="bg-card border-border p-3 overflow-x-auto subtle-x-scrollbar">
      <SectionHeader
        label="Compliance Score Grid - Model x Scenario"
        sub={`Dystopian Compliance Score (DCS) per model per scenario. Colour = compliance tier (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="min-w-max">
        <div className="flex items-end gap-px mb-px">
          <div className="w-64 shrink-0" />
          {models.map((model) => (
            <div key={model.id} className="w-20 relative" style={{ height: 110 }} title={`${model.provider} / ${model.label}`}>
              <span
                className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide whitespace-nowrap absolute"
                style={{
                  bottom: 26,
                  left: "50%",
                  transformOrigin: "left bottom",
                  transform: "rotate(-45deg)",
                }}
              >
                {model.label}
              </span>
              <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2">
                <LabLogo provider={model.provider} size={14} />
              </span>
            </div>
          ))}
          <div className="w-16 relative" style={{ height: 110 }}>
            <span
              className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide font-bold whitespace-nowrap absolute"
              style={{
                bottom: 26,
                left: "50%",
                transformOrigin: "left bottom",
                transform: "rotate(-45deg)",
              }}
            >
              AVG
            </span>
          </div>
        </div>

        {data.map((row) => (
          <div key={row.scenario.id} className="flex items-center gap-px mb-px">
            <div className="w-64 shrink-0 pr-3 flex items-start justify-end gap-1.5 py-1 text-right">
              {renderModuleIcon(row.scenario.module, "h-3 w-3 shrink-0 mt-0.5 text-muted-foreground")}
              <span className="font-mono text-[10px] text-muted-foreground leading-tight">
                {row.scenario.title}
              </span>
            </div>

            {models.map((model) =>
              renderCell(model.id, row.modelAvgById[model.id]?.avg ?? null, `${model.label} / ${row.scenario.title}`, "w-20"),
            )}
            {renderCell("avg", row.avgAll, `${row.scenario.title} average`, "w-16", true)}
          </div>
        ))}

        <div className="flex items-center gap-px mt-1 border-t border-border pt-1">
          <div className="w-64 shrink-0 pr-3 text-right">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">Avg</span>
          </div>
          {models.map((model) =>
            renderCell(model.id, modelAverages.get(model.id) ?? null, `${model.label} average`, "w-20"),
          )}
          {renderCell("grand", grandAverage, "Grand average", "w-16", true)}
        </div>
      </div>
    </Card>
  )
}

const PICKER_BUTTON_CLASS = "flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors"
const pickerButtonState = (selected: boolean) =>
  selected
    ? "border-primary bg-primary/10 text-primary"
    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"

export function ScenarioCharts({
  results,
  models,
  legacyScoring,
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const activeModels = useMemo(
    () => models.filter((model) => resultsIndex.byModel.has(model.id)),
    [models, resultsIndex],
  )
  const scenarioData = useMemo(
    () => buildScenarioData(resultsIndex, activeModels, legacyScoring),
    [activeModels, legacyScoring, resultsIndex],
  )
  const [selectedId, setSelectedId] = useState<string>(ALL_SCENARIOS[0].id)
  const scenarioDataById = useMemo(
    () => new Map(scenarioData.map((row) => [row.scenario.id, row])),
    [scenarioData],
  )
  const selectedScenario = useMemo(
    () => scenarioDataById.get(selectedId) ?? scenarioData[0] ?? null,
    [scenarioData, scenarioDataById, selectedId],
  )
  const scenarioGroups = useMemo(
    () =>
      ALL_MODULES.map((scenarioModule) => ({
        module: scenarioModule,
        rows: scenarioData.filter((row) => row.scenario.module === scenarioModule.id),
      })).filter((group) => group.rows.length > 0),
    [scenarioData],
  )
  const selectedModuleId = selectedScenario?.scenario.module ?? scenarioGroups[0]?.module.id
  const selectedModuleGroup =
    scenarioGroups.find((group) => group.module.id === selectedModuleId) ?? scenarioGroups[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <AllScenariosBar data={scenarioData} legacyScoring={legacyScoring} />
      <ScenarioModelGrid
        data={scenarioData}
        results={results}
        models={activeModels}
        legacyScoring={legacyScoring}
      />

      <div>
        <h3 className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-4">
          Drill Down by Scenario
        </h3>
        <div className="mb-5 flex flex-col gap-4">
          <div role="group" aria-labelledby="scenario-module-picker">
            <p id="scenario-module-picker" className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">
              Select Module
            </p>
            <div className="flex flex-wrap gap-2">
              {scenarioGroups.map((group) => (
                <button
                  key={group.module.id}
                  type="button"
                  aria-pressed={selectedModuleId === group.module.id}
                  onClick={() => {
                    const firstScenario = group.rows[0]
                    if (firstScenario) setSelectedId(firstScenario.scenario.id)
                  }}
                  className={`${PICKER_BUTTON_CLASS} ${pickerButtonState(selectedModuleId === group.module.id)}`}
                >
                  {renderModuleIcon(group.module.id, "h-3 w-3")}
                  {group.module.id}
                </button>
              ))}
            </div>
          </div>
          {selectedModuleGroup ? (
            <div role="group" aria-labelledby="scenario-picker">
              <p id="scenario-picker" className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">
                Select Scenario
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedModuleGroup.rows.map((row) => (
                  <button
                    key={row.scenario.id}
                    type="button"
                    aria-pressed={selectedScenario?.scenario.id === row.scenario.id}
                    onClick={() => setSelectedId(row.scenario.id)}
                    title={row.scenario.title}
                    className={`${PICKER_BUTTON_CLASS} ${pickerButtonState(selectedScenario?.scenario.id === row.scenario.id)}`}
                  >
                    {renderModuleIcon(row.scenario.module, "h-3 w-3")}
                    {row.scenario.id}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {selectedScenario ? (
          <Card className="bg-card border-border overflow-hidden border-primary/40">
            <div className="p-4 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {renderModuleIcon(selectedScenario.scenario.module, "h-4 w-4 shrink-0 text-muted-foreground mt-0.5")}
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground">
                      {selectedScenario.scenario.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase py-0">
                        {selectedScenario.scenario.category}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {selectedScenario.scenario.id}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-lg font-black" style={{ color: scoreTone(selectedScenario.avgAll, legacyScoring) }}>
                    {selectedScenario.avgAll ?? "-"}
                  </span>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {scoreToneLabel(selectedScenario.avgAll, legacyScoring)}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-5">
              <ScenarioDetailPanel data={selectedScenario} models={activeModels} legacyScoring={legacyScoring} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

