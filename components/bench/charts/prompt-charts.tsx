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
import { ALL_MODULES, SCENARIOS_BY_ID } from "@/lib/dystopiabench/scenarios"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { createResultsIndex, type ResultsIndex } from "@/lib/dystopiabench/analytics"
import {
  compareSafestFirst,
  scoreDirectionHint,
  scoreTone,
  scoreToneLabel,
  LEVEL_LABELS,
  getResponsiveBarChartLayout,
  scoreToneText,
  toneText,
} from "@/lib/dystopiabench/chart-config"
import { getModelLineDashes, indexDisplayModels, type DisplayModel } from "@/lib/dystopiabench/display-models"
import { renderModuleIcon } from "../module-icon"
import { AXIS_TICK, PICKER_BUTTON_CLASS, pickerButtonState } from "./chart-shared"
import { ChartSummary, SectionHeader } from "./section-header"
import { LabLogo, ModelLegend, ModelName } from "./lab-logo"

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "hsl(var(--foreground))",
}

function scenarioLevelKey(scenarioId: string, level: number): string {
  return `${scenarioId}::${level}`
}

function scenarioModelLevelKey(scenarioId: string, modelId: string, level: number): string {
  return `${scenarioId}::${modelId}::${level}`
}

const ESCALATION_LEVELS = [1, 2, 3, 4, 5] as const

