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
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import type { BenchmarkResult, Module } from "@/lib/dystopiabench/types"
import { MODEL_COLORS, scoreColor, scoreLabel, LEVEL_LABELS, getResponsiveBarChartLayout } from "@/lib/dystopiabench/chart-config"
import { createResultsIndex, type ResultsIndex } from "@/lib/dystopiabench/analytics"
import { Radiation, Eye, Building2, HeartPulse, Boxes } from "lucide-react"
import { SectionHeader } from "./section-header"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
}

const SCENARIO_TICK_MAX_LINE_LENGTH = 16
const SCENARIO_TICK_MAX_LINES = 3
function scenarioLevelKey(scenarioId: string, level: number): string {
  return `${scenarioId}::${level}`
}

function scenarioModelLevelKey(scenarioId: string, modelId: string, level: number): string {
  return `${scenarioId}::${modelId}::${level}`
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

function WrappedTick({
  x,
  y,
  value,
  fontSize,
  lineHeight = 12,
}: {
  x: number
  y: number
  value: string
  fontSize: number
  lineHeight?: number
}) {
  const lines = wrapTickLabel(value)

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={`${value}-${index}`}
          x={0}
          y={0}
          dy={12 + index * lineHeight}
          textAnchor="middle"
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

export function renderModuleIcon(module: Module, className: string) {
  if (module === "petrov") return <Radiation className={className} />
  if (module === "orwell") return <Eye className={className} />
  if (module === "laguardia") return <Building2 className={className} />
  if (module === "basaglia") return <HeartPulse className={className} />
  return <Boxes className={className} />
}

function buildScenarioData(resultsIndex: ResultsIndex, models = AVAILABLE_MODELS) {
  return ALL_SCENARIOS.map((scenario) => {
    const rows = resultsIndex.byScenario.get(scenario.id) ?? []
    const avgAll = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0

    const levelAvgs = [1, 2, 3, 4, 5].map((level) => {
      const levelRows = resultsIndex.byScenarioLevel.get(scenarioLevelKey(scenario.id, level)) ?? []
      return {
        level,
        label: `L${level}`,
        levelName: LEVEL_LABELS[level],
        avg:
          levelRows.length > 0
            ? Math.round(levelRows.reduce((s, r) => s + r.score, 0) / levelRows.length)
            : 0,
      }
    })

    const modelAvgs = models.map((model) => {
      const modelRows = rows.filter((r) => r.modelId === model.id)
      return {
        modelId: model.id,
        label: model.label,
        avg:
          modelRows.length > 0
            ? Math.round(modelRows.reduce((s, r) => s + r.score, 0) / modelRows.length)
            : 0,
      }
    }).sort((a, b) => a.avg - b.avg)

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
      avgAll,
      levelAvgs,
      modelAvgs,
      escalationByModel,
    }
  })
}

type ScenarioDataRow = ReturnType<typeof buildScenarioData>[number]

function ScenarioDetailPanel({
  data,
  models,
}: {
  data: ScenarioDataRow
  models: typeof AVAILABLE_MODELS
}) {
  const { levelAvgs, modelAvgs, escalationByModel } = data
  const levelBarLayout = getResponsiveBarChartLayout({ categoryCount: levelAvgs.length })
  const modelBarLayout = getResponsiveBarChartLayout({ categoryCount: modelAvgs.length })

  return (
    <div className="flex flex-col gap-5 pt-4 border-t border-border mt-1">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Compliance Score (DCS) by Escalation Level — Lower is better
          </p>
          <div className="h-[170px] md:h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={levelAvgs}
                margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                barGap={levelBarLayout.barGap}
                barCategoryGap={levelBarLayout.barCategoryGap}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { label: string; levelName: string; avg: number }
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                        <p className="font-mono text-xs font-bold text-foreground">{d.label} – {d.levelName}</p>
                        <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avg) }}>
                          {d.avg} <span className="text-[10px] font-normal">{scoreLabel(d.avg)}</span>
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={levelBarLayout.maxBarSize}>
                  {levelAvgs.map((entry) => (
                    <Cell key={entry.level} fill={scoreColor(entry.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Compliance Score (DCS) by Model (all levels) — Lower is better
          </p>
          <div className="h-[240px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={modelAvgs}
                margin={{ left: 4, right: 4, top: 4, bottom: 52 }}
                barGap={modelBarLayout.barGap}
                barCategoryGap={modelBarLayout.barCategoryGap}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  type="category"
                  dataKey="label"
                  tick={(props) => {
                    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } }
                    const words = payload.value.split(' ')
                    const mid = Math.ceil(words.length / 2)
                    const line1 = words.slice(0, mid).join(' ')
                    const line2 = words.slice(mid).join(' ')
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-mono)">{line1}</text>
                        {line2 && <text x={0} y={0} dy={22} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-mono)">{line2}</text>}
                      </g>
                    )
                  }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { modelId: string; label: string; avg: number }
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                        <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
                        <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avg) }}>
                          {d.avg} <span className="text-[10px] font-normal">{scoreLabel(d.avg)}</span>
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={modelBarLayout.maxBarSize}>
                  {modelAvgs.map((entry) => (
                    <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? scoreColor(entry.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          Per-Model Escalation Curve (this scenario)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={escalationByModel} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              formatter={(val: number, name: string) => [`${val} (${scoreLabel(val)})`, `${name} DCS`]}
              labelFormatter={(label) => {
                const levelNum = parseInt(String(label).replace("L", ""), 10)
                return `${label} – ${LEVEL_LABELS[levelNum] ?? label}`
              }}
              contentStyle={TOOLTIP_STYLE}
            />
            {models.map((model) => (
              <Line
                key={model.id}
                type="linear"
                dataKey={model.id}
                stroke={MODEL_COLORS[model.id] ?? "#888"}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: MODEL_COLORS[model.id] ?? "#888", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                name={model.label}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AllScenariosBar({ data }: { data: ScenarioDataRow[] }) {
  const chartData = data.map((row) => ({
    id: row.scenario.id,
    title: row.scenario.title,
    avg: row.avgAll,
  }))
  const barLayout = getResponsiveBarChartLayout({
    categoryCount: chartData.length,
    scrollable: true,
  })
  const minChartWidth = barLayout.minChartWidth ?? 960

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="All Scenarios — Average Compliance Score"
        sub="Dystopian Compliance Score (DCS) across all models and all escalation levels per scenario (Lower is better)"
      />
      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: minChartWidth }}>
          <ResponsiveContainer width="100%" height={440}>
            <BarChart
              data={chartData}
              margin={{ left: 4, right: 20, top: 4, bottom: 92 }}
              barGap={barLayout.barGap}
              barCategoryGap={barLayout.barCategoryGap}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                type="category"
                dataKey="title"
                tick={(props) => {
                  const { x, y, payload } = props as { x: number; y: number; payload: { value: string } }
                  return <WrappedTick x={x} y={y} value={payload.value} fontSize={8} />
                }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { id: string; title: string; avg: number }
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">{d.id}</p>
                      <p className="font-mono text-xs font-bold text-foreground">{d.title}</p>
                      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avg) }}>
                        {d.avg} <span className="text-[10px] font-normal">{scoreLabel(d.avg)}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize}>
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

function ScenarioModelGrid({
  data,
  results,
  models,
}: {
  data: ScenarioDataRow[]
  results: BenchmarkResult[]
  models: typeof AVAILABLE_MODELS
}) {
  const grandAverage =
    results.length > 0 ? Math.round(results.reduce((sum, row) => sum + row.score, 0) / results.length) : 0

  return (
    <Card className="bg-card border-border p-3 overflow-x-auto">
      <SectionHeader
        label="Compliance Score Grid — Model × Scenario"
        sub="Dystopian Compliance Score (DCS) per model per scenario. Color = compliance tier (Lower is better)"
      />
      <div className="min-w-max">
        <div className="flex items-end gap-px mb-px">
          <div className="w-72 shrink-0" />
          {models.map((model) => (
            <div key={model.id} className="w-20 relative" style={{ height: 90 }}>
              <span
                className="font-mono text-[8px] text-muted-foreground uppercase tracking-wide whitespace-nowrap absolute"
                style={{
                  bottom: 4,
                  left: "50%",
                  transformOrigin: "left bottom",
                  transform: "rotate(-45deg)",
                }}
              >
                {model.label}
              </span>
            </div>
          ))}
          <div className="w-16 relative" style={{ height: 90 }}>
            <span
              className="font-mono text-[8px] text-muted-foreground uppercase tracking-wide font-bold whitespace-nowrap absolute"
              style={{
                bottom: 4,
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
            <div className="w-72 shrink-0 pr-3 flex items-start justify-end gap-1.5 py-1 text-right">
              {renderModuleIcon(row.scenario.module, "h-2.5 w-2.5 shrink-0 mt-0.5 text-muted-foreground")}
              <span className="font-mono text-[9px] text-muted-foreground leading-tight">
                {row.scenario.title}
              </span>
            </div>

            {models.map((model) => {
              const modelData = row.modelAvgs.find((entry) => entry.modelId === model.id)
              const score = modelData?.avg ?? null
              if (score === null) {
                return (
                  <div
                    key={model.id}
                    className="w-20 h-12 flex items-center justify-center rounded-sm bg-muted/30"
                    title={`${model.label} / ${row.scenario.title}: no data`}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">—</span>
                  </div>
                )
              }
              return (
                <div
                  key={model.id}
                  className="w-20 h-12 flex items-center justify-center rounded-sm"
                  style={{ background: `${scoreColor(score)}28` }}
                  title={`${model.label} / ${row.scenario.title}: ${score}`}
                >
                  <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(score) }}>
                    {score}
                  </span>
                </div>
              )
            })}

            <div
              className="w-16 h-12 flex items-center justify-center rounded-sm"
              style={{ background: `${scoreColor(row.avgAll)}40` }}
            >
              <span className="font-mono text-[10px] font-black" style={{ color: scoreColor(row.avgAll) }}>
                {row.avgAll}
              </span>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-px mt-1 border-t border-border pt-1">
          <div className="w-72 shrink-0">
            <span className="font-mono text-[9px] text-muted-foreground uppercase">Avg</span>
          </div>
          {models.map((model) => {
            const modelRows = results.filter((r) => r.modelId === model.id)
            const avg =
              modelRows.length > 0
                ? Math.round(modelRows.reduce((sum, row) => sum + row.score, 0) / modelRows.length)
                : 0
            return (
              <div key={model.id} className="w-20 h-12 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(avg) }}>
                  {avg}
                </span>
              </div>
            )
          })}
          <div className="w-16 h-12 flex items-center justify-center">
            <span className="font-mono text-[10px] font-black text-foreground">{grandAverage}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ScenarioCharts({
  results,
  selectedModelIds,
}: {
  results: BenchmarkResult[]
  selectedModelIds?: string[]
}) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const activeModels = useMemo(
    () =>
      AVAILABLE_MODELS.filter((model) =>
        selectedModelIds
          ? selectedModelIds.includes(model.id)
          : results.some((row) => row.modelId === model.id),
      ),
    [results, selectedModelIds],
  )
  const scenarioData = useMemo(
    () => buildScenarioData(resultsIndex, activeModels),
    [activeModels, resultsIndex],
  )
  const [selectedId, setSelectedId] = useState<string>(ALL_SCENARIOS[0].id)
  const selectedScenario = useMemo(
    () => scenarioData.find((row) => row.scenario.id === selectedId) ?? scenarioData[0] ?? null,
    [scenarioData, selectedId],
  )

  return (
    <div className="flex flex-col gap-6">
      <AllScenariosBar data={scenarioData} />
      <ScenarioModelGrid
        data={scenarioData}
        results={results}
        models={activeModels}
      />

      <div>
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-4">
          Drill Down by Scenario
        </p>
        <div className="mb-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
            Select Scenario
          </p>
          <div className="flex flex-wrap gap-2">
            {scenarioData.map((row) => (
              <button
                key={row.scenario.id}
                onClick={() => setSelectedId(row.scenario.id)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedScenario?.scenario.id === row.scenario.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {renderModuleIcon(row.scenario.module, "h-3 w-3")}
                {row.scenario.id}
              </button>
            ))}
          </div>
        </div>
        {selectedScenario ? (
          <Card className="bg-card border-border overflow-hidden border-primary/40">
            <div className="p-4 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {renderModuleIcon(selectedScenario.scenario.module, "h-4 w-4 shrink-0 text-muted-foreground mt-0.5")}
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">
                      {selectedScenario.scenario.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="font-mono text-[9px] uppercase py-0">
                        {selectedScenario.scenario.category}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {selectedScenario.scenario.id}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right w-10 shrink-0">
                  <span className="font-mono text-lg font-black" style={{ color: scoreColor(selectedScenario.avgAll) }}>
                    {selectedScenario.avgAll}
                  </span>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {scoreLabel(selectedScenario.avgAll)}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-5">
              <ScenarioDetailPanel data={selectedScenario} models={activeModels} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
