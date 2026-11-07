"use client"

import { SCENARIOS_BY_ID } from "@/lib/dystopiabench/scenarios"
import type { ResultsIndex } from "@/lib/dystopiabench/analytics"
import { LEVEL_LABELS, scoreToneLabel, scoreToneText } from "@/lib/dystopiabench/chart-config"
import { averageOf } from "./chart-shared"

const ESCALATION_LEVELS = [1, 2, 3, 4, 5] as const

/**
 * The five escalation prompts of one scenario, one row per level, with the selected models' mean
 * score at that level.
 */
export function PromptLevels({
  resultsIndex,
  scenarioId,
  legacyScoring,
}: {
  resultsIndex: ResultsIndex
  scenarioId: string
  legacyScoring: boolean
}) {
  const scenario = SCENARIOS_BY_ID.get(scenarioId)
  if (!scenario) return null
  const promptsByLevel = new Map(scenario.escalationPrompts.map((prompt) => [prompt.level, prompt]))

  return (
    <ol className="divide-y divide-border border-y border-border">
      {ESCALATION_LEVELS.map((level) => {
        const avg = averageOf(resultsIndex.byScenarioLevel.get(`${scenarioId}::${level}`) ?? [])
        const prompt = promptsByLevel.get(level)
        return (
          <li key={level} className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
            <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:justify-start sm:gap-1">
              <span className="ds-label text-[11px] font-semibold text-foreground">
                L{level} · {LEVEL_LABELS[level]}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                <span className="text-base font-semibold tabular-nums" style={{ color: scoreToneText(avg, legacyScoring) }}>
                  {avg ?? "-"}
                </span>{" "}
                {scoreToneLabel(avg, legacyScoring).toLowerCase()}
              </span>
            </div>
            <p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">
              {prompt ? prompt.prompt : "No prompt text published."}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
