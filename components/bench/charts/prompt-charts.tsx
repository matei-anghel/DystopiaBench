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
  ReferenceLine,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { getChartShape } from "@/lib/dystopiabench/analytics"
import { MODEL_COLORS, scoreColor, scoreLabel, LEVEL_LABELS } from "@/lib/dystopiabench/chart-config"
import { Radiation, Eye } from "lucide-react"
import { SectionHeader } from "./section-header"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
}

function buildPromptData(results: BenchmarkResult[], scenarioId: string, models = AVAILABLE_MODELS) {
  const scenario = ALL_SCENARIOS.find((item) => item.id === scenarioId)
  if (!scenario) return null

  const scenarioResults = results.filter((result) => result.scenarioId === scenarioId)

  const levels = [1, 2, 3, 4, 5].map((level) => {
    const rows = scenarioResults.filter((result) => result.level === level)
    const levelAvg = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null

    const modelScores = models.map((model) => {
      const row = scenarioResults.find((result) => result.modelId === model.id && result.level === level)
      return {
        modelId: model.id,
        label: model.label,
        score: row?.score ?? null,
      }
    })

    return {
      level,
      levelName: LEVEL_LABELS[level],
      prompt: scenario.escalationPrompts.find((prompt) => prompt.level === level),
      levelAvg,
      modelScores,
    }
  })

  const lineData = levels.map((levelEntry) => {
    const row: Record<string, number | string | null> = {
      label: `L${levelEntry.level}`,
      levelName: levelEntry.levelName,
      avg: levelEntry.levelAvg,
    }

    for (const modelScore of levelEntry.modelScores) {
      row[modelScore.modelId] = modelScore.score
    }
    return row
  })

  return { scenario, levels, lineData }
}

function buildGlobalLevelData(results: BenchmarkResult[], models = AVAILABLE_MODELS) {
  return [1, 2, 3, 4, 5].map((level) => {
    const rows = results.filter((result) => result.level === level)
    const avg = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null

    const row: Record<string, string | number | null> = {
      label: `L${level}`,
      levelName: LEVEL_LABELS[level],
      avg,
    }

    for (const model of models) {
      const modelRows = rows.filter((result) => result.modelId === model.id)
      row[model.id] =
        modelRows.length > 0
          ? Math.round(modelRows.reduce((sum, result) => sum + result.score, 0) / modelRows.length)
          : null
    }

    return row
  })
}

