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
  scoreColor, scoreLabel,
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
    return { id: s.id, title: s.title.length > 30 ? `${s.title.slice(0, 28)}...` : s.title, avg, category: s.category }
  })

  // Per-category avg
  const categories = [...new Set(scenarios.map((s) => s.category))]
  const categoryData = categories.map((cat) => {
    const rows = moduleResults.filter((r) => r.scenarioCategory === cat)
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    return { category: cat, avg }
  })

  const total = moduleResults.length
  const overallAvg = total > 0 ? Math.round(moduleResults.reduce((s, r) => s + r.score, 0) / total) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Module Tests", value: total, sub: "prompts evaluated" },
          { label: "Module Score", value: overallAvg, sub: scoreLabel(overallAvg), color: scoreColor(overallAvg) },
          { label: "Scenarios", value: scenarios.length, sub: `${categories.length} categories` },
          { label: "Prompts", value: scenarios.length * 5, sub: "5 levels each" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border p-4">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">{kpi.label}</p>
            <p className="font-mono text-2xl font-black" style={{ color: kpi.color ?? "hsl(var(--foreground))" }}>{kpi.value}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* Model scores (this module) */}
      {shape.hasMultiModel ? (
        <Card className="bg-card border-border p-5">
          <SectionHeader
            label={`Model Avg Score - ${module === "petrov" ? "Petrov" : "Orwell"} Module`}
            sub="Sorted ascending - lower score = stronger refusal = safer."
          />
          <div className="h-[220px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number" domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="label" width={100}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} (${scoreLabel(value)})`, "Avg DCS"]}
                  labelFormatter={(label) => `Model: ${label}`}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                />
                <Bar dataKey="avgScore" radius={[0, 3, 3, 0]} maxBarSize={20}>
                  {modelData.map((entry) => (
                    <Cell key={entry.modelId} fill={scoreColor(entry.avgScore)} />
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-scenario bar */}
        <Card className="bg-card border-border p-5">
          <SectionHeader
            label="Score by Scenario"
            sub="Average compliance across all models and levels per scenario."
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scenarioData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number" domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              />
              <YAxis
                type="category" dataKey="title" width={140}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value} (${scoreLabel(value)})`, "Scenario Avg DCS"]}
                labelFormatter={(label) => `Scenario: ${label}`}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={22}>
                {scenarioData.map((entry) => (
                  <Cell key={entry.id} fill={scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Category + Compliance dist */}
        <div className="flex flex-col gap-6">
          {/* By category */}
          <Card className="bg-card border-border p-5">
            <SectionHeader label="Score by Category" />
            <ResponsiveContainer width="100%" height={110}>
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
                  formatter={(value: number) => [`${value} (${scoreLabel(value)})`, "Category Avg DCS"]}
                  labelFormatter={(label) => `Category: ${label}`}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
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
            <div className="flex flex-col gap-2">
              {compliance.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-sm shrink-0" style={{ background: COMPLIANCE_COLORS[c.key] }} />
                  <span className="font-mono text-[10px] text-muted-foreground w-36 shrink-0">{COMPLIANCE_NAMES[c.key]}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${c.pct}%`, background: COMPLIANCE_COLORS[c.key] }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{c.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
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
                labelFormatter={(label) => `Escalation ${label}`}
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
