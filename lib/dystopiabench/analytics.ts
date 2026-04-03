import type { Module, ComplianceRating, BenchmarkResult } from "./types"

export interface ResultsIndex {
  byModel: Map<string, BenchmarkResult[]>
  byLocale: Map<string, BenchmarkResult[]>
  byScenario: Map<string, BenchmarkResult[]>
  byScenarioLevel: Map<string, BenchmarkResult[]>
  byScenarioModelLevel: Map<string, BenchmarkResult>
  modelIds: string[]
  localeIds: string[]
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
  const byLocale = new Map<string, BenchmarkResult[]>()
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

    const locale = result.promptLocale ?? "en"
    const localeRows = byLocale.get(locale)
    if (localeRows) {
      localeRows.push(result)
    } else {
      byLocale.set(locale, [result])
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
    byLocale,
    byScenario,
    byScenarioLevel,
    byScenarioModelLevel,
    modelIds: [...byModel.keys()],
    localeIds: [...byLocale.keys()],
    scenarioIds: [...byScenario.keys()],
  }
}

export function getChartShape(results: BenchmarkResult[]) {
  const modelIds = new Set<string>()
  const localeIds = new Set<string>()
  const scenarioIds = new Set<string>()
  const modules = new Set<Module>()

  for (const result of results) {
    modelIds.add(result.modelId)
    localeIds.add(result.promptLocale ?? "en")
    scenarioIds.add(result.scenarioId)
    modules.add(result.module)
  }

  return {
    modelCount: modelIds.size,
    localeCount: localeIds.size,
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
      meanReplicates:
        rows.length === 0
          ? 0
          : Number(
            (
              rows.reduce((sum, row) => sum + (row.replicateCount ?? 1), 0) / rows.length
            ).toFixed(2),
          ),
      meanWithinTupleStdDev:
        rows.length === 0
          ? 0
          : Number(
            (
              rows.reduce((sum, row) => sum + (row.scoreStdDev ?? 0), 0) / rows.length
            ).toFixed(2),
          ),
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
}

/**
 * DRFR = Directed Refusal to Failure Ratio
 * Percentage of test runs that resulted in a Refusal (DCS = 0).
 */
export function getDRFR(results: BenchmarkResult[]): number {
  if (results.length === 0) return 0
  return Math.round((results.reduce((sum, row) => sum + getRowRefusalRate(row), 0) / results.length) * 100)
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
      drfr: Math.round((rows.reduce((sum, row) => sum + getRowRefusalRate(row), 0) / rows.length) * 100),
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

export function getAvailablePromptLocales(results: BenchmarkResult[]): string[] {
  return [...new Set(results.map((result) => result.promptLocale ?? "en"))].sort((left, right) =>
    left.localeCompare(right),
  )
}

export function getAggregateByLocale(results: BenchmarkResult[]) {
  const index = createResultsIndex(results)
  return Array.from(index.byLocale.entries())
    .map(([locale, rows]) => ({
      locale,
      avgScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
      drfr: Math.round((rows.reduce((sum, row) => sum + getRowRefusalRate(row), 0) / rows.length) * 100),
      totalTests: rows.length,
      modelCount: new Set(rows.map((row) => row.modelId)).size,
      scenarioCount: new Set(rows.map((row) => row.canonicalScenarioId ?? row.scenarioId)).size,
    }))
    .sort((a, b) => a.avgScore - b.avgScore || a.locale.localeCompare(b.locale))
}

export function getLocaleModuleMatrix(results: BenchmarkResult[]) {
  const locales = getAvailablePromptLocales(results)
  const groupingKeys = [...new Set(results.map((row) => row.module))]

  return locales.map((locale) => {
    const localeRows = results.filter((row) => (row.promptLocale ?? "en") === locale)
    const row: Record<string, string | number> = { locale }
    for (const groupingKey of groupingKeys) {
      const groupedRows = localeRows.filter((candidate) => candidate.module === groupingKey)
      row[String(groupingKey)] =
        groupedRows.length > 0
          ? Math.round(groupedRows.reduce((sum, candidate) => sum + candidate.score, 0) / groupedRows.length)
          : 0
    }
    return row
  })
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

export function getEscalationCurve(results: BenchmarkResult[]) {
  return [1, 2, 3, 4, 5].map((level) => {
    const levelRows = results.filter((candidate) => candidate.level === level)

    return {
      level: `L${level}`,
      avgScore:
        levelRows.length > 0
          ? Math.round(levelRows.reduce((sum, candidate) => sum + candidate.score, 0) / levelRows.length)
          : 0,
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
