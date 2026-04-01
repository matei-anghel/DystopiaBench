"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  getAggregateByModel,
  getEscalationCurve,
  getEscalationCurveByModel,
  getDRFRByModel,
  getChartShape,
} from "@/lib/dystopiabench/analytics"
import {
  MODEL_COLORS,
  MODULE_COLORS, scoreColor, scoreLabel, LEVEL_LABELS, getResponsiveBarChartLayout,
} from "@/lib/dystopiabench/chart-config"
import { getModelById } from "@/lib/dystopiabench/models"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { SectionHeader } from "./section-header"

function getModuleDisplayLabel(label: string): string {
  return label.replace(/\s+Module$/i, "")
}

function ModelBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; avgScore: number; provider: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-[10px] text-muted-foreground">{d.provider}</p>
      <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avgScore) }}>
        {d.avgScore} <span className="text-[10px] font-normal">{scoreLabel(d.avgScore)}</span>
      </p>
    </div>
  )
}

function EscalationTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const levelNum = parseInt(label?.replace("L", "") || "1", 10)
  return (
    <div className="min-w-40 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">
        {label} - {LEVEL_LABELS[levelNum] ?? label}
      </p>
      {payload
        .slice()
        .sort((a, b) => a.value - b.value)
        .map((entry) => {
          const model = getModelById(String(entry.dataKey))
          return (
            <div key={entry.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? entry.dataKey}</span>
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: entry.color }}>{entry.value}</span>
            </div>
          )
        })}
    </div>
  )
}

function RadarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-40 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">{label}</p>
      {payload
        .slice()
        .sort((a, b) => a.value - b.value)
        .map((entry) => {
          const model = getModelById(String(entry.dataKey))
          return (
            <div key={entry.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? entry.dataKey}</span>
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(entry.value) }}>{entry.value}</span>
            </div>
          )
        })}
    </div>
  )
}

function DRFRTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; drfr: number; provider: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-[10px] text-muted-foreground">{d.provider}</p>
      <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
      <p className="mt-1 font-mono text-sm font-black text-accent">
        {d.drfr}% <span className="text-[10px] font-normal text-muted-foreground">principled refusals</span>
      </p>
    </div>
  )
}

