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
    <Card className="bg-card border-border p-5 overflow-x-auto">
      <SectionHeader
        label="Level x Model Score Grid"
        sub={hasSingleModel
          ? "Single model mode. Avg compliance score at each escalation level for the active model."
          : "Avg compliance score at each escalation level per model. Color = compliance tier."}
      />
      <div className="min-w-max">
        <div className="flex items-center gap-px mb-1">
          <div className="w-28 shrink-0" />
          {models.map((model) => (
            <div key={model.id} className="w-16 text-center">
              <span
                className="font-mono text-[8px] text-muted-foreground uppercase"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  display: "inline-block",
                  paddingBottom: 6,
                }}
              >
                {model.label}
              </span>
            </div>
          ))}
          <div className="w-14 text-center">
            <span
              className="font-mono text-[8px] text-muted-foreground uppercase font-bold"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                display: "inline-block",
                paddingBottom: 6,
              }}
            >
              AVG
            </span>
          </div>
        </div>

        {data.map((row) => (
          <div key={row.label as string} className="flex items-center gap-px mb-px">
            <div className="w-28 shrink-0 pr-2">
              <p className="font-mono text-[9px] text-foreground font-bold">{row.label as string}</p>
              <p className="font-mono text-[8px] text-muted-foreground">{row.levelName as string}</p>
            </div>
            {models.map((model) => {
              const score = row[model.id] as number | null
              if (score === null || score === undefined) {
                return (
                  <div
                    key={model.id}
                    className="w-16 h-10 flex items-center justify-center rounded-sm bg-muted/30"
                    title={`${model.label} / ${row.label}: no data`}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">-</span>
                  </div>
                )
              }
              return (
                <div
                  key={model.id}
                  className="w-16 h-10 flex items-center justify-center rounded-sm"
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
              className="w-14 h-10 flex items-center justify-center rounded-sm"
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

function GlobalLevelBar({ data }: { data: Array<Record<string, string | number | null>> }) {
  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="Avg Score by Escalation Level - All Scenarios"
        sub="How average compliance across all models and scenarios changes with pressure."
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
            formatter={(val: number, _name, payload) => [`${val} (${scoreLabel(val)})`, payload.payload.levelName]}
            labelFormatter={(label) => `Escalation ${label}`}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
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
}: {
  results: BenchmarkResult[]
  models: typeof AVAILABLE_MODELS
  hasMultiModel: boolean
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
          label="Per-Prompt Escalation - All Models"
          sub={hasMultiModel
            ? "Each model's score at each of the 5 escalation levels for this scenario."
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
                labelFormatter={(label) => `Escalation ${label}`}
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
              <div className="flex flex-col gap-1">
                {[...levelEntry.modelScores].sort((a, b) => (a.score ?? -1) - (b.score ?? -1)).map((modelScore) => (
                  <div key={modelScore.modelId} className="flex items-center gap-1.5">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: MODEL_COLORS[modelScore.modelId] }}
                    />
                    {modelScore.score !== null ? (
                      <>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${modelScore.score}%`,
                              background: scoreColor(modelScore.score),
                            }}
                          />
                        </div>
                        <span className="font-mono text-[9px] w-5 text-right" style={{ color: scoreColor(modelScore.score) }}>
                          {modelScore.score}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 h-1.5 rounded-full bg-muted/30" />
                        <span className="font-mono text-[9px] w-5 text-right text-muted-foreground">-</span>
                      </>
                    )}
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
                <p className="font-mono text-[8px] text-muted-foreground leading-relaxed line-clamp-4">
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
}: {
  results: BenchmarkResult[]
  selectedModelIds?: string[]
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

  return (
    <div className="flex flex-col gap-6">
      <GlobalLevelBar data={globalData} />
      <LevelModelGrid data={globalData} models={activeModels} hasSingleModel={shape.hasSingleModel} />
      <div className="border-t border-border pt-6">
        <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-5">
          Per-Scenario Prompt Drill Down
        </p>
        <ScenarioPromptDrillDown results={results} models={activeModels} hasMultiModel={shape.hasMultiModel} />
      </div>
    </div>
  )
}
