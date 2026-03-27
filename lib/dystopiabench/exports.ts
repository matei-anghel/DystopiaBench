import type { ScenarioResultSummaryV1 } from "./contracts"
import type { BenchmarkResultV2, RunManifestV2 } from "./schemas"
import { createEvalCard, type EvalCard } from "./eval-card"

interface ParquetModule {
  ParquetSchema: new (schema: Record<string, unknown>) => unknown
  ParquetWriter: {
    openFile(schema: unknown, path: string): Promise<{
      appendRow(row: Record<string, unknown>): Promise<void>
      close(): Promise<void>
    }>
  }
}

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

export function manifestToOpenAIEvalsJsonl(manifest: RunManifestV2): string {
  return manifest.results
    .map((row) =>
      JSON.stringify({
        input: row.prompt,
        ideal: row.primaryComplianceLabel ?? row.compliance,
        metadata: {
          runId: manifest.runId,
          sampleId: row.sampleId,
          scenarioId: row.scenarioId,
          scenarioTitle: row.scenarioTitle,
          module: row.module,
          level: row.level,
          modelId: row.modelId,
          attemptId: row.attemptId,
          status: row.status,
          split: row.scenarioSplit,
        },
      })
    )
    .join("\n")
}

export function manifestToInspectLog(manifest: RunManifestV2): Record<string, unknown> {
  return {
    version: 1,
    run_id: manifest.runId,
    benchmark: manifest.metadata.benchmarkDefinition?.benchmarkId ?? "dystopiabench",
    task: manifest.metadata.benchmarkDefinition?.benchmarkBundleId ?? manifest.metadata.datasetBundleVersion,
    metadata: {
      judge_model: manifest.metadata.judgeModel,
      judge_models: manifest.metadata.judgeModels ?? [],
      judge_strategy: manifest.metadata.judgeStrategy,
      conversation_mode: manifest.metadata.conversationMode,
      split_summary: manifest.metadata.splitSummary ?? manifest.metadata.benchmarkDefinition?.splitSummary ?? {},
    },
    samples: manifest.results.map((row) => ({
      id: row.sampleId ?? `${row.scenarioId}:${row.modelId}:L${row.level}:r${row.replicate ?? 1}`,
      input: row.prompt,
      target: row.primaryComplianceLabel ?? row.compliance,
      scores: row.score === null ? {} : { dcs: row.score },
      messages: [
        { role: "user", content: row.prompt },
        { role: "assistant", content: row.response },
      ],
      metadata: {
        scenario_id: row.scenarioId,
        scenario_title: row.scenarioTitle,
        scenario_category: row.scenarioCategory,
        module: row.module,
        level: row.level,
        provider: row.provider,
        model: row.modelId,
        status: row.status,
        attempt_id: row.attemptId,
        split: row.scenarioSplit,
        prompt_hash: row.promptHash,
        response_hash: row.responseHash,
      },
    })),
  }
}

export function createRunEvalCard(manifest: RunManifestV2): EvalCard {
  return createEvalCard(manifest)
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
    ["artifactPolicy", manifest.metadata.artifactPolicy ? JSON.stringify(manifest.metadata.artifactPolicy) : undefined],
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

async function loadParquetModule(): Promise<ParquetModule> {
  try {
    const loaded = (await import("parquetjs-lite")) as Record<string, unknown>
    const candidate = (
      ("ParquetSchema" in loaded && "ParquetWriter" in loaded ? loaded : loaded.default) ??
      loaded["module.exports"]
    ) as Partial<ParquetModule> | undefined

    if (!candidate?.ParquetSchema || !candidate?.ParquetWriter) {
      throw new Error("Resolved parquetjs-lite module does not expose ParquetSchema and ParquetWriter.")
    }

    return candidate as ParquetModule
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Parquet export requires 'parquetjs-lite' to be installed and resolvable. Original error: ${message}`
    )
  }
}

export async function writePromptRowsParquet(path: string, manifest: RunManifestV2): Promise<void> {
  const { ParquetSchema, ParquetWriter } = await loadParquetModule()
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
  const { ParquetSchema, ParquetWriter } = await loadParquetModule()
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
  const { ParquetSchema, ParquetWriter } = await loadParquetModule()
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
