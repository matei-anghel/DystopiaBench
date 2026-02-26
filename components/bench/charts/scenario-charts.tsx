"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { MOCK_RESULTS } from "@/lib/dystopiabench/mock-data"
import {
  MODEL_COLORS, scoreColor, scoreLabel, LEVEL_LABELS,
} from "@/lib/dystopiabench/chart-config"
import { ChevronDown, ChevronRight, Radiation, Eye } from "lucide-react"
import { SectionHeader } from "./section-header"

// Build all scenario-level aggregated data
function buildScenarioData() {
  return ALL_SCENARIOS.map((scenario) => {
    const rows = MOCK_RESULTS.filter((r) => r.scenarioId === scenario.id)
    const avgAll = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0

    // Per-level avg (across all models)
    const levelAvgs = [1, 2, 3, 4, 5].map((level) => {
      const lr = rows.filter((r) => r.level === level)
      return {
        level,
        label: `L${level}`,
        levelName: LEVEL_LABELS[level],
        avg: lr.length ? Math.round(lr.reduce((s, r) => s + r.score, 0) / lr.length) : 0,
      }
    })

    // Per-model avg (across all levels)
    const modelAvgs = AVAILABLE_MODELS.map((m) => {
      const mr = rows.filter((r) => r.modelId === m.id)
      return {
        modelId: m.id,
        label: m.label,
        avg: mr.length ? Math.round(mr.reduce((s, r) => s + r.score, 0) / mr.length) : 0,
      }
    }).sort((a, b) => a.avg - b.avg)

    // Per-model per-level for the line chart
    const escalationByModel = [1, 2, 3, 4, 5].map((level) => {
      const row: Record<string, string | number> = { label: `L${level}` }
      for (const m of AVAILABLE_MODELS) {
        const r = rows.find((r) => r.modelId === m.id && r.level === level)
        row[m.id] = r?.score ?? 0
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

const SCENARIO_DATA = buildScenarioData()

function ScenarioDetailPanel({ data }: { data: typeof SCENARIO_DATA[0] }) {
  const { scenario, avgAll, levelAvgs, modelAvgs, escalationByModel } = data

  return (
    <div className="flex flex-col gap-5 pt-4 border-t border-border mt-1">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Level bar chart */}
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Score by Escalation Level
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={levelAvgs} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false} tickLine={false} width={24}
              />
              <Tooltip
                formatter={(val: number, _, p) => [val, p.payload.levelName]}
                contentStyle={{
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
                  color: "hsl(var(--foreground))"
                }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {levelAvgs.map((entry) => (
                  <Cell key={entry.level} fill={scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Model bar chart */}
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Avg Score by Model (all levels)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={modelAvgs} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number" domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
              />
              <YAxis
                type="category" dataKey="label" width={88}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
                  color: "hsl(var(--foreground))"
                }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {modelAvgs.map((entry) => (
                  <Cell key={entry.modelId} fill={MODEL_COLORS[entry.modelId] ?? scoreColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-model escalation line chart */}
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
              axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false} tickLine={false} width={28}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
                color: "hsl(var(--foreground))"
              }}
            />
            {AVAILABLE_MODELS.map((m) => (
              <Line
                key={m.id}
                type="monotone"
                dataKey={m.id}
                stroke={MODEL_COLORS[m.id] ?? "#888"}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: MODEL_COLORS[m.id] ?? "#888", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                name={m.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border">
          {AVAILABLE_MODELS.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[m.id] }} />
              <span className="font-mono text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Overview bar chart across all scenarios
function AllScenariosBar() {
  const data = SCENARIO_DATA.map((d) => ({
    id: d.scenario.id,
    title: d.scenario.title.length > 26 ? d.scenario.title.slice(0, 24) + "…" : d.scenario.title,
    avg: d.avgAll,
    module: d.scenario.module,
  }))

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="All Scenarios — Average Score"
        sub="Average compliance score across all models and all escalation levels per scenario."
      />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number" domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false}
          />
          <YAxis
            type="category" dataKey="title" width={160}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }}
            axisLine={false} tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
              borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
              color: "hsl(var(--foreground))"
            }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={scoreColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// Model × Scenario score grid (heatmap-style)
function ScenarioModelGrid() {
  return (
    <Card className="bg-card border-border p-5 overflow-x-auto">
      <SectionHeader
        label="Score Grid — Model × Scenario"
        sub="Each cell = avg score for that model on that scenario. Color = compliance tier."
      />
      <div className="min-w-max">
        {/* Header row */}
        <div className="flex items-center gap-px mb-px">
          <div className="w-44 shrink-0" />
          {AVAILABLE_MODELS.map((m) => (
            <div key={m.id} className="w-16 text-center">
              <span
                className="font-mono text-[8px] text-muted-foreground uppercase tracking-wide"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-block", paddingBottom: 6 }}
              >
                {m.label}
              </span>
            </div>
          ))}
          <div className="w-14 text-center">
            <span
              className="font-mono text-[8px] text-muted-foreground uppercase tracking-wide font-bold"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-block", paddingBottom: 6 }}
            >
              AVG
            </span>
          </div>
        </div>

        {SCENARIO_DATA.map((d) => (
          <div key={d.scenario.id} className="flex items-center gap-px mb-px">
            {/* Scenario label */}
            <div className="w-44 shrink-0 pr-2 flex items-center gap-1.5">
              {d.scenario.module === "petrov"
                ? <Radiation className="h-2.5 w-2.5 shrink-0 text-[#f97316]" />
                : <Eye className="h-2.5 w-2.5 shrink-0 text-[#8b5cf6]" />
              }
              <span className="font-mono text-[9px] text-muted-foreground leading-tight truncate">
                {d.scenario.title.length > 26 ? d.scenario.title.slice(0, 24) + "…" : d.scenario.title}
              </span>
            </div>

            {/* Model cells */}
            {AVAILABLE_MODELS.map((m) => {
              const md = d.modelAvgs.find((x) => x.modelId === m.id)
              const score = md?.avg ?? 0
              return (
                <div
                  key={m.id}
                  className="w-16 h-9 flex items-center justify-center rounded-sm"
                  style={{ background: scoreColor(score) + "28" }}
                  title={`${m.label} / ${d.scenario.title}: ${score}`}
                >
                  <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(score) }}>
                    {score}
                  </span>
                </div>
              )
            })}

            {/* Row avg */}
            <div
              className="w-14 h-9 flex items-center justify-center rounded-sm"
              style={{ background: scoreColor(d.avgAll) + "40" }}
            >
              <span className="font-mono text-[10px] font-black" style={{ color: scoreColor(d.avgAll) }}>
                {d.avgAll}
              </span>
            </div>
          </div>
        ))}

        {/* Column avg footer */}
        <div className="flex items-center gap-px mt-1 border-t border-border pt-1">
          <div className="w-44 shrink-0">
            <span className="font-mono text-[9px] text-muted-foreground uppercase">Avg</span>
          </div>
          {AVAILABLE_MODELS.map((m) => {
            const rows = MOCK_RESULTS.filter((r) => r.modelId === m.id)
            const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
            return (
              <div key={m.id} className="w-16 h-9 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(avg) }}>{avg}</span>
              </div>
            )
          })}
          <div className="w-14 h-9 flex items-center justify-center">
            <span className="font-mono text-[10px] font-black text-foreground">
              {Math.round(MOCK_RESULTS.reduce((s, r) => s + r.score, 0) / MOCK_RESULTS.length)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ScenarioCharts() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <AllScenariosBar />
      <ScenarioModelGrid />

      {/* Accordion per scenario */}
      <div>
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-4">
          Drill Down by Scenario
        </p>
        <div className="flex flex-col gap-2">
          {SCENARIO_DATA.map((d) => {
            const isOpen = expandedId === d.scenario.id
            return (
              <Card
                key={d.scenario.id}
                className={`bg-card border-border overflow-hidden transition-colors ${isOpen ? "border-primary/40" : "hover:border-muted-foreground/30"}`}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : d.scenario.id)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {d.scenario.module === "petrov"
                      ? <Radiation className="h-4 w-4 shrink-0 text-[#f97316]" />
                      : <Eye className="h-4 w-4 shrink-0 text-[#8b5cf6]" />
                    }
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-foreground truncate">{d.scenario.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="font-mono text-[9px] uppercase py-0">
                          {d.scenario.category}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">{d.scenario.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-lg font-black" style={{ color: scoreColor(d.avgAll) }}>
                        {d.avgAll}
                      </span>
                      <p className="font-mono text-[9px] text-muted-foreground">{scoreLabel(d.avgAll)}</p>
                    </div>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5">
                    <ScenarioDetailPanel data={d} />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
