"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, ReferenceLine,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { MOCK_RESULTS } from "@/lib/dystopiabench/mock-data"
import {
  MODEL_COLORS, COMPLIANCE_COLORS, scoreColor, scoreLabel, LEVEL_LABELS,
} from "@/lib/dystopiabench/chart-config"
import { Radiation, Eye, ChevronLeft } from "lucide-react"
import { SectionHeader } from "./section-header"

// Build per-prompt data for a given scenario
function buildPromptData(scenarioId: string) {
  const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId)
  if (!scenario) return null

  const scenarioResults = MOCK_RESULTS.filter((r) => r.scenarioId === scenarioId)

  const levels = [1, 2, 3, 4, 5].map((level) => {
    const rows = scenarioResults.filter((r) => r.level === level)
    const levelAvg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0

    const modelScores = AVAILABLE_MODELS.map((m) => {
      const r = scenarioResults.find((r) => r.modelId === m.id && r.level === level)
      return { modelId: m.id, label: m.label, score: r?.score ?? 0, compliance: r?.compliance ?? "principled_refusal" }
    })

    return {
      level,
      levelLabel: `L${level}`,
      levelName: LEVEL_LABELS[level],
      prompt: scenario.escalationPrompts.find((p) => p.level === level),
      levelAvg,
      modelScores,
    }
  })

  // Build multi-line data: each level is a row, each model is a column
  const lineData = levels.map((l) => {
    const row: Record<string, string | number> = {
      label: `L${l.level}`,
      levelName: l.levelName,
      avg: l.levelAvg,
    }
    for (const ms of l.modelScores) row[ms.modelId] = ms.score
    return row
  })

  return { scenario, levels, lineData }
}

// Global level overview: for each level, all scenarios
function buildGlobalLevelData() {
  return [1, 2, 3, 4, 5].map((level) => {
    const rows = MOCK_RESULTS.filter((r) => r.level === level)
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    const row: Record<string, string | number> = {
      label: `L${level}`,
      levelName: LEVEL_LABELS[level],
      avg,
    }
    for (const m of AVAILABLE_MODELS) {
      const mr = rows.filter((r) => r.modelId === m.id)
      row[m.id] = mr.length ? Math.round(mr.reduce((s, r) => s + r.score, 0) / mr.length) : 0
    }
    return row
  })
}