function LevelModelGrid({
  data,
  models,
  hasSingleModel,
}: {
  data: Array<Record<string, string | number | null>>
  models: typeof AVAILABLE_MODELS
  hasSingleModel: boolean
}) {
  return (
    <Card className="bg-card border-border p-3 overflow-x-auto">
      <SectionHeader
        label="Level x Model Score Grid"
        sub={hasSingleModel
          ? "Single model mode. Avg compliance score at each escalation level for the active model."
          : "Avg compliance score at each escalation level per model. Color = compliance tier."}
      />
      <div className="min-w-max">
        <div className="flex items-end gap-px mb-1">
          <div className="w-36 shrink-0" />
          {models.map((model) => (
            <div key={model.id} className="w-20 relative" style={{ height: 90 }}>
              <span
                className="font-mono text-[8px] text-muted-foreground uppercase whitespace-nowrap absolute"
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
              className="font-mono text-[8px] text-muted-foreground uppercase font-bold whitespace-nowrap absolute"
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
          <div key={row.label as string} className="flex items-center gap-px mb-px">
            <div className="w-36 shrink-0 pr-3 text-right">
              <p className="font-mono text-[9px] text-foreground font-bold">{row.label as string}</p>
              <p className="font-mono text-[8px] text-muted-foreground">{row.levelName as string}</p>
            </div>
            {models.map((model) => {
              const score = row[model.id] as number | null
              if (score === null || score === undefined) {
                return (
                  <div
                    key={model.id}
                    className="w-20 h-12 flex items-center justify-center rounded-sm bg-muted/30"
                    title={`${model.label} / ${row.label}: no data`}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">-</span>
                  </div>
                )
              }
              return (
                <div
                  key={model.id}
                  className="w-20 h-12 flex items-center justify-center rounded-sm"
                  style={{ background: `${scoreColor(score)}28` }}
                  title={`${model.label} / ${row.label}: ${score}`}
                >
                  <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor(score) }}>
                    {score}
                  </span>
                </div>
              )
            })}
            <div
              className="w-16 h-12 flex items-center justify-center rounded-sm"
              style={{ background: `${scoreColor(row.avg as number)}40` }}
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

function GlobalLevelBar({
  data,
  viewMode,
}: {
  data: Array<Record<string, string | number | null>>
  viewMode: "stateful" | "stateless"
}) {
  const levelLabel = viewMode === "stateless" ? "Prompt Level" : "Escalation Level"
  const levelSub =
    viewMode === "stateless"
      ? "How average compliance changes by prompt level when each prompt runs in a fresh context."
      : "How average compliance across all models and scenarios changes with pressure."
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label={`Avg Score by ${levelLabel} - All Scenarios`}
        sub={levelSub}
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
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
            width={28}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { label: string; levelName: string; avg: number | null }
              if (d.avg === null) return null
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
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={64}>
            {data.map((entry) => (
              <Cell key={entry.label as string} fill={scoreColor(entry.avg as number)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function ScenarioPromptDrillDown({
  results,
  models,
  hasMultiModel,
  viewMode,
}: {
  results: BenchmarkResult[]
  models: typeof AVAILABLE_MODELS
  hasMultiModel: boolean
  viewMode: "stateful" | "stateless"
}) {
  const [selectedId, setSelectedId] = useState<string>(ALL_SCENARIOS[0].id)
  const data = useMemo(() => buildPromptData(results, selectedId, models), [models, results, selectedId])

  if (!data) return null
  const { scenario, levels, lineData } = data

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
          Select Scenario
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_SCENARIOS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${selectedId === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
            >
              {item.module === "petrov" ? <Radiation className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {item.id}
            </button>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border p-4">
        <div className="flex items-start gap-3">
          {scenario.module === "petrov" ? (
            <Radiation className="h-5 w-5 mt-0.5 text-[#f97316] shrink-0" />
          ) : (
            <Eye className="h-5 w-5 mt-0.5 text-[#8b5cf6] shrink-0" />
          )}
          <div>
            <h3 className="font-mono text-sm font-bold text-foreground">{scenario.title}</h3>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">{scenario.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="font-mono text-[9px] uppercase">
                {scenario.category}
              </Badge>
              <Badge variant="outline" className="font-mono text-[9px] uppercase">
                {scenario.module} module
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={viewMode === "stateless" ? "Per-Prompt (No Escalation) - All Models" : "Per-Prompt Escalation - All Models"}
          sub={hasMultiModel
            ? viewMode === "stateless"
              ? "Each model's score at each prompt level for this scenario with fresh context."
              : "Each model's score at each of the 5 escalation levels for this scenario."
            : viewMode === "stateless"
              ? "Single model mode. Average score per prompt level for this scenario with fresh context."
              : "Single model mode. Average score per escalation level for this scenario."}
        />
        <div className="h-[220px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
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
              <ReferenceLine
                y={50}
                stroke="hsl(var(--border))"
                strokeDasharray="6 3"
                label={{
                  value: "threshold",
                  position: "right",
                  style: {
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "hsl(var(--muted-foreground))",
                  },
                }}
              />
              <Tooltip
                formatter={(val: number, name: string) => [`${val} (${scoreLabel(val)})`, `${name} DCS`]}
                labelFormatter={(label) => {
                  const levelNum = parseInt(String(label).replace("L", ""), 10)
                  return `${label} – ${LEVEL_LABELS[levelNum] ?? label}`
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              {hasMultiModel
                ? models.map((model) => (
                  <Line
                    key={model.id}
                    type="linear"
                    dataKey={model.id}
                    stroke={MODEL_COLORS[model.id] ?? "#888"}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: MODEL_COLORS[model.id] ?? "#888", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name={model.label}
                    connectNulls
                  />
                ))
                : null}
              <Line
                type="linear"
                dataKey="avg"
                stroke="hsl(var(--foreground))"
                strokeWidth={hasMultiModel ? 1.5 : 2.5}
                strokeDasharray={hasMultiModel ? "4 2" : undefined}
                dot={!hasMultiModel ? { r: 3.5, fill: "hsl(var(--foreground))", strokeWidth: 0 } : false}
                name="Average"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {levels.map((levelEntry) => (
          <Card key={levelEntry.level} className="bg-card border-border p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-foreground">
                  L{levelEntry.level}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {levelEntry.levelName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                {levelEntry.levelAvg !== null ? (
                  <>
                    <span className="font-mono text-xl font-black" style={{ color: scoreColor(levelEntry.levelAvg) }}>
                      {levelEntry.levelAvg}
                    </span>
                    <span className="font-mono text-[9px]" style={{ color: scoreColor(levelEntry.levelAvg) }}>
                      {scoreLabel(levelEntry.levelAvg)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-xl font-black text-muted-foreground">-</span>
                    <span className="font-mono text-[9px] text-muted-foreground">no data</span>
                  </>
                )}
              </div>
            </div>

            {hasMultiModel ? (
              <div className="flex flex-col gap-1.5">
                {[...levelEntry.modelScores].sort((a, b) => (a.score ?? -1) - (b.score ?? -1)).map((modelScore) => (
                  <div key={modelScore.modelId} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <div
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: MODEL_COLORS[modelScore.modelId] }}
                        />
                        <span
                          className="font-mono text-[8px] truncate"
                          style={{ color: MODEL_COLORS[modelScore.modelId] ?? "hsl(var(--muted-foreground))" }}
                        >
                          {modelScore.label}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] shrink-0" style={{ color: modelScore.score !== null ? scoreColor(modelScore.score) : "hsl(var(--muted-foreground))" }}>
                        {modelScore.score ?? "–"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      {modelScore.score !== null ? (
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${modelScore.score}%`, background: scoreColor(modelScore.score) }}
                        />
                      ) : (
                        <div className="h-full rounded-full bg-muted/30" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                Single model mode
              </p>
            )}

            {levelEntry.prompt ? (
              <div className="mt-3 pt-2 border-t border-border">
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                  {levelEntry.prompt.prompt}
                </p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PromptCharts({
  results,
  selectedModelIds,
  viewMode = "stateful",
}: {
  results: BenchmarkResult[]
  selectedModelIds?: string[]
  viewMode?: "stateful" | "stateless"
}) {
  const shape = getChartShape(results)
  const activeModels = useMemo(
    () =>
      AVAILABLE_MODELS.filter((model) =>
        selectedModelIds
          ? selectedModelIds.includes(model.id)
          : results.some((row) => row.modelId === model.id),
      ),
    [results, selectedModelIds],
  )
  const globalData = useMemo(() => buildGlobalLevelData(results, activeModels), [activeModels, results])
  const promptSectionTitle = viewMode === "stateless" ? "Per-Scenario Prompt Drill Down (No Escalation)" : "Per-Scenario Prompt Drill Down (Escalation)"

  return (
    <div className="flex flex-col gap-6">
      <GlobalLevelBar data={globalData} viewMode={viewMode} />
      <LevelModelGrid data={globalData} models={activeModels} hasSingleModel={shape.hasSingleModel} />
      <div className="border-t border-border pt-6">
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-5">
          {promptSectionTitle}
        </p>
        <ScenarioPromptDrillDown
          results={results}
          models={activeModels}
          hasMultiModel={shape.hasMultiModel}
          viewMode={viewMode}
        />
      </div>
    </div>
  )
}
