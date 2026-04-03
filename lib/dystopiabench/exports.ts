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

function formatUsd(value: number | undefined): number | null {
  return typeof value === "number" ? Number(value.toFixed(8)) : null
}

function buildRowTelemetryBreakdown(row: BenchmarkResultV2) {
  return {
    benchmarkCallCount: row.telemetry?.benchmarkCalls.length ?? 0,
    judgeCallCount: row.telemetry?.judgeCalls.length ?? 0,
    totalDurationMs: row.telemetry?.totals.durationMs ?? 0,
    totalCostUsd: formatUsd(row.telemetry?.totals.costUsd),
    inputTokens: row.telemetry?.totals.inputTokens ?? 0,
    outputTokens: row.telemetry?.totals.outputTokens ?? 0,
    reasoningTokens: row.telemetry?.totals.reasoningTokens ?? 0,
    nonReasoningOutputTokens: row.telemetry?.totals.nonReasoningOutputTokens ?? 0,
    benchmarkCostUsd: formatUsd(
      row.telemetry?.benchmarkCalls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0),
    ),
    judgeCostUsd: formatUsd(
      row.telemetry?.judgeCalls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0),
    ),
  }
}

export function buildScenarioSummaries(results: BenchmarkResultV2[]): ScenarioResultSummaryV1[] {
  const grouped = new Map<string, BenchmarkResultV2[]>()

  for (const result of results) {
    const key = [result.scenarioId, result.promptLocale ?? "en", result.modelId, result.provider].join("::")
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
        canonicalScenarioId: sample.canonicalScenarioId,
        scenarioTitle: sample.scenarioTitle,
        module: sample.module,
        category: sample.scenarioCategory,
        modelId: sample.modelId,
        provider: sample.provider,
        promptLocale: sample.promptLocale,
        sourceLocale: sample.sourceLocale,
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
      (left.promptLocale ?? "en").localeCompare(right.promptLocale ?? "en") ||
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
          canonicalScenarioId: row.canonicalScenarioId,
          scenarioTitle: row.scenarioTitle,
          module: row.module,
          level: row.level,
          modelId: row.modelId,
          promptLocale: row.promptLocale ?? manifest.metadata.promptLocale,
          sourceLocale: row.sourceLocale ?? manifest.metadata.sourceLocale,
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
      prompt_locale: manifest.metadata.promptLocale,
      source_locale: manifest.metadata.sourceLocale,
      locale_pack_id: manifest.metadata.localePackId,
      split_summary: manifest.metadata.splitSummary ?? manifest.metadata.benchmarkDefinition?.splitSummary ?? {},
      telemetry: manifest.summary.telemetry
        ? {
            wall_clock_ms: manifest.summary.telemetry.wallClockMs,
            total_cost_usd: formatUsd(manifest.summary.telemetry.overall.costUsd),
            benchmark_cost_usd: formatUsd(manifest.summary.telemetry.benchmark.costUsd),
            judging_cost_usd: formatUsd(manifest.summary.telemetry.judging.costUsd),
            total_tokens: manifest.summary.telemetry.overall.totalTokens,
            reasoning_tokens: manifest.summary.telemetry.overall.reasoningTokens,
            non_reasoning_output_tokens: manifest.summary.telemetry.overall.nonReasoningOutputTokens,
          }
        : undefined,
    },
    samples: manifest.results.map((row) => ({
      id:
        row.sampleId ??
        `${row.scenarioId}:${row.promptLocale ?? manifest.metadata.promptLocale ?? "en"}:${row.modelId}:L${row.level}:r${row.replicate ?? 1}`,
      input: row.prompt,
      target: row.primaryComplianceLabel ?? row.compliance,
      scores: row.score === null ? {} : { dcs: row.score },
      messages: [
        { role: "user", content: row.prompt },
        { role: "assistant", content: row.response },
      ],
      metadata: {
        scenario_id: row.scenarioId,
        canonical_scenario_id: row.canonicalScenarioId,
        scenario_title: row.scenarioTitle,
        scenario_category: row.scenarioCategory,
        module: row.module,
        level: row.level,
        prompt_locale: row.promptLocale ?? manifest.metadata.promptLocale,
        source_locale: row.sourceLocale ?? manifest.metadata.sourceLocale,
        provider: row.provider,
        model: row.modelId,
        status: row.status,
        attempt_id: row.attemptId,
        split: row.scenarioSplit,
        prompt_hash: row.promptHash,
        response_hash: row.responseHash,
        telemetry: buildRowTelemetryBreakdown(row),
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
    "canonicalScenarioId",
    "scenarioTitle",
    "module",
    "category",
    "modelId",
    "provider",
    "promptLocale",
    "sourceLocale",
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
    ["promptLocale", manifest.metadata.promptLocale],
    ["sourceLocale", manifest.metadata.sourceLocale],
    ["localePackId", manifest.metadata.localePackId],
    ["localePreset", manifest.metadata.localePreset],
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
    ["wallClockMs", manifest.summary.telemetry?.wallClockMs],
    ["totalCostUsd", formatUsd(manifest.summary.telemetry?.overall.costUsd)],
    ["benchmarkCostUsd", formatUsd(manifest.summary.telemetry?.benchmark.costUsd)],
    ["judgingCostUsd", formatUsd(manifest.summary.telemetry?.judging.costUsd)],
    ["inputTokens", manifest.summary.telemetry?.overall.inputTokens],
    ["outputTokens", manifest.summary.telemetry?.overall.outputTokens],
    ["reasoningTokens", manifest.summary.telemetry?.overall.reasoningTokens],
    ["nonReasoningOutputTokens", manifest.summary.telemetry?.overall.nonReasoningOutputTokens],
    ["l1L2AverageDcs", manifest.summary.riskSlices?.l1L2AverageDcs],
    ["l3L5AverageDcs", manifest.summary.riskSlices?.l3L5AverageDcs],
    ["reliabilityAdjustedAverageDcs", manifest.summary.riskSlices?.reliabilityAdjustedAverageDcs],
    ["auxiliaryLabelCoverageRate", manifest.summary.auxiliaryLabelCoverage?.rowCoverageRate],
    ["traceCoverageRate", manifest.summary.evaluationAwareness?.traceCoverageRate],
    ["evaluationAwarenessRate", manifest.summary.evaluationAwareness?.evaluationAwarenessRate],
    ["deceptionSuspicionRate", manifest.summary.evaluationAwareness?.deceptionSuspicionRate],
    ["responseTraceConflictRate", manifest.summary.evaluationAwareness?.responseTraceConflictRate],
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
    canonicalScenarioId: { type: "UTF8", optional: true },
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
    benchmarkCallCount: { type: "INT64", optional: true },
    judgeCallCount: { type: "INT64", optional: true },
    totalDurationMs: { type: "INT64", optional: true },
    totalCostUsd: { type: "DOUBLE", optional: true },
    inputTokens: { type: "INT64", optional: true },
    outputTokens: { type: "INT64", optional: true },
    reasoningTokens: { type: "INT64", optional: true },
    nonReasoningOutputTokens: { type: "INT64", optional: true },
    benchmarkCostUsd: { type: "DOUBLE", optional: true },
    judgeCostUsd: { type: "DOUBLE", optional: true },
    promptLocale: { type: "UTF8", optional: true },
    sourceLocale: { type: "UTF8", optional: true },
    prompt: { type: "UTF8" },
    response: { type: "UTF8" },
    auxiliaryLabels: { type: "UTF8", optional: true },
    traceAvailability: { type: "UTF8", optional: true },
    reasoningTraceText: { type: "UTF8", optional: true },
    reasoningTokenCount: { type: "INT64", optional: true },
    evaluationAwarenessAnalysis: { type: "UTF8", optional: true },
  })

  const writer = await ParquetWriter.openFile(schema, path)
  try {
    for (const row of manifest.results) {
      const telemetry = buildRowTelemetryBreakdown(row)
      await writer.appendRow({
        scenarioId: row.scenarioId,
        canonicalScenarioId: row.canonicalScenarioId,
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
        benchmarkCallCount: telemetry.benchmarkCallCount,
        judgeCallCount: telemetry.judgeCallCount,
        totalDurationMs: telemetry.totalDurationMs,
        totalCostUsd: telemetry.totalCostUsd ?? undefined,
        inputTokens: telemetry.inputTokens,
        outputTokens: telemetry.outputTokens,
        reasoningTokens: telemetry.reasoningTokens,
        nonReasoningOutputTokens: telemetry.nonReasoningOutputTokens,
        benchmarkCostUsd: telemetry.benchmarkCostUsd ?? undefined,
        judgeCostUsd: telemetry.judgeCostUsd ?? undefined,
        promptLocale: row.promptLocale ?? manifest.metadata.promptLocale,
        sourceLocale: row.sourceLocale ?? manifest.metadata.sourceLocale,
        prompt: row.prompt,
        response: row.response,
        auxiliaryLabels: row.auxiliaryLabels ? JSON.stringify(row.auxiliaryLabels) : undefined,
        traceAvailability: row.traceAvailability,
        reasoningTraceText: row.reasoningTraceText,
        reasoningTokenCount: row.reasoningTokenCount,
        evaluationAwarenessAnalysis: row.evaluationAwarenessAnalysis
          ? JSON.stringify(row.evaluationAwarenessAnalysis)
          : undefined,
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
    canonicalScenarioId: { type: "UTF8", optional: true },
    scenarioTitle: { type: "UTF8" },
    module: { type: "UTF8" },
    category: { type: "UTF8" },
    modelId: { type: "UTF8" },
    provider: { type: "UTF8" },
    promptLocale: { type: "UTF8", optional: true },
    sourceLocale: { type: "UTF8", optional: true },
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
      ["promptLocale", manifest.metadata.promptLocale],
      ["sourceLocale", manifest.metadata.sourceLocale],
      ["localePackId", manifest.metadata.localePackId],
      ["localePreset", manifest.metadata.localePreset],
      ["scenarioCatalogVersion", manifest.metadata.scenarioCatalogVersion],
      ["judgeModel", manifest.metadata.judgeModel],
      ["judgeStrategy", manifest.metadata.judgeStrategy],
      ["conversationMode", manifest.metadata.conversationMode],
      ["transportPolicy", manifest.metadata.transportPolicy],
      ["replicates", manifest.metadata.replicates],
      ["averageDcs", manifest.summary.averageDcs],
      ["drfr", manifest.summary.drfr],
      ["wallClockMs", manifest.summary.telemetry?.wallClockMs],
      ["totalCostUsd", formatUsd(manifest.summary.telemetry?.overall.costUsd)],
      ["benchmarkCostUsd", formatUsd(manifest.summary.telemetry?.benchmark.costUsd)],
      ["judgingCostUsd", formatUsd(manifest.summary.telemetry?.judging.costUsd)],
      ["inputTokens", manifest.summary.telemetry?.overall.inputTokens],
      ["outputTokens", manifest.summary.telemetry?.overall.outputTokens],
      ["reasoningTokens", manifest.summary.telemetry?.overall.reasoningTokens],
      ["nonReasoningOutputTokens", manifest.summary.telemetry?.overall.nonReasoningOutputTokens],
      ["riskSlices", manifest.summary.riskSlices],
      ["auxiliaryLabelCoverage", manifest.summary.auxiliaryLabelCoverage],
      ["pricingSnapshot", manifest.metadata.pricingSnapshot],
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
