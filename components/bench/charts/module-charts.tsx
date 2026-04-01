"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult, Module } from "@/lib/dystopiabench/types"
import {
  getComplianceDistribution,
  getAggregateByModel,
  getEscalationCurveByModel,
} from "@/lib/dystopiabench/analytics"
import {
  MODEL_COLORS, COMPLIANCE_COLORS, COMPLIANCE_NAMES,
  scoreColor, scoreLabel, LEVEL_LABELS, getResponsiveBarChartLayout,
} from "@/lib/dystopiabench/chart-config"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { getModuleById } from "@/lib/dystopiabench/scenarios"
import { SectionHeader } from "./section-header"
import { ModuleLevelHeatmap } from "./module-heatmap"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
}

interface Props {
  module: Module
  results: BenchmarkResult[]
  selectedModelIds?: string[]
}

export function ModuleCharts({ module, results, selectedModelIds }: Props) {
  const scenarioModule = getModuleById(module)
  const moduleResults = results.filter((r) => r.module === module)
  const scenarios = scenarioModule?.scenarios ?? []
  const moduleLabel = scenarioModule?.label ?? String(module)
  const activeModels = AVAILABLE_MODELS.filter((model) =>
    selectedModelIds
      ? selectedModelIds.includes(model.id)
      : moduleResults.some((row) => row.modelId === model.id),
  )

  const modelData = getAggregateByModel(moduleResults)
  const escalation = getEscalationCurveByModel(moduleResults)
  const compliance = getComplianceDistribution(moduleResults)

  const scenarioData = scenarios.map((scenario) => {
    const rows = moduleResults.filter((result) => result.scenarioId === scenario.id)
    const avg = rows.length ? Math.round(rows.reduce((sum, result) => sum + result.score, 0) / rows.length) : 0
    return { id: scenario.id, title: scenario.title, avg, category: scenario.category }
  })

  const categories = [...new Set(scenarios.map((scenario) => scenario.category))]
  const categoryData = categories.map((category) => {
    const rows = moduleResults.filter((result) => result.scenarioCategory === category)
    const avg = rows.length ? Math.round(rows.reduce((sum, result) => sum + result.score, 0) / rows.length) : 0
    return { category, avg }
  })
  const modelBarLayout = getResponsiveBarChartLayout({ categoryCount: modelData.length })
  const scenarioBarLayout = getResponsiveBarChartLayout({ categoryCount: scenarioData.length })
  const categoryBarLayout = getResponsiveBarChartLayout({ categoryCount: categoryData.length })

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={`Model Avg Compliance Score - ${moduleLabel}`}
          sub="Dystopian Compliance Score (DCS) sorted ascending (Lower is better)"
        />
        <div className="h-[300px] md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={modelData}
              margin={{ left: 4, right: 4, top: 4, bottom: 72 }}
              barGap={modelBarLayout.barGap}
              barCategoryGap={modelBarLayout.barCategoryGap}
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
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { label: string; avgScore: number; modelId: string; provider: string }
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                      <p className="mb-1 font-mono text-[10px] text-muted-foreground">{d.provider}</p>
                      <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
                      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avgScore) }}>
                        {d.avgScore} <span className="text-[10px] font-normal">{scoreLabel(d.avgScore)}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={modelBarLayout.maxBarSize}>
                {modelData.map((entry) => (
                  <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? "#888"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Compliance Score by Scenario"
          sub="Avg Dystopian Compliance Score (DCS) across all models and levels per scenario (Lower is better)"
        />
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={scenarioData}
            margin={{ left: 4, right: 4, top: 4, bottom: 64 }}
            barGap={scenarioBarLayout.barGap}
            barCategoryGap={scenarioBarLayout.barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category"
              dataKey="title"
              tick={(props) => {
                const { x, y, payload } = props as { x: number; y: number; payload: { value: string } }
                const words = payload.value.split(" ")
                const mid = Math.ceil(words.length / 2)
                const line1 = words.slice(0, mid).join(" ")
                const line2 = words.slice(mid).join(" ")
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-mono)">
                      {line1}
                    </text>
                    {line2 && (
                      <text x={0} y={0} dy={22} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-mono)">
                        {line2}
                      </text>
                    )}
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
                const d = payload[0].payload as { id: string; title: string; avg: number; category: string }
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                    <p className="mb-1 font-mono text-[10px] text-muted-foreground">{d.category}</p>
                    <p className="font-mono text-xs font-bold text-foreground">{d.title}</p>
                    <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avg) }}>
                      {d.avg} <span className="text-[10px] font-normal">{scoreLabel(d.avg)}</span>
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={scenarioBarLayout.maxBarSize}>
              {scenarioData.map((entry) => (
                <Cell key={entry.id} fill={scoreColor(entry.avg)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border p-5">
          <SectionHeader label="Compliance Score by Category" sub="DCS averaged per category (Lower is better)" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={categoryData}
              margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
              barGap={categoryBarLayout.barGap}
              barCategoryGap={categoryBarLayout.barCategoryGap}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
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
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { category: string; avg: number }
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                      <p className="font-mono text-xs font-bold text-foreground">{d.category}</p>
                      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(d.avg) }}>
                        {d.avg} <span className="text-[10px] font-normal">{scoreLabel(d.avg)}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={categoryBarLayout.maxBarSize}>
                {categoryData.map((entry) => (
                  <Cell key={entry.category} fill={scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-card border-border p-5">
          <SectionHeader label="Compliance Tier Distribution" sub="Share of responses across DCS tiers - more Refusals is better" />
          <div className="mt-4 flex flex-col gap-4">
            {compliance.map((entry) => (
              <div key={entry.key} className="flex items-center gap-3">
                <div className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COMPLIANCE_COLORS[entry.key] }} />
                <span className="w-36 shrink-0 font-mono text-[10px] text-muted-foreground">{COMPLIANCE_NAMES[entry.key]}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${entry.pct}%`, background: COMPLIANCE_COLORS[entry.key] }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{entry.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={`Escalation Curve - ${moduleLabel}`}
          sub="How Dystopian Compliance Score (DCS) changes under escalating pressure, per model (Lower is better)"
        />
        <div className="h-[220px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={escalation} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
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
              <Tooltip
                formatter={(value: number, name: string) => [`${value} (${scoreLabel(value)})`, `${name} DCS`]}
                labelFormatter={(label) => {
                  const levelNum = parseInt(String(label).replace("L", ""), 10)
                  return `${label} - ${LEVEL_LABELS[levelNum] ?? label}`
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              {activeModels.map((model) => (
                <Line
                  key={model.id}
                  type="linear"
                  dataKey={model.id}
                  stroke={MODEL_COLORS[model.id] ?? "#888"}
                  strokeWidth={2}
                  dot={{ r: 3, fill: MODEL_COLORS[model.id] ?? "#888", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name={model.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
          {activeModels.map((model) => (
            <div key={model.id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[model.id] ?? "#888" }} />
              <span className="font-mono text-[10px] text-muted-foreground">{model.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          label={`${moduleLabel} Heatmap`}
          sub="Rows are scenarios, columns are models, each cell is split into L1–L5 compliance segments."
        />
        <div className="mt-2">
          <ModuleLevelHeatmap
            module={module}
            results={results}
            selectedModelIds={selectedModelIds}
          />
        </div>
      </div>
    </div>
  )
}
