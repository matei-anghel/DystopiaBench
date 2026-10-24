"use client"

import { useMemo } from "react"
import Link from "next/link"
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
  createResultsIndex,
} from "@/lib/dystopiabench/analytics"
import {
  COMPLIANCE_COLORS, COMPLIANCE_NAMES,
  compareSafestFirst, scoreDirectionHint, scoreTone, scoreToneLabel,
  LEVEL_LABELS, getResponsiveBarChartLayout,
} from "@/lib/dystopiabench/chart-config"
import {
  getModelLineDashes,
  indexDisplayModels,
  type DisplayModel,
} from "@/lib/dystopiabench/display-models"
import { getModuleById } from "@/lib/dystopiabench/scenarios"
import { ChartSummary, SectionHeader } from "./section-header"
import { LabLogo, ModelBarXAxisTick, ModelLegend } from "./lab-logo"
import { ModuleLevelHeatmap } from "./module-heatmap"

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }

interface Props {
  module: Module
  results: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
}

function averageOf(rows: BenchmarkResult[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
}

function ScoreTooltipBody({
  eyebrow,
  title,
  score,
  legacyScoring,
}: {
  eyebrow?: React.ReactNode
  title: string
  score: number | null
  legacyScoring: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      {eyebrow ? <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">{eyebrow}</p> : null}
      <p className="font-mono text-xs font-bold text-foreground">{title}</p>
      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreTone(score, legacyScoring) }}>
        {score ?? "-"} <span className="text-[11px] font-normal">{scoreToneLabel(score, legacyScoring)}</span>
      </p>
    </div>
  )
}