// Level × Model heatmap (global)
function LevelModelGrid() {
  const data = buildGlobalLevelData()
  return (
    <Card className="bg-card border-border p-5 overflow-x-auto">
      <SectionHeader
        label="Level × Model Score Grid"
        sub="Avg compliance score at each escalation level per model. Color = compliance tier."
      />
      <div className="min-w-max">
        <div className="flex items-center gap-px mb-1">
          <div className="w-28 shrink-0" />
          {AVAILABLE_MODELS.map((m) => (
            <div key={m.id} className="w-16 text-center">
              <span
                className="font-mono text-[8px] text-muted-foreground uppercase"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-block", paddingBottom: 6 }}
              >
                {m.label}
              </span>
            </div>
          ))}
          <div className="w-14 text-center">
            <span
              className="font-mono text-[8px] text-muted-foreground uppercase font-bold"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-block", paddingBottom: 6 }}
            >
              AVG
            </span>
          </div>
        </div>

        {data.map((row) => (
          <div key={row.label} className="flex items-center gap-px mb-px">
            <div className="w-28 shrink-0 pr-2">
              <p className="font-mono text-[9px] text-foreground font-bold">{row.label as string}</p>
              <p className="font-mono text-[8px] text-muted-foreground">{row.levelName as string}</p>
            </div>
            {AVAILABLE_MODELS.map((m) => {
              const score = row[m.id] as number
              return (
                <div
                  key={m.id}
                  className="w-16 h-10 flex items-center justify-center rounded-sm"
                  style={{ background: scoreColor(score) + "28" }}
                  title={`${m.label} / ${row.label}: ${score}`}
                >
                  <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(score) }}>
                    {score}
                  </span>
                </div>
              )
            })}
            <div
              className="w-14 h-10 flex items-center justify-center rounded-sm"
              style={{ background: scoreColor(row.avg as number) + "40" }}
            >
              <span className="font-mono text-[10px] font-black" style={{ color: scoreColor(row.avg as number) }}>
                {row.avg as number}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Global escalation bar chart (avg per level)
function GlobalLevelBar() {
  const data = buildGlobalLevelData()
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Avg Score by Escalation Level — All Scenarios"
        sub="How the average compliance score across all models and all scenarios increases with pressure."
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
            formatter={(val: number, _, p) => [val, p.payload.levelName]}
            contentStyle={{
              background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
              borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
              color: "hsl(var(--foreground))"
            }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={64}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={scoreColor(entry.avg as number)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Level labels */}
      <div className="grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-border">
        {data.map((row) => (
          <div key={row.label as string} className="text-center">
            <p className="font-mono text-[10px] font-bold text-foreground">{row.label as string}</p>
            <p className="font-mono text-[9px] text-muted-foreground">{row.levelName as string}</p>
            <p className="font-mono text-[10px] font-black mt-1" style={{ color: scoreColor(row.avg as number) }}>
              {row.avg as number}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Scenario selector + per-prompt deep dive
function ScenarioPromptDrillDown() {
  const [selectedId, setSelectedId] = useState<string>(ALL_SCENARIOS[0].id)
  const data = buildPromptData(selectedId)

  if (!data) return null
  const { scenario, levels, lineData } = data

  return (
    <div className="flex flex-col gap-5">
      {/* Scenario picker */}
      <div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
          Select Scenario
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${selectedId === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
            >
              {s.module === "petrov"
                ? <Radiation className="h-3 w-3" />
                : <Eye className="h-3 w-3" />
              }
              {s.id}
            </button>
          ))}
        </div>
      </div>

      {/* Selected scenario header */}
      <Card className="bg-card border-border p-4">
        <div className="flex items-start gap-3">
          {scenario.module === "petrov"
            ? <Radiation className="h-5 w-5 mt-0.5 text-[#f97316] shrink-0" />
            : <Eye className="h-5 w-5 mt-0.5 text-[#8b5cf6] shrink-0" />
          }
          <div>
            <h3 className="font-mono text-sm font-bold text-foreground">{scenario.title}</h3>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">{scenario.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="font-mono text-[9px] uppercase">{scenario.category}</Badge>
              <Badge variant="outline" className="font-mono text-[9px] uppercase">{scenario.module} module</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Multi-line chart — all models across 5 levels */}
      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Per-Prompt Escalation — All Models"
          sub="Each model's compliance score at each of the 5 escalation levels for this scenario."
        />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={lineData} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
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
            <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="6 3" label={{
              value: "threshold", position: "right",
              style: { fontSize: 9, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }
            }} />
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
                strokeWidth={2}
                dot={{ r: 3.5, fill: MODEL_COLORS[m.id] ?? "#888", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                name={m.label}
              />
            ))}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Average"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
          {AVAILABLE_MODELS.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[m.id] }} />
              <span className="font-mono text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-px w-4 bg-foreground opacity-60" />
            <span className="font-mono text-[10px] text-muted-foreground">Avg</span>
          </div>
        </div>
      </Card>

      {/* Per-level breakdown cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {levels.map((lv) => (
          <Card key={lv.level} className="bg-card border-border p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-foreground">L{lv.level}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{lv.levelName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-black" style={{ color: scoreColor(lv.levelAvg) }}>
                  {lv.levelAvg}
                </span>
                <span className="font-mono text-[9px]" style={{ color: scoreColor(lv.levelAvg) }}>
                  {scoreLabel(lv.levelAvg)}
                </span>
              </div>
            </div>

            {/* Mini bar chart — each model */}
            <div className="flex flex-col gap-1">
              {lv.modelScores.sort((a, b) => a.score - b.score).map((ms) => (
                <div key={ms.modelId} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: MODEL_COLORS[ms.modelId] }} />
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ms.score}%`,
                        background: scoreColor(ms.score),
                      }}
                    />
                  </div>
                  <span className="font-mono text-[9px] w-5 text-right" style={{ color: scoreColor(ms.score) }}>
                    {ms.score}
                  </span>
                </div>
              ))}
            </div>

            {/* Prompt preview */}
            {lv.prompt && (
              <div className="mt-3 pt-2 border-t border-border">
                <p className="font-mono text-[8px] text-muted-foreground leading-relaxed line-clamp-4">
                  {lv.prompt.prompt}
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PromptCharts() {
  return (
    <div className="flex flex-col gap-6">
      <GlobalLevelBar />
      <LevelModelGrid />
      <div className="border-t border-border pt-6">
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-5">
          Per-Scenario Prompt Drill Down
        </p>
        <ScenarioPromptDrillDown />
      </div>
    </div>
  )
}
