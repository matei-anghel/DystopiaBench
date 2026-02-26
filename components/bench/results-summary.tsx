"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ComplianceRating } from "@/lib/dystopiabench/types"
import { COMPLIANCE_LABELS, COMPLIANCE_SCORES } from "@/lib/dystopiabench/types"
import { ShieldCheck, ShieldAlert, ShieldX, Minus, AlertTriangle } from "lucide-react"

interface ResultEntry {
  scenarioId: string
  scenarioTitle: string
  modelId: string
  modelLabel: string
  level: number
  compliance: ComplianceRating
  score: number
}

interface ResultsSummaryProps {
  results: ResultEntry[]
}

const COMPLIANCE_ICONS: Record<ComplianceRating, React.ReactNode> = {
  full_refusal: <ShieldCheck className="h-3.5 w-3.5 text-accent" />,
  soft_refusal: <ShieldCheck className="h-3.5 w-3.5 text-chart-2" />,
  partial_compliance: <Minus className="h-3.5 w-3.5 text-warning" />,
  soft_compliance: <ShieldAlert className="h-3.5 w-3.5 text-primary" />,
  full_compliance: <ShieldX className="h-3.5 w-3.5 text-destructive" />,
}

function getModelSummary(results: ResultEntry[], modelId: string) {
  const modelResults = results.filter((r) => r.modelId === modelId)
  if (modelResults.length === 0) return null

  const avgScore =
    modelResults.reduce((sum, r) => sum + r.score, 0) / modelResults.length

  const complianceBreakdown = {
    full_refusal: modelResults.filter((r) => r.compliance === "full_refusal").length,
    soft_refusal: modelResults.filter((r) => r.compliance === "soft_refusal").length,
    partial_compliance: modelResults.filter((r) => r.compliance === "partial_compliance").length,
    soft_compliance: modelResults.filter((r) => r.compliance === "soft_compliance").length,
    full_compliance: modelResults.filter((r) => r.compliance === "full_compliance").length,
  }

  const levelAvgs: Record<number, number> = {}
  for (let l = 1; l <= 5; l++) {
    const levelResults = modelResults.filter((r) => r.level === l)
    if (levelResults.length > 0) {
      levelAvgs[l] = levelResults.reduce((s, r) => s + r.score, 0) / levelResults.length
    }
  }

  return {
    modelId,
    modelLabel: modelResults[0].modelLabel,
    totalTests: modelResults.length,
    avgScore,
    complianceBreakdown,
    levelAvgs,
  }
}

function ComplianceBar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 flex-1 rounded-full bg-muted/50 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s <= 20) return "text-accent"
    if (s <= 40) return "text-chart-2"
    if (s <= 60) return "text-warning"
    if (s <= 80) return "text-primary"
    return "text-destructive"
  }

  const getLabel = (s: number) => {
    if (s <= 20) return "Strong Refusal"
    if (s <= 40) return "Resistant"
    if (s <= 60) return "Ambivalent"
    if (s <= 80) return "Susceptible"
    return "Highly Compliant"
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-mono text-3xl font-black ${getColor(score)}`}>
        {Math.round(score)}
      </span>
      <span className={`font-mono text-[10px] tracking-wider uppercase ${getColor(score)}`}>
        {getLabel(score)}
      </span>
    </div>
  )
}

export function ResultsSummary({ results }: ResultsSummaryProps) {
  const modelIds = [...new Set(results.map((r) => r.modelId))]
  const summaries = modelIds
    .map((id) => getModelSummary(results, id))
    .filter(Boolean)
    .sort((a, b) => (a?.avgScore ?? 0) - (b?.avgScore ?? 0))

  if (summaries.length === 0) {
    return (
      <Card className="bg-card border-border p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-mono text-sm text-muted-foreground">
          No results yet. Run a benchmark to see model comparisons.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-mono text-sm font-bold tracking-wider text-foreground uppercase">
          Model Comparison
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          Lower score = stronger refusal = better safety
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => {
          if (!summary) return null

          return (
            <Card key={summary.modelId} className="bg-card border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-mono text-xs font-bold text-foreground">
                    {summary.modelLabel}
                  </h4>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {summary.totalTests} tests
                  </p>
                </div>
                <ScoreGauge score={summary.avgScore} />
              </div>

              {/* Compliance Breakdown */}
              <div className="flex flex-col gap-1.5 mb-4">
                {(Object.keys(summary.complianceBreakdown) as ComplianceRating[]).map(
                  (key) => (
                    <div key={key} className="flex items-center gap-2">
                      {COMPLIANCE_ICONS[key]}
                      <span className="font-mono text-[10px] text-muted-foreground w-28 shrink-0">
                        {COMPLIANCE_LABELS[key]}
                      </span>
                      <ComplianceBar
                        value={summary.complianceBreakdown[key]}
                        max={summary.totalTests}
                        color={
                          key === "full_refusal"
                            ? "bg-accent"
                            : key === "soft_refusal"
                            ? "bg-chart-2"
                            : key === "partial_compliance"
                            ? "bg-warning"
                            : key === "soft_compliance"
                            ? "bg-primary"
                            : "bg-destructive"
                        }
                      />
                      <span className="font-mono text-[10px] text-muted-foreground w-6 text-right">
                        {summary.complianceBreakdown[key]}
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* Escalation Curve */}
              <div className="border-t border-border pt-3">
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase mb-2">
                  Score by Escalation Level
                </p>
                <div className="flex items-end gap-1 h-12">
                  {[1, 2, 3, 4, 5].map((l) => {
                    const avg = summary.levelAvgs[l]
                    if (avg === undefined) return (
                      <div key={l} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full rounded-sm bg-muted/30 h-1" />
                        <span className="font-mono text-[8px] text-muted-foreground">L{l}</span>
                      </div>
                    )

                    const height = Math.max(2, (avg / 100) * 40)
                    const color =
                      avg <= 20 ? "bg-accent" :
                      avg <= 40 ? "bg-chart-2" :
                      avg <= 60 ? "bg-warning" :
                      avg <= 80 ? "bg-primary" :
                      "bg-destructive"

                    return (
                      <div key={l} className="flex-1 flex flex-col items-center gap-0.5 justify-end">
                        <span className="font-mono text-[8px] text-muted-foreground">{Math.round(avg)}</span>
                        <div
                          className={`w-full rounded-sm ${color} transition-all`}
                          style={{ height: `${height}px` }}
                        />
                        <span className="font-mono text-[8px] text-muted-foreground">L{l}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
