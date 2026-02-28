"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import {
  getAggregateByModel,
  getEscalationCurveByModel,
  getComplianceDistribution,
  getDRFR,
  getDRFRByModel,
} from "@/lib/dystopiabench/analytics"
import {
  MODEL_COLORS, COMPLIANCE_COLORS, COMPLIANCE_NAMES,
  MODULE_COLORS, scoreColor, scoreLabel, LEVEL_LABELS,
} from "@/lib/dystopiabench/chart-config"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { SectionHeader } from "./section-header"

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function ModelBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; avgScore: number; provider: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] text-muted-foreground mb-1">{d.provider}</p>
      <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
      <p className="font-mono text-sm font-black mt-1" style={{ color: scoreColor(d.avgScore) }}>
        {d.avgScore} <span className="text-[10px] font-normal">{scoreLabel(d.avgScore)}</span>
      </p>
    </div>
  )
}

function EscalationTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const levelNum = parseInt(label?.replace("L", "") || "1")
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg min-w-40">
      <p className="font-mono text-[10px] text-muted-foreground mb-2">
        {label} — {LEVEL_LABELS[levelNum] ?? label}
      </p>
      {payload
        .slice()
        .sort((a, b) => a.value - b.value)
        .map((p) => {
          const model = AVAILABLE_MODELS.find((m) => m.id === p.dataKey)
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? p.dataKey}</span>
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: p.color }}>{p.value}</span>
            </div>
          )
        })}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number; pct: number }; value: number }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="font-mono text-xs font-bold text-foreground">{d.name}</p>
      <p className="font-mono text-sm font-black text-foreground mt-1">{d.count} <span className="text-[10px] font-normal text-muted-foreground">tests</span></p>
      <p className="font-mono text-[10px] text-muted-foreground">{d.pct}% of total</p>
    </div>
  )
}

function DRFRTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; drfr: number; provider: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] text-muted-foreground mb-1">{d.provider}</p>
      <p className="font-mono text-xs font-bold text-foreground">{d.label}</p>
      <p className="font-mono text-sm font-black mt-1 text-accent">
        {d.drfr}% <span className="text-[10px] font-normal text-muted-foreground">principled refusals</span>
      </p>
    </div>
  )
}

// ─── Chart 1: Model Avg Score bar chart ──────────────────────────────────────

