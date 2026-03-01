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
  getEscalationCurveByModel,
  getComplianceDistribution,
  getDRFR,
  getDRFRByModel,
  getChartShape,
} from "@/lib/dystopiabench/analytics"
import {
  MODEL_COLORS, COMPLIANCE_COLORS, COMPLIANCE_NAMES,
  MODULE_COLORS, scoreColor, scoreLabel, LEVEL_LABELS,
} from "@/lib/dystopiabench/chart-config"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { SectionHeader } from "./section-header"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
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
        .map((p) => {
          const model = AVAILABLE_MODELS.find((m) => m.id === p.dataKey)
          return (
            <div key={p.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
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

function RadarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-40 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">
        {label}
      </p>
      {payload
        .slice()
        .sort((a, b) => a.value - b.value)
        .map((p) => {
          const model = AVAILABLE_MODELS.find((m) => m.id === p.dataKey)
          return (
            <div key={p.dataKey} className="mb-0.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="font-mono text-[10px] text-muted-foreground">{model?.label ?? p.dataKey}</span>
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(p.value) }}>{p.value}</span>
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

function SingleModelMetricCard({
  label,
  sub,
  modelLabel,
  provider,
  value,
  valueSub,
  valueColor,
}: {
  label: string
  sub: string
  modelLabel: string
  provider: string
  value: string | number
  valueSub: string
  valueColor: string
}) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader label={label} sub={sub} />
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {modelLabel} - {provider}
      </p>
      <p className="mt-2 font-mono text-4xl font-black" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">{valueSub}</p>
    </Card>
  )
}

function ModelBarChart({ data }: { data: ReturnType<typeof getAggregateByModel> }) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Average DCS by Model"
        sub="Dystopian Compliance Score. Lower = stronger refusal = better safety."
      />
      <div className="h-[220px] md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ModelBarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="avgScore" radius={[0, 3, 3, 0]} maxBarSize={22}>
              {data.map((entry) => (
                <Cell key={entry.modelId} fill={scoreColor(entry.avgScore)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function DRFRChart({ data }: { data: ReturnType<typeof getDRFRByModel> }) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="DRFR by Model"
        sub="Directed Refusal to Failure Ratio. Higher = more principled refusals = safer."
      />
      <div className="h-[220px] md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<DRFRTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="drfr" radius={[0, 3, 3, 0]} maxBarSize={22}>
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

function EscalationCurveChart({ data }: { data: ReturnType<typeof getEscalationCurveByModel> }) {
  const modelIds = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "level") : []
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Escalation Curve - All Models"
        sub="How each model's DCS changes as pressure escalates from L1 to L5."
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
          const m = AVAILABLE_MODELS.find((model) => model.id === id)
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

function ComplianceDistributionBars({ data }: { data: ReturnType<typeof getComplianceDistribution> }) {
  const sorted = [...data].sort((a, b) => b.count - a.count || b.pct - a.pct)
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="DCS Distribution"
        sub="Share of all test results across DCS compliance tiers."
      />
      <div className="space-y-3 md:min-h-[280px] md:space-y-4">
        {sorted.map((row) => (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPLIANCE_COLORS[row.key] }} />
                <span className="font-mono text-[10px] text-muted-foreground">{COMPLIANCE_NAMES[row.key]}</span>
              </div>
              <span className="font-mono text-[10px] text-foreground">
                {row.pct}% ({row.count})
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, background: COMPLIANCE_COLORS[row.key] }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ModuleComparisonChart({ results }: { results: BenchmarkResult[] }) {
  const { hasSingleModel } = getChartShape(results)

  if (hasSingleModel) {
    const modelLabel = results[0]?.modelLabel ?? "Unknown model"
    const provider = results[0]?.provider ?? "Unknown provider"
    const data = ["petrov", "orwell"].map((module) => {
      const rows = results.filter((r) => r.module === module)
      const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0
      return {
        module: module === "petrov" ? "Petrov" : "Orwell",
        avg,
        color: MODULE_COLORS[module],
      }
    })

    return (
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Petrov vs Orwell - Module Breakdown"
          sub="Single-model view. Average DCS by module."
        />
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {modelLabel} - {provider}
        </p>
        <div className="h-[220px] md:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="module"
                width={64}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value} (${scoreLabel(value)})`, "Module Avg DCS"]}
                labelFormatter={(label) => `Module: ${label}`}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={24}>
                {data.map((entry) => (
                  <Cell key={entry.module} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    )
  }

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
        label="Petrov vs Orwell - Model Breakdown"
        sub="Average DCS per module per model. Compare safety profiles across domain types."
      />
      <div className="h-[220px] md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              angle={-40}
              textAnchor="end"
              interval={0}
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
              labelFormatter={(label) => `Model: ${label}`}
              contentStyle={TOOLTIP_STYLE}
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
      </div>
    </Card>
  )
}

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
        label="Escalation Radar - All Models"
        sub="DCS by escalation pressure level."
      />
      <div className="h-[220px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="level"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "var(--font-mono)" }} />
            <Tooltip content={<RadarTooltip />} />
            {modelIds.map((id) => {
              const m = AVAILABLE_MODELS.find((model) => model.id === id)
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
      </div>
      <div className="mt-2 flex flex-wrap gap-3 border-t border-border pt-3">
        {modelIds.map((id) => {
          const m = AVAILABLE_MODELS.find((model) => model.id === id)
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

interface AggregateChartsProps {
  results: BenchmarkResult[]
}

export function AggregateCharts({ results }: AggregateChartsProps) {
  const modelData = getAggregateByModel(results)
  const escalation = getEscalationCurveByModel(results)
  const compliance = getComplianceDistribution(results)
  const drfrData = getDRFRByModel(results)
  const shape = getChartShape(results)

  const total = results.length
  const overallAvg = total > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0
  const overallDRFR = getDRFR(results)
  const singleModelAvg = modelData.length === 1 ? modelData[0] : null
  const singleModelDrfr = drfrData.length === 1 ? drfrData[0] : null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Total Tests", value: total.toLocaleString(), sub: "prompts evaluated" },
          { label: "Avg DCS", value: overallAvg, sub: scoreLabel(overallAvg), color: scoreColor(overallAvg) },
          { label: "Overall DRFR", value: `${overallDRFR}%`, sub: "principled refusals", color: "#00cc00" },
          { label: "Models Tested", value: shape.modelCount, sub: "AI systems" },
          { label: "Scenarios", value: shape.scenarioCount, sub: "benchmark prompts" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border p-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
            <p className="font-mono text-2xl font-black" style={{ color: kpi.color ?? "hsl(var(--foreground))" }}>{kpi.value}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {shape.hasSingleModel && singleModelAvg && singleModelDrfr ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SingleModelMetricCard
            label="Average DCS"
            sub="Single-model view. Comparison chart hidden."
            modelLabel={singleModelAvg.label}
            provider={singleModelAvg.provider}
            value={singleModelAvg.avgScore}
            valueSub={scoreLabel(singleModelAvg.avgScore)}
            valueColor={scoreColor(singleModelAvg.avgScore)}
          />
          <SingleModelMetricCard
            label="DRFR"
            sub="Single-model view. Comparison chart hidden."
            modelLabel={singleModelDrfr.label}
            provider={singleModelDrfr.provider}
            value={`${singleModelDrfr.drfr}%`}
            valueSub="principled refusals"
            valueColor={MODEL_COLORS[singleModelDrfr.modelId] ?? "#00cc00"}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ModelBarChart data={modelData} />
          <DRFRChart data={drfrData} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceDistributionBars data={compliance} />
        <ModuleComparisonChart results={results} />
      </div>

      <EscalationCurveChart data={escalation} />
      {shape.modelCount >= 3 ? <ModelRadarChart results={results} /> : null}
    </div>
  )
}
