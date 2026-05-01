import type {
  BenchmarkResultV2,
  BenchmarkStatus,
  ComplianceRating,
} from "./schemas"
import { COMPLIANCE_SCORES } from "./types"

const BENCHMARK_STATUSES = [
  "ok",
  "model_error",
  "judge_error",
  "aborted",
  "invalid_response",
  "skipped",
] as const satisfies readonly BenchmarkStatus[]

function createEmptyStatusCounts(): Record<BenchmarkStatus, number> {
  return {
    ok: 0,
    model_error: 0,
    judge_error: 0,
    aborted: 0,
    invalid_response: 0,
    skipped: 0,
  }
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2))
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return roundToTwo(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function calculateScoreStdDev(scores: number[]): number {
  if (scores.length <= 1) return 0
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length
  return roundToTwo(Math.sqrt(variance))
}

function scoreToCompliance(score: number): ComplianceRating {
  const entries = Object.entries(COMPLIANCE_SCORES) as Array<[ComplianceRating, number]>

  return entries.reduce<{
    compliance: ComplianceRating
    diff: number
    rawScore: number
  } | null>((best, [compliance, rawScore]) => {
    const diff = Math.abs(rawScore - score)
    if (!best || diff < best.diff || (diff === best.diff && rawScore < best.rawScore)) {
      return { compliance, diff, rawScore }
    }
    return best
  }, null)?.compliance ?? "hesitant"
}

function tupleKey(row: Pick<BenchmarkResultV2, "scenarioId" | "modelId" | "level" | "promptLocale">): string {
  return `${row.scenarioId}::${row.promptLocale ?? "en"}::${row.modelId}::${row.level}`
}

function isScoredRow(row: BenchmarkResultV2): row is BenchmarkResultV2 & { score: number } {
  return typeof row.score === "number"
}

export interface AggregatedTupleResult {
  scenarioId: string
  canonicalScenarioId?: string
  scenarioTitle: string
  scenarioCategory: string
  module: string
  modelId: string
  modelLabel: string
  provider: string
  level: number
  score: number | null
  compliance: ComplianceRating
  promptLocale?: string
  sourceLocale?: string
  refusalRate: number | null
  scoreStdDev: number
  observedReplicates: number
  scoredReplicates: number
  reliableScore: number | null
  statusCounts: Record<BenchmarkStatus, number>
}

export function aggregateResultsByTuple(results: BenchmarkResultV2[]): AggregatedTupleResult[] {
  const grouped = new Map<string, BenchmarkResultV2[]>()

  for (const result of results) {
    const key = tupleKey(result)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(result)
    } else {
      grouped.set(key, [result])
    }
  }

  return [...grouped.values()].map((rows) => {
    const sample = rows[0]
    const scoredRows = rows.filter(isScoredRow)
    const reliableScoredRows = scoredRows.filter(
      (row) => row.status === "ok" && row.implicitRefusalFromEmpty !== true,
    )
    const scores = scoredRows.map((row) => row.score)
    const meanScore = average(scores)
    const refusalRate =
      scoredRows.length === 0
        ? null
        : roundToTwo(
          (scoredRows.filter((row) => row.compliance === "refusal").length / scoredRows.length) * 100,
        )

    const statusCounts = createEmptyStatusCounts()
    for (const row of rows) {
      statusCounts[row.status] += 1
    }

    return {
      scenarioId: sample.scenarioId,
      ...(sample.canonicalScenarioId ? { canonicalScenarioId: sample.canonicalScenarioId } : {}),
      scenarioTitle: sample.scenarioTitle,
      scenarioCategory: sample.scenarioCategory,
      module: sample.module,
      modelId: sample.modelId,
      modelLabel: sample.modelLabel,
      provider: sample.provider,
      level: sample.level,
      score: meanScore,
      compliance: meanScore === null ? sample.compliance : scoreToCompliance(meanScore),
      ...(sample.promptLocale ? { promptLocale: sample.promptLocale } : {}),
      ...(sample.sourceLocale ? { sourceLocale: sample.sourceLocale } : {}),
      refusalRate,
      scoreStdDev: calculateScoreStdDev(scores),
      observedReplicates: rows.length,
      scoredReplicates: scoredRows.length,
      reliableScore: average(reliableScoredRows.map((row) => row.score)),
      statusCounts,
    }
  })
}

export interface RepeatStatsSummary {
  targetReplicates: number
  totalTuples: number
  scoredTuples: number
  averageObservedReplicates: number
  fullyObservedTupleCount: number
  partiallyObservedTupleCount: number
  meanWithinTupleStdDev: number
  maxWithinTupleStdDev: number
}

export function summarizeRepeatStats(
  tuples: AggregatedTupleResult[],
  options: { targetReplicates?: number } = {},
): RepeatStatsSummary {
  const targetReplicates =
    options.targetReplicates ??
    Math.max(1, ...tuples.map((tuple) => tuple.observedReplicates))
  const scoredTuples = tuples.filter((tuple) => tuple.score !== null)
  const observedReplicates = tuples.map((tuple) => tuple.observedReplicates)
  const withinTupleStdDevs = scoredTuples.map((tuple) => tuple.scoreStdDev)
  const fullyObservedTupleCount = tuples.filter(
    (tuple) => tuple.observedReplicates >= targetReplicates,
  ).length

  return {
    targetReplicates,
    totalTuples: tuples.length,
    scoredTuples: scoredTuples.length,
    averageObservedReplicates: average(observedReplicates) ?? 0,
    fullyObservedTupleCount,
    partiallyObservedTupleCount: tuples.length - fullyObservedTupleCount,
    meanWithinTupleStdDev: average(withinTupleStdDevs) ?? 0,
    maxWithinTupleStdDev:
      withinTupleStdDevs.length === 0 ? 0 : roundToTwo(Math.max(...withinTupleStdDevs)),
  }
}

export function isKnownBenchmarkStatus(value: string): value is BenchmarkStatus {
  return BENCHMARK_STATUSES.includes(value as BenchmarkStatus)
}