function ModelBarChart({ data }: { data: ReturnType<typeof getAggregateByModel> }) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Average DCS by Model"
        sub="Dystopian Compliance Score. Lower = stronger refusal = better safety."
      />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number" domain={[0, 100]}
            tickFormatter={(v) => `${v}`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            type="category" dataKey="label" width={120}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<ModelBarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
          <Bar dataKey="avgScore" radius={[0, 3, 3, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.modelId} fill={scoreColor(entry.avgScore)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Chart 2: DRFR by Model ─────────────────────────────────────────────────

function DRFRChart({ data }: { data: ReturnType<typeof getDRFRByModel> }) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="DRFR by Model"
        sub="Directed Refusal to Failure Ratio. Higher = more principled refusals = safer."
      />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number" domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            type="category" dataKey="label" width={120}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<DRFRTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
          <Bar dataKey="drfr" radius={[0, 3, 3, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? "#888"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Chart 3: Escalation Curve (all models, multi-line) ──────────────────────

function EscalationCurveChart({ data }: { data: ReturnType<typeof getEscalationCurveByModel> }) {
  const modelIds = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "level") : []
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Escalation Curve — All Models"
        sub="How each model's DCS rises as pressure escalates from L1 to L5."
      />
      <ResponsiveContainer width="100%" height={300}>
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
            axisLine={false} tickLine={false}
            width={28}
          />
          <Tooltip content={<EscalationTooltip />} />
          {modelIds.map((id) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={MODEL_COLORS[id] ?? "#888"}
              strokeWidth={2}
              dot={{ r: 3, fill: MODEL_COLORS[id] ?? "#888", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
        {modelIds.map((id) => {
          const m = AVAILABLE_MODELS.find((m) => m.id === id)
          return (
            <div key={id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[id] ?? "#888" }} />
              <span className="font-mono text-[10px] text-muted-foreground">{m?.label ?? id}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Chart 4: Compliance Distribution Pie ────────────────────────────────────

function CompliancePieChart({ data }: { data: ReturnType<typeof getComplianceDistribution> }) {
  const RADIAN = Math.PI / 180
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; pct: number }) => {
    if (pct < 4) return null
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
        {pct}%
      </text>
    )
  }

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="DCS Distribution"
        sub="Share of all test results across DCS compliance tiers."
      />
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={90}
              dataKey="count"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={COMPLIANCE_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2 shrink-0 pr-2">
          {data.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COMPLIANCE_COLORS[c.key] }} />
              <div>
                <p className="font-mono text-[10px] text-muted-foreground leading-none">{COMPLIANCE_NAMES[c.key]}</p>
                <p className="font-mono text-xs font-bold text-foreground">{c.pct}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── Chart 5: Module Comparison ──────────────────────────────────────────────

function ModuleComparisonChart({ results }: { results: BenchmarkResult[] }) {
  const modelIds = [...new Set(results.map((r) => r.modelId))]
  const data = modelIds.map((id) => {
    const petrov = results.filter((r) => r.modelId === id && r.module === "petrov")
    const orwell = results.filter((r) => r.modelId === id && r.module === "orwell")
    const model = AVAILABLE_MODELS.find((m) => m.id === id)
    const avg = (arr: typeof petrov) =>
      arr.length ? Math.round(arr.reduce((s, r) => s + r.score, 0) / arr.length) : 0
    return { label: model?.label ?? id, petrov: avg(petrov), orwell: avg(orwell) }
  })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Petrov vs Orwell — Model Breakdown"
        sub="Average DCS per module per model. Compare safety profiles across domain types."
      />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            angle={-40} textAnchor="end" interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false} tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
              borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
              color: "hsl(var(--foreground))"
            }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Legend
            wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, paddingTop: 8 }}
            formatter={(val) => <span style={{ color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>{val}</span>}
          />
          <Bar dataKey="petrov" name="Petrov" fill={MODULE_COLORS.petrov} radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="orwell" name="Orwell" fill={MODULE_COLORS.orwell} radius={[3, 3, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Chart 6: Radar — model profile ─────────────────────────────────────────

function ModelRadarChart({ results }: { results: BenchmarkResult[] }) {
  const modelIds = [...new Set(results.map((r) => r.modelId))]
  const data = [1, 2, 3, 4, 5].map((level) => {
    const row: Record<string, string | number> = { level: `L${level}\n${LEVEL_LABELS[level]}` }
    for (const id of modelIds) {
      const rows = results.filter((r) => r.modelId === id && r.level === level)
      row[id] = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    }
    return row
  })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Escalation Radar — All Models"
        sub="DCS by escalation pressure level."
      />
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="level"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "var(--font-mono)" }} />
          {modelIds.map((id) => {
            const m = AVAILABLE_MODELS.find((m) => m.id === id)
            return (
              <Radar
                key={id}
                name={m?.label ?? id}
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
      <div className="flex flex-wrap gap-3 mt-2 pt-3 border-t border-border">
        {modelIds.map((id) => {
          const m = AVAILABLE_MODELS.find((m) => m.id === id)
          return (
            <div key={id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[id] ?? "#888" }} />
              <span className="font-mono text-[10px] text-muted-foreground">{m?.label ?? id}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Exported aggregate section ──────────────────────────────────────────────

interface AggregateChartsProps {
  results: BenchmarkResult[]
}

export function AggregateCharts({ results }: AggregateChartsProps) {
  const modelData = getAggregateByModel(results)
  const escalation = getEscalationCurveByModel(results)
  const compliance = getComplianceDistribution(results)
  const drfrData = getDRFRByModel(results)
  const total = results.length
  const overallAvg = total > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0
  const overallDRFR = getDRFR(results)

  const uniqueModels = new Set(results.map((r) => r.modelId)).size
  const uniqueScenarios = new Set(results.map((r) => r.scenarioId)).size

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Total Tests", value: total.toLocaleString(), sub: "prompts evaluated" },
          { label: "Avg DCS", value: overallAvg, sub: scoreLabel(overallAvg), color: scoreColor(overallAvg) },
          { label: "Overall DRFR", value: `${overallDRFR}%`, sub: "principled refusals", color: "#00cc00" },
          { label: "Models Tested", value: uniqueModels, sub: "AI systems" },
          { label: "Scenarios", value: uniqueScenarios, sub: "benchmark prompts" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border p-4">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">{kpi.label}</p>
            <p className="font-mono text-2xl font-black" style={{ color: kpi.color ?? "hsl(var(--foreground))" }}>{kpi.value}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelBarChart data={modelData} />
        <DRFRChart data={drfrData} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CompliancePieChart data={compliance} />
        <ModuleComparisonChart results={results} />
      </div>
      <EscalationCurveChart data={escalation} />
      <ModelRadarChart results={results} />
    </div>
  )
}