function buildPromptData(resultsIndex: ResultsIndex, scenarioId: string, models: DisplayModel[]) {
  const scenario = SCENARIOS_BY_ID.get(scenarioId)
  if (!scenario) return null
  const promptsByLevel = new Map(scenario.escalationPrompts.map((prompt) => [prompt.level, prompt]))

  const levels = ESCALATION_LEVELS.map((level) => {
    const rows = resultsIndex.byScenarioLevel.get(scenarioLevelKey(scenarioId, level)) ?? []
    const levelAvg = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null

    const modelScores = models.map((model) => {
      const row = resultsIndex.byScenarioModelLevel.get(
        scenarioModelLevelKey(scenarioId, model.id, level)
      )
      return {
        modelId: model.id,
        label: model.label,
        score: row?.score ?? null,
      }
    })

    return {
      level,
      levelName: LEVEL_LABELS[level],
      prompt: promptsByLevel.get(level),
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

function buildGlobalLevelData(resultsIndex: ResultsIndex, models: DisplayModel[]) {
  const allRows = Array.from(resultsIndex.byScenario.values()).flat()
  return ESCALATION_LEVELS.map((level) => {
    const rows = allRows.filter((result) => result.level === level)
    const avg = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null

    const row: Record<string, string | number | null> = {
      label: `L${level}`,
      levelName: LEVEL_LABELS[level],
      avg,
    }

    for (const model of models) {
      const modelRows = resultsIndex.byModel.get(model.id)?.filter((result) => result.level === level) ?? []
      row[model.id] =
        modelRows.length > 0
          ? Math.round(modelRows.reduce((sum, result) => sum + result.score, 0) / modelRows.length)
          : null
    }

    return row
  })
}

function averageScores(scores: Array<number | null | undefined>): number | null {
  const validScores = scores.filter((score): score is number => typeof score === "number")
  if (validScores.length === 0) return null
  return Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
}

function ScoreCell({
  score,
  title,
  legacyScoring,
  className = "w-24",
}: {
  score: number | null | undefined
  title: string
  legacyScoring: boolean
  className?: string
}) {
  if (score === null || score === undefined) {
    return (
      <div
        className={`${className} h-12 flex items-center justify-center rounded-sm bg-muted/30`}
        title={`${title}: no data`}
      >
        <span className="font-mono text-[11px] text-muted-foreground">-</span>
      </div>
    )
  }

  const tone = scoreTone(score, legacyScoring)
  return (
    <div
      className={`${className} h-12 flex items-center justify-center rounded-sm`}
      style={{ background: `${tone}28` }}
      title={`${title}: ${score}`}
    >
      <span className="font-mono text-[11px] font-bold" style={{ color: toneText(tone) }}>
        {score}
      </span>
    </div>
  )
}

function LevelModelGrid({
  data,
  models,
  legacyScoring,
}: {
  data: Array<Record<string, string | number | null>>
  models: DisplayModel[]
  legacyScoring: boolean
}) {
  const modelRows = models.map((model) => {
    const levelScores = data.map((row) => ({
      label: row.label as string,
      levelName: row.levelName as string,
      score: row[model.id] as number | null | undefined,
    }))

    return {
      model,
      levelScores,
      avg: averageScores(levelScores.map((entry) => entry.score)),
    }
  })
  const grandAverage = averageScores(modelRows.map((row) => row.avg))

  return (
    <Card className="bg-card border-border p-3 overflow-x-auto subtle-x-scrollbar">
      <SectionHeader
        label="Compliance Score Grid — Level × Model"
        sub={`Avg Dystopian Compliance Score (DCS) at each level per model. Colour = compliance tier (${scoreDirectionHint(legacyScoring)})`}
      />
      <div className="min-w-max">
        <div className="flex items-end gap-px mb-1">
          <div className="w-48 shrink-0" />
          {data.map((row) => (
            <div key={row.label as string} className="w-24 h-12 flex flex-col items-center justify-end pb-2 text-center">
              <span className="font-mono text-[10px] font-bold text-foreground">
                {row.label as string}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground leading-tight">
                {row.levelName as string}
              </span>
            </div>
          ))}
          <div className="w-16 h-12 flex items-center justify-center pb-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold">
              AVG
            </span>
          </div>
        </div>

        {modelRows.map((row) => (
          <div key={row.model.id} className="flex items-center gap-px mb-px">
            <div className="w-48 shrink-0 pr-3 flex items-center justify-end text-right">
              <ModelName
                model={row.model}
                labelClassName="font-mono text-[10px] text-muted-foreground uppercase leading-tight"
              />
            </div>
            {row.levelScores.map((levelScore) => (
              <ScoreCell
                key={levelScore.label}
                score={levelScore.score}
                title={`${row.model.label} / ${levelScore.label}`}
                legacyScoring={legacyScoring}
              />
            ))}
            <ScoreCell score={row.avg} title={`${row.model.label} average`} className="w-16" legacyScoring={legacyScoring} />
          </div>
        ))}

        <div className="flex items-center gap-px mt-1 border-t border-border pt-1">
          <div className="w-48 shrink-0 pr-3 text-right">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">Avg</span>
          </div>
          {data.map((row) => (
            <ScoreCell
              key={row.label as string}
              score={row.avg as number | null}
              title={`${row.label as string} average`}
              legacyScoring={legacyScoring}
            />
          ))}
          <ScoreCell score={grandAverage} title="Grand average" className="w-16" legacyScoring={legacyScoring} />
        </div>
      </div>
    </Card>
  )
}

function GlobalLevelBar({
  data,
  viewMode,
  legacyScoring,
}: {
  data: Array<Record<string, string | number | null>>
  viewMode: "stateful" | "stateless"
  legacyScoring: boolean
}) {
  const levelLabel = viewMode === "stateless" ? "Prompt Level" : "Escalation Level"
  const levelSub =
    viewMode === "stateless"
      ? "How average compliance changes by prompt level when each prompt runs in a fresh context."
      : "How average compliance across all models and scenarios changes with pressure."
  const barLayout = getResponsiveBarChartLayout({ categoryCount: data.length })

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label={`Avg Compliance Score by ${levelLabel} — All Scenarios`}
        sub={`${levelSub} (${scoreDirectionHint(legacyScoring)})`}
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ left: 0, right: 8, top: 8, bottom: 4 }}
          barGap={barLayout.barGap}
          barCategoryGap={barLayout.barCategoryGap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { label: string; levelName: string; avg: number | null }
              if (d.avg === null) return null
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                  <p className="font-mono text-xs font-bold text-foreground">{d.label} – {d.levelName}</p>
                  <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreToneText(d.avg, legacyScoring) }}>
                    {d.avg} <span className="text-[11px] font-normal">{scoreToneLabel(d.avg, legacyScoring)}</span>
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={barLayout.maxBarSize} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.label as string} fill={scoreTone(entry.avg as number | null, legacyScoring)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartSummary>
        {data.map((entry) => `${entry.label as string} ${entry.avg ?? "no data"}`).join(", ")}
      </ChartSummary>
    </Card>
  )
}

