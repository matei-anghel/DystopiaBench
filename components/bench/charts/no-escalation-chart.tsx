"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { compareSafestFirst, scaleHint } from "@/lib/dystopiabench/chart-config"
import type { DisplayModel } from "@/lib/dystopiabench/display-models"
import { averageOf } from "./chart-shared"
import { ChartSummary, SectionHeader } from "./section-header"
import { LabLogo } from "./lab-logo"

const TICKS = [0, 25, 50, 75, 100]

/**
 * Dumbbell chart: each model's mean DCS with escalation (one conversation, L1 to L5) against the
 * no-escalation ablation (every prompt in a fresh context), over the scenarios both runs cover.
 * The ablation ran a fixed subset of models, so it ignores the shared model view.
 */
export function NoEscalationChart({
  stateful,
  stateless,
  models,
  legacyScoring,
  status,
}: {
  stateful: BenchmarkResult[]
  stateless: BenchmarkResult[]
  models: DisplayModel[]
  legacyScoring: boolean
  status: "idle" | "loading" | "ready" | "error"
}) {
  const rows = useMemo(() => {
    const sharedScenarios = new Set(stateless.map((row) => row.scenarioId))
    return models
      .map((model) => {
        const withEscalation = averageOf(stateful.filter((row) => row.modelId === model.id && sharedScenarios.has(row.scenarioId)))
        const isolated = averageOf(stateless.filter((row) => row.modelId === model.id))
        return { model, withEscalation, isolated }
      })
      .filter((row): row is typeof row & { withEscalation: number; isolated: number } => row.withEscalation !== null && row.isolated !== null)
      .sort((left, right) => compareSafestFirst(left.withEscalation, right.withEscalation, legacyScoring))
  }, [legacyScoring, models, stateful, stateless])

  const scenarioCount = useMemo(() => new Set(stateless.map((row) => row.scenarioId)).size, [stateless])
  const meanShift = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + (row.withEscalation - row.isolated), 0) / rows.length)
    : null

  return (
    <Card className="bg-card border-border p-5">
      <SectionHeader
        label="One conversation vs. separate chats"
        sub={`The ${rows.length} models in the no-escalation run, on its ${scenarioCount} scenarios · ${scaleHint(legacyScoring)}`}
        picker={false}
      />
      {status !== "ready" ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          {status === "error" ? "Could not load the no-escalation results." : "Loading the no-escalation results..."}
        </p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground">No models were run without escalation in this version.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground" aria-hidden /> L1 to L5 in one conversation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" aria-hidden /> Each prompt in a new chat
            </span>
            {meanShift !== null ? (
              <span className="ml-auto text-foreground">
                Average difference {meanShift > 0 ? "+" : ""}
                {meanShift}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-x-3">
            <span />
            <div className="relative h-5">
              {TICKS.map((tick) => (
                <span
                  key={tick}
                  className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
                  style={{ left: `${tick}%` }}
                >
                  {tick}
                </span>
              ))}
            </div>
            <span />
            {rows.map(({ model, withEscalation, isolated }) => {
              const low = Math.min(withEscalation, isolated)
              const high = Math.max(withEscalation, isolated)
              const delta = withEscalation - isolated
              return (
                <div key={model.id} className="contents">
                  <span className="flex min-w-0 items-center justify-end gap-1.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                    <span className="truncate">{model.label}</span>
                    <LabLogo provider={model.provider} size={12} />
                  </span>
                  <div className="relative h-6" title={`${model.label}: ${withEscalation} with escalation, ${isolated} in fresh context`}>
                    {TICKS.map((tick) => (
                      <span key={tick} className="absolute inset-y-0 w-px bg-grid" style={{ left: `${tick}%` }} aria-hidden />
                    ))}
                    <span
                      className="absolute top-1/2 h-0.5 -translate-y-1/2"
                      style={{ left: `${low}%`, width: `${high - low}%`, background: model.color }}
                      aria-hidden
                    />
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                      style={{ left: `${isolated}%`, borderColor: model.color }}
                      aria-hidden
                    />
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${withEscalation}%`, background: model.color }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-right font-mono text-[11px] tabular-nums text-foreground">
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                </div>
              )
            })}
          </div>
          <ChartSummary>
            {rows.map((row) => `${row.model.label}: ${row.withEscalation} with escalation, ${row.isolated} in fresh context`).join(". ")}
          </ChartSummary>
        </>
      )}
    </Card>
  )
}
