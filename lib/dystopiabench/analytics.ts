import type { ComplianceRating, BenchmarkResult } from "./types"

export interface ResultsIndex {
  byModel: Map<string, BenchmarkResult[]>
  byScenario: Map<string, BenchmarkResult[]>
  byScenarioLevel: Map<string, BenchmarkResult[]>
  byScenarioModelLevel: Map<string, BenchmarkResult>
  modelIds: string[]
  scenarioIds: string[]
}

function getRowRefusalRate(result: BenchmarkResult): number {
  if (typeof result.refusalRate === "number") {
    return result.refusalRate / 100
  }

  return result.compliance === "refusal" ? 1 : 0
}

function scenarioLevelKey(scenarioId: string, level: number): string {
  return `${scenarioId}::${level}`
}

function scenarioModelLevelKey(scenarioId: string, modelId: string, level: number): string {
  return `${scenarioId}::${modelId}::${level}`
}

export function createResultsIndex(results: BenchmarkResult[]): ResultsIndex {
  const byModel = new Map<string, BenchmarkResult[]>()
  const byScenario = new Map<string, BenchmarkResult[]>()
  const byScenarioLevel = new Map<string, BenchmarkResult[]>()
  const byScenarioModelLevel = new Map<string, BenchmarkResult>()

  for (const result of results) {
    const modelRows = byModel.get(result.modelId)
    if (modelRows) {
      modelRows.push(result)
    } else {
      byModel.set(result.modelId, [result])
    }

    const scenarioRows = byScenario.get(result.scenarioId)
    if (scenarioRows) {
      scenarioRows.push(result)
    } else {
      byScenario.set(result.scenarioId, [result])
    }

    const scenarioLevelRows = byScenarioLevel.get(scenarioLevelKey(result.scenarioId, result.level))
    if (scenarioLevelRows) {
      scenarioLevelRows.push(result)
    } else {
      byScenarioLevel.set(scenarioLevelKey(result.scenarioId, result.level), [result])
    }

    byScenarioModelLevel.set(
      scenarioModelLevelKey(result.scenarioId, result.modelId, result.level),
      result,
    )
  }

  return {
    byModel,
    byScenario,
    byScenarioLevel,
    byScenarioModelLevel,
    modelIds: [...byModel.keys()],
    scenarioIds: [...byScenario.keys()],
  }
}

function getResultsIndex(results: BenchmarkResult[], index?: ResultsIndex): ResultsIndex {
  return index ?? createResultsIndex(results)
}

export function getAggregateByModel(results: BenchmarkResult[], resultsIndex?: ResultsIndex) {
  const index = getResultsIndex(results, resultsIndex)

  return Array.from(index.byModel.entries())
    .map(([id, rows]) => ({
      modelId: id,
      label: rows[0]?.modelLabel ?? id,
      provider: rows[0]?.provider ?? "Unknown",
      avgScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
      totalTests: rows.length,
      meanReplicates:
        rows.length === 0
          ? 0
          : Number((rows.reduce((sum, row) => sum + (row.replicateCount ?? 1), 0) / rows.length).toFixed(2)),
      meanWithinTupleStdDev:
        rows.length === 0
          ? 0
          : Number((rows.reduce((sum, row) => sum + (row.scoreStdDev ?? 0), 0) / rows.length).toFixed(2)),
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
}

/**
 * DRFR = Directed Refusal Rate: the percentage of scored responses (replicates included) that
 * were rated Refusal (DCS = 0 on the V1 scale), per model.
 */
export function getDRFRByModel(results: BenchmarkResult[], resultsIndex?: ResultsIndex) {
  const index = getResultsIndex(results, resultsIndex)

  return Array.from(index.byModel.entries())
    .map(([id, rows]) => ({
      modelId: id,
      label: rows[0]?.modelLabel ?? id,
      provider: rows[0]?.provider ?? "Unknown",
      drfr: Math.round((rows.reduce((sum, row) => sum + getRowRefusalRate(row), 0) / rows.length) * 100),
    }))
    .sort((a, b) => b.drfr - a.drfr)
}

// Missing data is null (rendered as a gap), never 0, which would read as a perfect V1 score.
export function getEscalationCurveByModel(results: BenchmarkResult[], resultsIndex?: ResultsIndex) {
  const index = getResultsIndex(results, resultsIndex)

  return [1, 2, 3, 4, 5].map((level) => {
    const row: Record<string, number | string | null> = { level: `L${level}` }
    for (const [modelId, modelRows] of index.byModel) {
      const levelRows = modelRows.filter((candidate) => candidate.level === level)
      row[modelId] =
        levelRows.length > 0
          ? Math.round(levelRows.reduce((sum, candidate) => sum + candidate.score, 0) / levelRows.length)
          : null
    }
    return row
  })
}

export function getEscalationCurve(results: BenchmarkResult[]) {
  return [1, 2, 3, 4, 5].map((level) => {
    const levelRows = results.filter((candidate) => candidate.level === level)

    return {
      level: `L${level}`,
      avgScore:
        levelRows.length > 0
          ? Math.round(levelRows.reduce((sum, candidate) => sum + candidate.score, 0) / levelRows.length)
          : null,
    }
  })
}

export function getComplianceDistribution(results: BenchmarkResult[]) {
  const dist: Record<ComplianceRating, number> = {
    refusal: 0,
    hesitant: 0,
    compliant: 0,
    proactive: 0,
  }
  for (const r of results) dist[r.compliance]++
  // Keep the chart focused on ratings that are present in the selected dataset.
  return Object.entries(dist)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      key: key as ComplianceRating,
      count,
      pct: Math.round((count / results.length) * 100),
    }))
}

export function getModelByScenarioHeatmap(results: BenchmarkResult[], resultsIndex?: ResultsIndex) {
  const index = getResultsIndex(results, resultsIndex)

  return index.scenarioIds.map((scenarioId) => {
    const scenarioRows = index.byScenario.get(scenarioId) ?? []
    const row: Record<string, number | string | null> = { scenarioId }
    row.scenarioTitle = scenarioRows[0]?.scenarioTitle ?? scenarioId

    for (const modelId of index.modelIds) {
      const modelRows = scenarioRows.filter((candidate) => candidate.modelId === modelId)
      row[modelId] =
        modelRows.length > 0
          ? Math.round(modelRows.reduce((sum, candidate) => sum + candidate.score, 0) / modelRows.length)
          : null
    }
    return row
  })
}
