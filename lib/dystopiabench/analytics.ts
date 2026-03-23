import type { Module, ComplianceRating, BenchmarkResult } from "./types"

export interface ResultsIndex {
  byModel: Map<string, BenchmarkResult[]>
  byScenario: Map<string, BenchmarkResult[]>
  byScenarioLevel: Map<string, BenchmarkResult[]>
  byScenarioModelLevel: Map<string, BenchmarkResult>
  modelIds: string[]
  scenarioIds: string[]
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

export function getChartShape(results: BenchmarkResult[]) {
  const modelIds = new Set<string>()
  const scenarioIds = new Set<string>()
  const modules = new Set<Module>()

  for (const result of results) {
    modelIds.add(result.modelId)
    scenarioIds.add(result.scenarioId)
    modules.add(result.module)
  }

  return {
    modelCount: modelIds.size,
    scenarioCount: scenarioIds.size,
    moduleCount: modules.size,
    hasSingleModel: modelIds.size === 1,
    hasMultiModel: modelIds.size > 1,
  }
}

export function getAggregateByModel(results: BenchmarkResult[]) {
  const index = createResultsIndex(results)

  return Array.from(index.byModel.entries())
    .map(([id, rows]) => ({
      modelId: id,
      label: rows[0]?.modelLabel ?? id,
      provider: rows[0]?.provider ?? "Unknown",
      avgScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
      totalTests: rows.length,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
}

/**
 * DRFR = Directed Refusal to Failure Ratio
 * Percentage of test runs that resulted in a Refusal (DCS = 0).
 */
export function getDRFR(results: BenchmarkResult[]): number {
  if (results.length === 0) return 0
  const refusals = results.filter((r) => r.compliance === "refusal").length
  return Math.round((refusals / results.length) * 100)
}

/**
 * DRFR per model.
 */
export function getDRFRByModel(results: BenchmarkResult[]) {
  const index = createResultsIndex(results)

  return Array.from(index.byModel.entries())
    .map(([id, rows]) => ({
      modelId: id,
      label: rows[0]?.modelLabel ?? id,
      provider: rows[0]?.provider ?? "Unknown",
      drfr: Math.round((rows.filter((row) => row.compliance === "refusal").length / rows.length) * 100),
    }))
    .sort((a, b) => b.drfr - a.drfr)
}

export function getAggregateByModule(results: BenchmarkResult[]) {
  const moduleMap = new Map<Module, number[]>()
  for (const r of results) {
    const scores = moduleMap.get(r.module)
    if (scores) {
      scores.push(r.score)
    } else {
      moduleMap.set(r.module, [r.score])
    }
  }

  return Array.from(moduleMap.entries()).map(([mod, scores]) => ({
    module: mod,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    totalTests: scores.length,
  }))
}

export function getEscalationCurveByModel(results: BenchmarkResult[]) {
  const index = createResultsIndex(results)

  return [1, 2, 3, 4, 5].map((level) => {
    const row: Record<string, number | string> = { level: `L${level}` }
    for (const [modelId, modelRows] of index.byModel) {
      const levelRows = modelRows.filter((candidate) => candidate.level === level)
      row[modelId] =
        levelRows.length > 0
          ? Math.round(levelRows.reduce((sum, candidate) => sum + candidate.score, 0) / levelRows.length)
          : 0
    }
    return row
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

export function getModelByScenarioHeatmap(results: BenchmarkResult[]) {
  const index = createResultsIndex(results)

  return index.scenarioIds.map((scenarioId) => {
    const scenarioRows = index.byScenario.get(scenarioId) ?? []
    const row: Record<string, number | string> = { scenarioId }
    row.scenarioTitle = scenarioRows[0]?.scenarioTitle ?? scenarioId

    for (const modelId of index.modelIds) {
      const modelRows = scenarioRows.filter((candidate) => candidate.modelId === modelId)
      row[modelId] =
        modelRows.length > 0
          ? Math.round(modelRows.reduce((sum, candidate) => sum + candidate.score, 0) / modelRows.length)
          : 0
    }
    return row
  })
}

export function getPerPromptData(results: BenchmarkResult[], scenarioId: string) {
  const index = createResultsIndex(results)
  const scenarioRows = index.byScenario.get(scenarioId) ?? []
  const models = [...new Set(scenarioRows.map((result) => result.modelId))]

  return [1, 2, 3, 4, 5].map((level) => {
    const row: Record<string, number | string> = { level: `Level ${level}` }
    for (const modelId of models) {
      row[modelId] =
        index.byScenarioModelLevel.get(scenarioModelLevelKey(scenarioId, modelId, level))?.score ?? 0
    }
    return row
  })
}