function ModelBarChart({ data }: { data: ReturnType<typeof getAggregateByModel> }) {
  const barLayout = getResponsiveBarChartLayout({ categoryCount: data.length })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Average Dystopian Compliance Score by Model"
        sub="DCS - measures how willingly a model complies with harmful requests (Lower is better)"
      />
      <div className="h-[300px] md:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 4, right: 4, top: 4, bottom: 72 }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category"
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<ModelBarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? "#888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function DRFRChart({ data }: { data: ReturnType<typeof getDRFRByModel> }) {
  const barLayout = getResponsiveBarChartLayout({ categoryCount: data.length })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Directed Refusal Rate by Model"
        sub="DRFR - percentage of harmful prompts the model refused on principle (Higher is better)"
      />
      <div className="h-[300px] md:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 4, right: 4, top: 4, bottom: 72 }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category"
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<DRFRTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="drfr" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? "#888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function EscalationCurveChart({
  data,
  title = "Escalation Curve - All Models",
  sub = "How each model's Dystopian Compliance Score (DCS) changes as pressure escalates from L1 to L5 (Lower is better)",
}: {
  data: ReturnType<typeof getEscalationCurveByModel>
  title?: string
  sub?: string
}) {
  const modelIds = data.length > 0 ? Object.keys(data[0]).filter((key) => key !== "level") : []
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label={title}
        sub={sub}
      />
      <div className="h-[220px] md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="level"
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
            <Tooltip content={<EscalationTooltip />} />
            {modelIds.map((id) => (
              <Line
                key={id}
                type="linear"
                dataKey={id}
                stroke={MODEL_COLORS[id] ?? "#888"}
                strokeWidth={2}
                dot={{ r: 3, fill: MODEL_COLORS[id] ?? "#888", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
        {modelIds.map((id) => {
          const model = getModelById(id)
          return (
            <div key={id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[id] ?? "#888" }} />
              <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? id}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function AggregateEscalationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const levelNum = parseInt(label?.replace("L", "") || "1", 10)
  const value = payload[0]?.value ?? 0

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-[10px] text-muted-foreground">
        {label} - {LEVEL_LABELS[levelNum] ?? label}
      </p>
      <p className="font-mono text-sm font-black" style={{ color: scoreColor(value) }}>
        {value} <span className="text-[10px] font-normal">{scoreLabel(value)}</span>
      </p>
    </div>
  )
}

function ModuleAggregateEscalationCard({
  label,
  data,
}: {
  label: string
  data: ReturnType<typeof getEscalationCurve>
}) {
  const aggregateLineColor = "hsl(var(--destructive))"

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label={`${label} Escalation Curve`}
        sub={`Aggregate DCS across all models from L1 to L5 within ${label} (Lower is better)`}
      />
      <div className="h-[180px] md:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="level"
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
            <Tooltip content={<AggregateEscalationTooltip />} />
            <Line
              type="linear"
              dataKey="avgScore"
              stroke={aggregateLineColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: aggregateLineColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              label={{
                position: "top",
                offset: 8,
                fill: aggregateLineColor,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function ModuleEscalationCurves({ results }: { results: BenchmarkResult[] }) {
  const moduleEntries = ALL_MODULES.map((module) => ({
    id: module.id,
    label: getModuleDisplayLabel(module.label),
    data: getEscalationCurve(results.filter((result) => result.module === module.id)),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {moduleEntries.map((module) => (
          <ModuleAggregateEscalationCard
            key={String(module.id)}
            label={module.label}
            data={module.data}
          />
        ))}
      </div>
    </div>
  )
}

function ModuleComparisonChart({ results }: { results: BenchmarkResult[] }) {
  const moduleEntries = ALL_MODULES.map((module) => ({
    id: module.id,
    label: getModuleDisplayLabel(module.label),
  }))

  const modelIds = [...new Set(results.map((result) => result.modelId))]
  const data = modelIds.map((id) => {
    const model = getModelById(id)
    const row: Record<string, string | number> = { label: model?.label ?? id }
    for (const moduleEntry of moduleEntries) {
      const moduleRows = results.filter((result) => result.modelId === id && result.module === moduleEntry.id)
      row[moduleEntry.id] = moduleRows.length
        ? Math.round(moduleRows.reduce((sum, result) => sum + result.score, 0) / moduleRows.length)
        : 0
    }
    return row
  })
  const barLayout = getResponsiveBarChartLayout({
    categoryCount: data.length,
    seriesCount: moduleEntries.length,
  })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Module Breakdown by Model"
        sub="Average Dystopian Compliance Score (DCS) per module per model (Lower is better)"
      />
      <div className="h-[320px] md:h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 8, right: 12, top: 8, bottom: 76 }}
            barGap={barLayout.barGap}
            barCategoryGap={barLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              angle={-32}
              textAnchor="end"
              interval={0}
              height={72}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as Record<string, string | number>
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                    <p className="mb-2 font-mono text-xs font-bold text-foreground">{String(d.label)}</p>
                    {moduleEntries.map((module) => {
                      const value = Number(d[module.id] ?? 0)
                      return (
                        <div key={module.id} className="mb-0.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: MODULE_COLORS[module.id] ?? "#888" }} />
                            <span className="font-mono text-[10px] text-muted-foreground">{module.label}</span>
                          </div>
                          <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(value) }}>{value}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, paddingTop: 12 }}
              formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>{value}</span>}
            />
            {moduleEntries.map((module) => (
              <Bar
                key={module.id}
                dataKey={module.id}
                name={module.label}
                fill={MODULE_COLORS[module.id] ?? "#888"}
                radius={[3, 3, 0, 0]}
                barSize={barLayout.barSize}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function ModelRadarChart({ results }: { results: BenchmarkResult[] }) {
  const modelIds = [...new Set(results.map((result) => result.modelId))]
  const data = [1, 2, 3, 4, 5].map((level) => {
    const row: Record<string, string | number> = { level: `L${level}\n${LEVEL_LABELS[level]}` }
    for (const id of modelIds) {
      const rows = results.filter((result) => result.modelId === id && result.level === level)
      row[id] = rows.length ? Math.round(rows.reduce((sum, result) => sum + result.score, 0) / rows.length) : 0
    }
    return row
  })

  return (
    <Card className="bg-card border-border px-5 pb-4 pt-4">
      <div className="mb-1">
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">Escalation Radar - All Models</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Dystopian Compliance Score (DCS) by escalation pressure level (Lower is better)</p>
      </div>
      <div className="-mb-10 -mt-4 h-[360px] md:-mb-14 md:-mt-5 md:h-[560px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="92%"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="level"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
            <Tooltip content={<RadarTooltip />} />
            {modelIds.map((id) => {
              const model = getModelById(id)
              return (
                <Radar
                  key={id}
                  name={model?.label ?? id}
                  dataKey={id}
                  stroke={MODEL_COLORS[id] ?? "#888"}
                  fill={MODEL_COLORS[id] ?? "#888"}
                  fillOpacity={0.07}
                  strokeWidth={1.5}
                />
              )
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-0 flex flex-wrap gap-3 border-t border-border pt-2">
        {modelIds.map((id) => {
          const model = getModelById(id)
          return (
            <div key={id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[id] ?? "#888" }} />
              <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? id}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

interface AggregateChartsProps {
  results: BenchmarkResult[]
}

export function AggregateCharts({ results }: AggregateChartsProps) {
  const modelData = getAggregateByModel(results)
  const escalation = getEscalationCurveByModel(results)
  const drfrData = getDRFRByModel(results)
  const shape = getChartShape(results)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ModelBarChart data={modelData} />
        <DRFRChart data={drfrData} />
      </div>

      <ModuleComparisonChart results={results} />

      <EscalationCurveChart data={escalation} />
      <ModuleEscalationCurves results={results} />
      {shape.modelCount >= 3 ? <ModelRadarChart results={results} /> : null}
    </div>
  )
}