function ScenarioPromptDrillDown({
  resultsIndex,
  models,
  viewMode,
  legacyScoring,
}: {
  resultsIndex: ResultsIndex
  models: DisplayModel[]
  viewMode: "stateful" | "stateless"
  legacyScoring: boolean
}) {
  // Only offer scenarios that have results (the no-escalation ablation covers a subset).
  const scenarioGroups = useMemo(
    () =>
      ALL_MODULES.map((scenarioModule) => ({
        module: scenarioModule,
        scenarios: scenarioModule.scenarios.filter((scenario) => resultsIndex.byScenario.has(scenario.id)),
      })).filter((group) => group.scenarios.length > 0),
    [resultsIndex],
  )
  const firstScenarioId = scenarioGroups[0]?.scenarios[0]?.id
  const [requestedId, setSelectedId] = useState<string | undefined>(undefined)
  const selectedId = requestedId && resultsIndex.byScenario.has(requestedId) ? requestedId : firstScenarioId
  const data = useMemo(
    () => (selectedId ? buildPromptData(resultsIndex, selectedId, models) : null),
    [models, resultsIndex, selectedId],
  )
  const dashes = useMemo(() => getModelLineDashes(models), [models])
  const modelsById = useMemo(() => indexDisplayModels(models), [models])

  if (!data) return null
  const { scenario, levels, lineData } = data
  const selectedModuleGroup =
    scenarioGroups.find((group) => group.module.id === scenario.module) ?? scenarioGroups[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div role="group" aria-labelledby={`prompt-module-picker-${viewMode}`}>
          <p id={`prompt-module-picker-${viewMode}`} className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">
            Select Module
          </p>
          <div className="flex flex-wrap gap-2">
            {scenarioGroups.map((group) => (
              <button
                key={group.module.id}
                type="button"
                aria-pressed={scenario.module === group.module.id}
                onClick={() => {
                  const firstScenario = group.scenarios[0]
                  if (firstScenario) setSelectedId(firstScenario.id)
                }}
                className={`${PICKER_BUTTON_CLASS} ${pickerButtonState(scenario.module === group.module.id)}`}
              >
                {renderModuleIcon(group.module.id, "h-3 w-3")}
                {group.module.id}
              </button>
            ))}
          </div>
        </div>
        {selectedModuleGroup ? (
          <div role="group" aria-labelledby={`prompt-scenario-picker-${viewMode}`}>
            <p id={`prompt-scenario-picker-${viewMode}`} className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase mb-2">
              Select Scenario
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedModuleGroup.scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                  title={item.title}
                  className={`${PICKER_BUTTON_CLASS} ${pickerButtonState(selectedId === item.id)}`}
                >
                  {renderModuleIcon(item.module, "h-3 w-3")}
                  {item.id}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Card className="bg-card border-border p-4">
        <div className="flex items-start gap-3">
          {renderModuleIcon(scenario.module, "h-5 w-5 mt-0.5 text-muted-foreground shrink-0")}
          <div>
            <h3 className="font-mono text-sm font-bold text-foreground">{scenario.title}</h3>
            <p className="font-mono text-[11px] text-muted-foreground mt-1">{scenario.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {scenario.category}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {scenario.module} module
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={viewMode === "stateless" ? "Per-Prompt (No Escalation) - Selected Models" : "Per-Prompt Escalation - Selected Models"}
          sub={viewMode === "stateless"
            ? `Each model's Dystopian Compliance Score (DCS) at each prompt level for this scenario with fresh context (${scoreDirectionHint(legacyScoring)})`
            : `Each model's Dystopian Compliance Score (DCS) at each of the 5 escalation levels for this scenario (${scoreDirectionHint(legacyScoring)})`}
        />
        <div className="h-[240px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <ReferenceLine
                y={50}
                stroke="hsl(var(--border))"
                strokeDasharray="6 3"
                label={{
                  value: "threshold",
                  position: "right",
                  style: {
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fill: "hsl(var(--muted-foreground))",
                  },
                }}
              />
              <Tooltip
                formatter={(val: number, name: string) => [`${val ?? "-"} (${scoreToneLabel(val, legacyScoring)})`, `${name} DCS`]}
                labelFormatter={(label) => {
                  const levelNum = parseInt(String(label).replace("L", ""), 10)
                  return `${label} - ${LEVEL_LABELS[levelNum] ?? label}`
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              {models.map((model) => (
                <Line
                  key={model.id}
                  type="linear"
                  dataKey={model.id}
                  stroke={model.color}
                  strokeWidth={2}
                  strokeDasharray={dashes.get(model.id)}
                  dot={{ r: 3.5, fill: model.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name={model.label}
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="linear"
                dataKey="avg"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                name="Average"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ModelLegend models={models} dashes={dashes} />
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {levels.map((levelEntry) => (
          <Card key={levelEntry.level} className="bg-card border-border p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] font-bold text-foreground">
                  L{levelEntry.level}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {levelEntry.levelName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                {levelEntry.levelAvg !== null ? (
                  <>
                    <span className="font-mono text-xl font-black" style={{ color: scoreToneText(levelEntry.levelAvg, legacyScoring) }}>
                      {levelEntry.levelAvg}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: scoreToneText(levelEntry.levelAvg, legacyScoring) }}>
                      {scoreToneLabel(levelEntry.levelAvg, legacyScoring)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-xl font-black text-muted-foreground">-</span>
                    <span className="font-mono text-[10px] text-muted-foreground">no data</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {[...levelEntry.modelScores]
                .sort((a, b) => compareSafestFirst(a.score, b.score, legacyScoring))
                .map((modelScore) => {
                  const model = modelsById.get(modelScore.modelId)
                  return (
                    <div key={modelScore.modelId} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <LabLogo provider={model?.provider} size={11} />
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            {modelScore.label}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] shrink-0" style={{ color: scoreToneText(modelScore.score, legacyScoring) }}>
                          {modelScore.score ?? "-"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        {modelScore.score !== null ? (
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${modelScore.score}%`, background: scoreTone(modelScore.score, legacyScoring) }}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
            </div>

            {levelEntry.prompt ? (
              <div className="mt-3 pt-2 border-t border-border">
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
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
  models,
  legacyScoring,
  viewMode = "stateful",
}: {
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
  viewMode?: "stateful" | "stateless"
}) {
  const resultsIndex = useMemo(() => createResultsIndex(results), [results])
  const activeModels = useMemo(
    () => models.filter((model) => resultsIndex.byModel.has(model.id)),
    [models, resultsIndex],
  )
  const globalData = useMemo(() => buildGlobalLevelData(resultsIndex, activeModels), [activeModels, resultsIndex])
  const promptSectionTitle = viewMode === "stateless" ? "Per-Scenario Prompt Drill Down (No Escalation)" : "Per-Scenario Prompt Drill Down (Escalation)"

  return (
    <div className="flex flex-col gap-6">
      <GlobalLevelBar data={globalData} viewMode={viewMode} legacyScoring={legacyScoring} />
      <LevelModelGrid data={globalData} models={activeModels} legacyScoring={legacyScoring} />
      <div className="border-t border-border pt-6">
        <h3 className="font-mono text-xs font-bold tracking-wider text-foreground uppercase mb-5">
          {promptSectionTitle}
        </h3>
        <ScenarioPromptDrillDown
          resultsIndex={resultsIndex}
          models={activeModels}
          viewMode={viewMode}
          legacyScoring={legacyScoring}
        />
      </div>
    </div>
  )
}
