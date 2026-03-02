"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { Module } from "@/lib/dystopiabench/types"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  getComplianceDistribution,
  getAggregateByModel,
  getEscalationCurveByModel,
  getChartShape,
} from "@/lib/dystopiabench/analytics"
import {
  MODEL_COLORS, COMPLIANCE_COLORS, COMPLIANCE_NAMES,
  scoreColor, scoreLabel, LEVEL_LABELS,
} from "@/lib/dystopiabench/chart-config"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { PETROV_SCENARIOS, ORWELL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { SectionHeader } from "./section-header"

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
  const moduleResults = results.filter((r) => r.module === module)
  const shape = getChartShape(moduleResults)
  const scenarios = module === "petrov" ? PETROV_SCENARIOS : ORWELL_SCENARIOS
  const activeModels = AVAILABLE_MODELS.filter((model) =>
    selectedModelIds
      ? selectedModelIds.includes(model.id)
      : moduleResults.some((row) => row.modelId === model.id),
  )

  // Model bar data for this module
  const modelData = getAggregateByModel(moduleResults)

  // Escalation curve for this module
  const escalation = getEscalationCurveByModel(moduleResults)

  // Compliance distribution for this module
  const compliance = getComplianceDistribution(moduleResults)

  // Per-scenario avg score (across all models)
  const scenarioData = scenarios.map((s) => {
    const rows = moduleResults.filter((r) => r.scenarioId === s.id)
    const avg = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0
    return { id: s.id, title: s.title, avg, category: s.category }
  })

  // Per-category avg
  const categories = [...new Set(scenarios.map((s) => s.category))]
  const categoryData = categories.map((cat) => {
    const rows = moduleResults.filter((r) => r.scenarioCategory === cat)
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    return { category: cat, avg }
  })

  return (
    <div className="flex flex-col gap-6">

      {/* Model scores (this module) */}
      {shape.hasMultiModel ? (
        <Card className="bg-card border-border p-5">
          <SectionHeader
            label={`Model Avg Score - ${module === "petrov" ? "Petrov" : "Orwell"} Module`}
            sub="Sorted ascending - lower score = stronger refusal = safer."
          />
          <div className="h-[300px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData} margin={{ left: 4, right: 4, top: 4, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  type="category" dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
                  angle={-40} textAnchor="end" interval={0}
                />
                <YAxis
                  type="number" domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} width={28}
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
                <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {modelData.map((entry) => (
                    <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? "#888"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card className="bg-card border-border p-5">
          <SectionHeader
            label="Single Model Mode"
            sub="Model comparison chart hidden because this run has one model."
          />
          <p className="font-mono text-sm text-muted-foreground">
            Scenario and escalation charts remain available for this module.
          </p>
        </Card>
      )}

      {/* Per-scenario bar - full width row */}
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Score by Scenario"
          sub="Average compliance across all models and levels per scenario."
        />
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={scenarioData} margin={{ left: 4, right: 4, top: 4, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              type="category" dataKey="title"
              tick={(props) => {
                const { x, y, payload } = props as { x: number; y: number; payload: { value: string } }
                const words = payload.value.split(' ')
                const mid = Math.ceil(words.length / 2)
                const line1 = words.slice(0, mid).join(' ')
                const line2 = words.slice(mid).join(' ')
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
              axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              interval={0}
            />
            <YAxis
              type="number" domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false} tickLine={false} width={28}
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
            <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {scenarioData.map((entry) => (
                <Cell key={entry.id} fill={scoreColor(entry.avg)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Category + Compliance dist - side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By category */}
        <Card className="bg-card border-border p-5">
          <SectionHeader label="Score by Category" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              />
              <YAxis domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false} tickLine={false} width={28}
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
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {categoryData.map((entry) => (
                  <Cell key={entry.category} fill={scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Compliance distribution */}
        <Card className="bg-card border-border p-5">
          <SectionHeader label="Compliance Tier Distribution" />
          <div className="flex flex-col gap-4 mt-4">
            {compliance.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-sm shrink-0" style={{ background: COMPLIANCE_COLORS[c.key] }} />
                <span className="font-mono text-[10px] text-muted-foreground w-36 shrink-0">{COMPLIANCE_NAMES[c.key]}</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.pct}%`, background: COMPLIANCE_COLORS[c.key] }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Escalation curve for this module */}
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={`Escalation Curve - ${module === "petrov" ? "Petrov" : "Orwell"} Module`}
          sub="How compliance increases under escalating pressure, per model."
        />
        <div className="h-[220px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={escalation} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="level"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false} tickLine={false} width={28}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`${value} (${scoreLabel(value)})`, `${name} DCS`]}
                labelFormatter={(label) => {
                  const levelNum = parseInt(String(label).replace("L", ""), 10)
                  return `${label} – ${LEVEL_LABELS[levelNum] ?? label}`
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              {activeModels.map((m) => (
                <Line
                  key={m.id}
                  type="linear"
                  dataKey={m.id}
                  stroke={MODEL_COLORS[m.id] ?? "#888"}
                  strokeWidth={2}
                  dot={{ r: 3, fill: MODEL_COLORS[m.id] ?? "#888", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name={m.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
          {activeModels.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[m.id] }} />
              <span className="font-mono text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
