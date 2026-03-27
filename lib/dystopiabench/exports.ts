import type { ScenarioResultSummaryV1 } from "./contracts"
import type { BenchmarkResultV2, RunManifestV2 } from "./schemas"
import { ParquetSchema, ParquetWriter } from "parquetjs-lite"

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

function variance(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = average(values)
  const value = values.reduce((sum, score) => sum + (score - mean) ** 2, 0) / values.length
  return Number(value.toFixed(2))
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

export function buildScenarioSummaries(results: BenchmarkResultV2[]): ScenarioResultSummaryV1[] {
  const grouped = new Map<string, BenchmarkResultV2[]>()

  for (const result of results) {
    const key = [result.scenarioId, result.modelId, result.provider].join("::")
    const rows = grouped.get(key)
    if (rows) {
      rows.push(result)
    } else {
      grouped.set(key, [result])
    }
  }

  return [...grouped.values()]
    .map((rows) => {
      const sample = rows[0]
      const scoredRows = rows.filter((row): row is BenchmarkResultV2 & { score: number } => row.score !== null)
      const scores = scoredRows.map((row) => row.score)
      const l1L2 = scoredRows.filter((row) => row.level <= 2).map((row) => row.score)
      const l3L5 = scoredRows.filter((row) => row.level >= 3).map((row) => row.score)
      const okRows = rows.filter((row) => row.status === "ok").length
      const refusalRows = scoredRows.filter((row) => row.compliance === "refusal").length

      return {
        scenarioId: sample.scenarioId,
        scenarioTitle: sample.scenarioTitle,
        module: sample.module,
        category: sample.scenarioCategory,
        modelId: sample.modelId,
        provider: sample.provider,
        scoredPrompts: scoredRows.length,
        averageDcs: average(scores),
        variance: variance(scores),
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        refusalRate: percentage(refusalRows, scoredRows.length),
        l1L2AverageDcs: l1L2.length > 0 ? average(l1L2) : null,
        l3L5AverageDcs: l3L5.length > 0 ? average(l3L5) : null,
        okRate: percentage(okRows, rows.length),
      } satisfies ScenarioResultSummaryV1
    })
    .sort((left, right) =>
      left.scenarioId.localeCompare(right.scenarioId) ||
      left.modelId.localeCompare(right.modelId)
    )
}

export function manifestToJsonl(manifest: RunManifestV2): string {
  return manifest.results.map((row) => JSON.stringify(row)).join("\n")
}

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ""
  const asString = String(value)
  if (/[",\n]/.test(asString)) {
    return `"${asString.replace(/"/g, "\"\"")}"`
  }
  return asString
}

export function scenarioSummariesToCsv(rows: ScenarioResultSummaryV1[]): string {
  const headers = [
    "scenarioId",
    "scenarioTitle",
    "module",
    "category",
    "modelId",
    "provider",
    "scoredPrompts",
    "averageDcs",
    "variance",
    "minScore",
    "maxScore",
    "refusalRate",
    "l1L2AverageDcs",
    "l3L5AverageDcs",
    "okRate",
  ]

  const lines = rows.map((row) =>
    headers
      .map((header) => escapeCsvField(row[header as keyof ScenarioResultSummaryV1] as string | number | null))
      .join(",")
  )

  return [headers.join(","), ...lines].join("\n")
}

export function runMetadataToCsv(manifest: RunManifestV2): string {
  const rows: Array<[string, string | number | boolean | null | undefined]> = [
    ["runId", manifest.runId],
    ["schemaVersion", manifest.schemaVersion],
    ["date", manifest.date],
    ["experimentId", manifest.metadata.experimentId],
    ["benchmarkBundleId", manifest.metadata.benchmarkDefinition?.benchmarkBundleId],
    ["datasetBundleVersion", manifest.metadata.datasetBundleVersion],
    ["scenarioCatalogVersion", manifest.metadata.scenarioCatalogVersion],
    ["judgeModel", manifest.metadata.judgeModel],
    ["judgeStrategy", manifest.metadata.judgeStrategy],
    ["conversationMode", manifest.metadata.conversationMode],
    ["transportPolicy", manifest.metadata.transportPolicy],
    ["replicates", manifest.metadata.replicates],
    ["averageDcs", manifest.summary.averageDcs],
    ["drfr", manifest.summary.drfr],
    ["modelSuccessRate", manifest.summary.modelSuccessRate],
    ["judgeSuccessRate", manifest.summary.judgeSuccessRate],
    ["scorableRate", manifest.summary.scorableRate],
    ["l1L2AverageDcs", manifest.summary.riskSlices?.l1L2AverageDcs],
    ["l3L5AverageDcs", manifest.summary.riskSlices?.l3L5AverageDcs],
    ["reliabilityAdjustedAverageDcs", manifest.summary.riskSlices?.reliabilityAdjustedAverageDcs],
    ["auxiliaryLabelCoverageRate", manifest.summary.auxiliaryLabelCoverage?.rowCoverageRate],
  ]

  return [
    "key,value",
    ...rows.map(([key, value]) => `${escapeCsvField(key)},${escapeCsvField(value)}`),
  ].join("\n")
}

function normalizeParquetValue(value: unknown): string | number | boolean | null {
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return JSON.stringify(value)
}

export async function writePromptRowsParquet(path: string, manifest: RunManifestV2): Promise<void> {
  const schema = new ParquetSchema({
    scenarioId: { type: "UTF8" },
    scenarioTitle: { type: "UTF8" },
    scenarioCategory: { type: "UTF8" },
    module: { type: "UTF8" },
    modelId: { type: "UTF8" },
    modelLabel: { type: "UTF8" },
    provider: { type: "UTF8" },
    modelString: { type: "UTF8" },
    level: { type: "INT64" },
    compliance: { type: "UTF8" },
    score: { type: "INT64", optional: true },
    status: { type: "UTF8" },
    scorable: { type: "BOOLEAN", optional: true },
    replicate: { type: "INT64", optional: true },
    experimentId: { type: "UTF8", optional: true },
    endpointUsed: { type: "UTF8", optional: true },
    transportAttempts: { type: "INT64", optional: true },
    prompt: { type: "UTF8" },
    response: { type: "UTF8" },
    auxiliaryLabels: { type: "UTF8", optional: true },
  })

  const writer = await ParquetWriter.openFile(schema, path)
  try {
    for (const row of manifest.results) {
      await writer.appendRow({
        scenarioId: row.scenarioId,
        scenarioTitle: row.scenarioTitle,
        scenarioCategory: row.scenarioCategory,
        module: row.module,
        modelId: row.modelId,
        modelLabel: row.modelLabel,
        provider: row.provider,
        modelString: row.modelString,
        level: row.level,
        compliance: row.compliance,
        score: row.score ?? undefined,
        status: row.status,
        scorable: row.scorable,
        replicate: row.replicate,
        experimentId: row.experimentId,
        endpointUsed: row.endpointUsed,
        transportAttempts: row.transportAttempts,
        prompt: row.prompt,
        response: row.response,
        auxiliaryLabels: row.auxiliaryLabels ? JSON.stringify(row.auxiliaryLabels) : undefined,
      })
    }
  } finally {
    await writer.close()
  }
}

export async function writeScenarioSummariesParquet(path: string, rows: ScenarioResultSummaryV1[]): Promise<void> {
  const schema = new ParquetSchema({
    scenarioId: { type: "UTF8" },
    scenarioTitle: { type: "UTF8" },
    module: { type: "UTF8" },
    category: { type: "UTF8" },
    modelId: { type: "UTF8" },
    provider: { type: "UTF8" },
    scoredPrompts: { type: "INT64" },
    averageDcs: { type: "DOUBLE" },
    variance: { type: "DOUBLE" },
    minScore: { type: "DOUBLE" },
    maxScore: { type: "DOUBLE" },
    refusalRate: { type: "DOUBLE" },
    l1L2AverageDcs: { type: "DOUBLE", optional: true },
    l3L5AverageDcs: { type: "DOUBLE", optional: true },
    okRate: { type: "DOUBLE" },
  })

  const writer = await ParquetWriter.openFile(schema, path)
  try {
    for (const row of rows) {
      await writer.appendRow(row)
    }
  } finally {
    await writer.close()
  }
}

export async function writeRunMetadataParquet(path: string, manifest: RunManifestV2): Promise<void> {
  const schema = new ParquetSchema({
    key: { type: "UTF8" },
    value: { type: "UTF8", optional: true },
  })

  const writer = await ParquetWriter.openFile(schema, path)
  try {
    const entries: Array<[string, unknown]> = [
      ["runId", manifest.runId],
      ["schemaVersion", manifest.schemaVersion],
      ["date", manifest.date],
      ["module", manifest.metadata.module],
      ["models", manifest.metadata.models.join(",")],
      ["levels", manifest.metadata.levels.join(",")],
      ["experimentId", manifest.metadata.experimentId],
      ["benchmarkBundleId", manifest.metadata.benchmarkDefinition?.benchmarkBundleId],
      ["benchmarkReleaseTier", manifest.metadata.benchmarkDefinition?.releaseTier],
      ["datasetBundleVersion", manifest.metadata.datasetBundleVersion],
      ["scenarioCatalogVersion", manifest.metadata.scenarioCatalogVersion],
      ["judgeModel", manifest.metadata.judgeModel],
      ["judgeStrategy", manifest.metadata.judgeStrategy],
      ["conversationMode", manifest.metadata.conversationMode],
      ["transportPolicy", manifest.metadata.transportPolicy],
      ["replicates", manifest.metadata.replicates],
      ["averageDcs", manifest.summary.averageDcs],
      ["drfr", manifest.summary.drfr],
      ["riskSlices", manifest.summary.riskSlices],
      ["auxiliaryLabelCoverage", manifest.summary.auxiliaryLabelCoverage],
    ]

    for (const [key, value] of entries) {
      await writer.appendRow({
        key,
        value: normalizeParquetValue(value)?.toString() ?? undefined,
      })
    }
  } finally {
    await writer.close()
  }
}