export function ModuleCharts({ module, results, models, legacyScoring }: Props) {
  const scenarioModule = getModuleById(module)
  const moduleResults = useMemo(() => results.filter((r) => r.module === module), [module, results])
  const moduleResultsIndex = useMemo(() => createResultsIndex(moduleResults), [moduleResults])
  const moduleLabel = scenarioModule?.label ?? String(module)
  const modelsById = useMemo(() => indexDisplayModels(models), [models])
  const activeModels = useMemo(
    () => models.filter((model) => moduleResultsIndex.byModel.has(model.id)),
    [models, moduleResultsIndex],
  )
  const dashes = useMemo(() => getModelLineDashes(activeModels), [activeModels])

  const { modelData, escalation, compliance, scenarioData, categoryData } = useMemo(() => {
    const scenarios = getModuleById(module)?.scenarios ?? []
    const categories = [...new Set(scenarios.map((scenario) => scenario.category))]
    return {
      modelData: getAggregateByModel(moduleResults, moduleResultsIndex).sort(
        (left, right) => compareSafestFirst(left.avgScore, right.avgScore, legacyScoring),
      ),
      escalation: getEscalationCurveByModel(moduleResults, moduleResultsIndex),
      compliance: getComplianceDistribution(moduleResults),
      // Missing data stays null so it renders as an empty slot rather than a perfect score.
      scenarioData: scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        category: scenario.category,
        avg: averageOf(moduleResultsIndex.byScenario.get(scenario.id) ?? []),
      })),
      categoryData: categories.map((category) => ({
        category,
        avg: averageOf(moduleResults.filter((result) => result.scenarioCategory === category)),
      })),
    }
  }, [legacyScoring, module, moduleResults, moduleResultsIndex])

  const modelBarLayout = getResponsiveBarChartLayout({ categoryCount: modelData.length })
  const scenarioBarLayout = getResponsiveBarChartLayout({ categoryCount: scenarioData.length })
  const categoryBarLayout = getResponsiveBarChartLayout({ categoryCount: categoryData.length })
  const direction = scoreDirectionHint(legacyScoring)
  const scoredScenarios = scenarioData
    .filter((entry): entry is typeof entry & { avg: number } => entry.avg !== null)
    .sort((left, right) => compareSafestFirst(left.avg, right.avg, legacyScoring))
  const nameOf = (modelId: string) => modelsById.get(modelId)?.label ?? modelId

  if (moduleResults.length === 0) {
    return (
      <Card className="bg-card border-border p-6" role="status">
        <p className="font-mono text-xs text-foreground uppercase">No results for {moduleLabel} with the selected models.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="font-mono text-[11px] text-muted-foreground">
        {scenarioModule?.description}{" "}
        <Link href={`/module/${String(module)}`} className="text-foreground underline underline-offset-2 hover:text-primary">
          Read the {moduleLabel.replace(/\s+Module$/i, "")} scenarios
        </Link>
      </p>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={`Model Avg Compliance Score - ${moduleLabel}`}
          sub={`Dystopian Compliance Score (DCS), safest first (${direction})`}
        />
        <div className="h-[320px] md:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={modelData}
              margin={{ left: 24, right: 4, top: 4, bottom: 92 }}
              barGap={modelBarLayout.barGap}
              barCategoryGap={modelBarLayout.barCategoryGap}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                type="category"
                dataKey="modelId"
                tick={<ModelBarXAxisTick models={modelsById} />}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={0}
              />
              <YAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { avgScore: number; modelId: string }
                  const model = modelsById.get(d.modelId)
                  return (
                    <ScoreTooltipBody
                      eyebrow={<><LabLogo provider={model?.provider} size={12} />{model?.provider}</>}
                      title={model?.label ?? d.modelId}
                      score={d.avgScore}
                      legacyScoring={legacyScoring}
                    />
                  )
                }}
              />
              <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={modelBarLayout.maxBarSize} isAnimationActive={false}>
                {modelData.map((entry) => (
                  <Cell key={entry.modelId} fill={modelsById.get(entry.modelId)?.color ?? "#888"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {modelData.length > 1 ? (
          <ChartSummary>
            Safest in this module: {nameOf(modelData[0].modelId)} ({modelData[0].avgScore}). Least safe:{" "}
            {nameOf(modelData[modelData.length - 1].modelId)} ({modelData[modelData.length - 1].avgScore}).
          </ChartSummary>
        ) : null}
      </Card>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label="Compliance Score by Scenario"
          sub={`Average DCS across the selected models and all levels per scenario (${direction})`}
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
                    <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9} fontFamily="var(--font-mono)">
                      {line1}
                    </text>
                    {line2 && (
                      <text x={0} y={0} dy={23} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9} fontFamily="var(--font-mono)">
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
            <YAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { id: string; title: string; avg: number | null; category: string }
                return <ScoreTooltipBody eyebrow={d.category} title={d.title} score={d.avg} legacyScoring={legacyScoring} />
              }}
            />
            <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={scenarioBarLayout.maxBarSize} isAnimationActive={false}>
              {scenarioData.map((entry) => (
                <Cell key={entry.id} fill={scoreTone(entry.avg, legacyScoring)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {scoredScenarios.length > 1 ? (
          <ChartSummary>
            Safest scenario: {scoredScenarios[0].title} ({scoredScenarios[0].avg}). Least safe:{" "}
            {scoredScenarios[scoredScenarios.length - 1].title} ({scoredScenarios[scoredScenarios.length - 1].avg}).
          </ChartSummary>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border p-5">
          <SectionHeader label="Dystopian Compliance Score by Category" sub={`DCS averaged per category (${direction})`} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={categoryData}
              margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
              barGap={categoryBarLayout.barGap}
              barCategoryGap={categoryBarLayout.barCategoryGap}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="category" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { category: string; avg: number | null }
                  return <ScoreTooltipBody title={d.category} score={d.avg} legacyScoring={legacyScoring} />
                }}
              />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} maxBarSize={categoryBarLayout.maxBarSize} isAnimationActive={false}>
                {categoryData.map((entry) => (
                  <Cell key={entry.category} fill={scoreTone(entry.avg, legacyScoring)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <ChartSummary>
            {categoryData.map((entry) => `${entry.category}: ${entry.avg ?? "no data"}`).join(" / ")}
          </ChartSummary>
        </Card>

        <Card className="bg-card border-border p-5">
          <SectionHeader label="Compliance Tier Distribution" sub="Share of responses in each compliance tier - more Refusals is better" />
          <div className="mt-4 flex flex-col gap-4">
            {compliance.map((entry) => (
              <div key={entry.key} className="flex items-center gap-3">
                <div className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COMPLIANCE_COLORS[entry.key] }} />
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">{COMPLIANCE_NAMES[entry.key]}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${entry.pct}%`, background: COMPLIANCE_COLORS[entry.key] }}
                  />
                </div>
                <span className="w-9 text-right font-mono text-[11px] text-muted-foreground">{entry.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border p-5">
        <SectionHeader
          label={`Escalation Curve - ${moduleLabel}`}
          sub={`How Dystopian Compliance Score (DCS) changes under escalating pressure, per model (${direction})`}
        />
        <div className="h-[240px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={escalation} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="level" tick={AXIS_TICK} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(value: number, name: string) => [`${value ?? "-"} (${scoreToneLabel(value, legacyScoring)})`, `${name} DCS`]}
                labelFormatter={(label) => {
                  const levelNum = parseInt(String(label).replace("L", ""), 10)
                  return `${label} - ${LEVEL_LABELS[levelNum] ?? label}`
                }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "hsl(var(--foreground))",
                }}
              />
              {activeModels.map((model) => (
                <Line
                  key={model.id}
                  type="linear"
                  dataKey={model.id}
                  stroke={model.color}
                  strokeWidth={2}
                  strokeDasharray={dashes.get(model.id)}
                  dot={{ r: 3, fill: model.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name={model.label}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ModelLegend models={activeModels} dashes={dashes} />
      </Card>

      <div className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          label={`${moduleLabel} Heatmap`}
          sub="Rows are scenarios, columns are models, each cell is split into L1-L5 compliance segments."
        />
        <div className="mt-2">
          <ModuleLevelHeatmap module={module} results={moduleResults} models={activeModels} />
        </div>
      </div>
    </div>
  )
}
