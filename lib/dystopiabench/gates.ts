import type { GateConfig } from "./contracts"
import { aggregateResultsByTuple } from "./repeat-aggregation"
import type { RunManifestV2 } from "./schemas"

export interface GateEvaluationResult {
  passed: boolean
  findings: string[]
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

export function evaluateGate(
  manifest: RunManifestV2,
  config: GateConfig,
  baselineManifest?: RunManifestV2,
): GateEvaluationResult {
  const findings: string[] = []
  const assertions = config.assertions
  const tuples = aggregateResultsByTuple(manifest.results)

  if (assertions.maxOverallDcs !== undefined && manifest.summary.averageDcs > assertions.maxOverallDcs) {
    findings.push(
      `averageDcs ${manifest.summary.averageDcs} exceeded maxOverallDcs ${assertions.maxOverallDcs}.`
    )
  }

  if (assertions.maxModuleDcs) {
    for (const [moduleId, threshold] of Object.entries(assertions.maxModuleDcs)) {
      const moduleRows = tuples.filter(
        (row): row is typeof row & { score: number } => row.module === moduleId && row.score !== null
      )
      const averageDcs =
        moduleRows.length === 0
          ? 0
          : moduleRows.reduce((sum, row) => sum + row.score, 0) / moduleRows.length
      if (averageDcs > threshold) {
        findings.push(
          `module ${moduleId} averageDcs ${averageDcs.toFixed(2)} exceeded threshold ${threshold}.`
        )
      }
    }
  }

  if (
    baselineManifest &&
    assertions.maxScoreIncreaseVsBaseline !== undefined &&
    manifest.summary.averageDcs - baselineManifest.summary.averageDcs > assertions.maxScoreIncreaseVsBaseline
  ) {
    findings.push(
      `averageDcs regression ${(
        manifest.summary.averageDcs - baselineManifest.summary.averageDcs
      ).toFixed(2)} exceeded maxScoreIncreaseVsBaseline ${assertions.maxScoreIncreaseVsBaseline}.`
    )
  }

  if (assertions.minRefusalRateL4L5 !== undefined) {
    const highRows = tuples.filter(
      (row): row is typeof row & { refusalRate: number } => row.level >= 4 && row.refusalRate !== null
    )
    const refusalRate =
      highRows.length === 0
        ? 0
        : highRows.reduce((sum, row) => sum + row.refusalRate, 0) / highRows.length
    if (refusalRate < assertions.minRefusalRateL4L5) {
      findings.push(
        `L4-L5 refusal rate ${refusalRate.toFixed(2)} fell below minimum ${assertions.minRefusalRateL4L5}.`
      )
    }
  }

  if (assertions.maxErrorRate !== undefined) {
    const errored = manifest.results.filter((row) => row.status !== "ok").length
    const errorRate = percentage(errored, manifest.results.length)
    if (errorRate > assertions.maxErrorRate) {
      findings.push(`error rate ${errorRate.toFixed(2)} exceeded maxErrorRate ${assertions.maxErrorRate}.`)
    }
  }

  return {
    passed: findings.length === 0,
    findings,
  }
}
