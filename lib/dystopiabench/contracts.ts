import { z } from "zod"
import { benchmarkBundleSchema } from "./bundles"
import {
  complianceRatingSchema,
  conversationModeSchema,
  judgeStrategySchema,
  providerPrecisionPolicySchema,
  runManifestV2Schema,
  type BenchmarkResultV2,
} from "./schemas"
export { benchmarkBundleSchema } from "./bundles"

export const benchmarkPolicyConfigV1Schema = z.object({
  scoringRubricVersion: z.string().default("dcs-4tier-v2"),
  promptPackVersion: z.string().default("dystopiabench-prompts-v2"),
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).default("chat-first-fallback"),
  conversationMode: conversationModeSchema.default("stateful"),
  judgeStrategy: judgeStrategySchema.default("single"),
  providerPrecisionPolicy: providerPrecisionPolicySchema.default("default"),
})

export const benchmarkDefinitionSchema = z.object({
  benchmarkId: z.string().default("dystopiabench-core"),
  bundleVersion: z.string().default("1.0.0"),
  datasetBundleVersion: z.string().optional(),
  scoringRubricVersion: z.string().default("dcs-4tier-v2"),
  promptPackVersion: z.string().default("dystopiabench-prompts-v2"),
  recommendedJudgeModel: z.string().optional(),
  recommendedJudgeStrategy: judgeStrategySchema.default("single"),
  releaseTier: z.enum(["core-public", "holdout", "partner-only", "organization-local"]).default("core-public"),
})

export const executionConfigSchema = z.object({
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).default("chat-first-fallback"),
  conversationMode: conversationModeSchema.default("stateful"),
  providerPrecisionPolicy: providerPrecisionPolicySchema.default("default"),
  timeoutMs: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  perModelConcurrency: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  retryBackoffBaseMs: z.number().int().positive().optional(),
  retryBackoffJitterMs: z.number().int().nonnegative().optional(),
  replicates: z.number().int().positive().default(3),
})

export const analysisConfigSchema = z.object({
  judgeModel: z.string().optional(),
  judgeModels: z.array(z.string()).optional(),
  judgeStrategy: judgeStrategySchema.default("single"),
})

export const experimentMetadataSchema = z.object({
  experimentId: z.string().regex(/^[A-Za-z0-9._-]{1,128}$/),
  project: z.string().optional(),
  owner: z.string().optional(),
  purpose: z.string().optional(),
  modelSnapshot: z.string().optional(),
  providerRegion: z.string().optional(),
  policyVersion: z.string().optional(),
  systemPromptOverrideUsed: z.boolean().optional(),
  customPrepromptUsed: z.boolean().optional(),
  gitCommit: z.string().optional(),
  datasetBundleVersion: z.string().optional(),
  promptLocale: z.string().optional(),
  sourceLocale: z.string().optional(),
  localePack: z.unknown().optional(),
  localePackId: z.string().optional(),
  localePreset: z.string().optional(),
})

export const benchmarkPolicyConfigSchema = benchmarkPolicyConfigV1Schema

export const runRequestV1Schema = z.object({
  runId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  benchmarkBundle: benchmarkBundleSchema.optional(),
  module: z.string().default("both"),
  modelIds: z.array(z.string()).min(1),
  levels: z.array(z.number().int().min(1).max(5)).min(1).default([1, 2, 3, 4, 5]),
  scenarioIds: z.array(z.string()).optional(),
  judgeModel: z.string().optional(),
  judgeModels: z.array(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  perModelConcurrency: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  retryBackoffBaseMs: z.number().int().positive().optional(),
  retryBackoffJitterMs: z.number().int().nonnegative().optional(),
  replicates: z.number().int().positive().default(3),
  experimentId: z.string().regex(/^[A-Za-z0-9._-]{1,128}$/).optional(),
  project: z.string().optional(),
  owner: z.string().optional(),
  purpose: z.string().optional(),
  modelSnapshot: z.string().optional(),
  providerRegion: z.string().optional(),
  policyVersion: z.string().optional(),
  systemPromptOverrideUsed: z.boolean().optional(),
  customPrepromptUsed: z.boolean().optional(),
  gitCommit: z.string().optional(),
  datasetBundleVersion: z.string().optional(),
  promptLocale: z.string().optional(),
  sourceLocale: z.string().optional(),
  localePack: z.unknown().optional(),
  localePackId: z.string().optional(),
  localePreset: z.string().optional(),
  policyConfig: benchmarkPolicyConfigV1Schema.optional(),
  scenarioSources: z
    .array(
      z.union([
        z.string(),
        z.object({
          source: z.string(),
          namespace: z.string().optional(),
          releaseTier: z.enum(["core-public", "holdout", "partner-only", "organization-local"]).optional(),
          author: z.string().optional(),
        }),
      ]),
    )
    .optional(),
})

export const scenarioCatalogV1Schema = z.object({
  benchmarkBundleId: z.string(),
  datasetBundleVersion: z.string(),
  scenarioCatalogVersion: z.string(),
  moduleCount: z.number().int().nonnegative(),
  scenarioCount: z.number().int().nonnegative(),
  promptCount: z.number().int().nonnegative(),
  modules: z.array(z.unknown()),
})

export const scenarioResultSummaryV1Schema = z.object({
  scenarioId: z.string(),
  canonicalScenarioId: z.string().optional(),
  scenarioTitle: z.string(),
  module: z.string(),
  category: z.string(),
  modelId: z.string(),
  provider: z.string(),
  promptLocale: z.string().optional(),
  sourceLocale: z.string().optional(),
  scoredPrompts: z.number().int().nonnegative(),
  averageDcs: z.number().min(0).max(100),
  variance: z.number().nonnegative(),
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  refusalRate: z.number().min(0).max(100),
  l1L2AverageDcs: z.number().min(0).max(100).nullable(),
  l3L5AverageDcs: z.number().min(0).max(100).nullable(),
  okRate: z.number().min(0).max(100),
})

export const judgeCalibrationExampleSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  prompt: z.string(),
  response: z.string(),
  goldLabel: complianceRatingSchema,
  slice: z.string().optional(),
  notes: z.string().optional(),
})

export const judgeCalibrationSetSchema = z.object({
  id: z.string(),
  version: z.string(),
  createdAt: z.string(),
  examples: z.array(judgeCalibrationExampleSchema).min(1),
})

export const gateAssertionSchema = z.object({
  maxOverallDcs: z.number().min(0).max(100).optional(),
  maxModuleDcs: z.record(z.string(), z.number().min(0).max(100)).optional(),
  maxScoreIncreaseVsBaseline: z.number().min(0).max(100).optional(),
  minRefusalRateL4L5: z.number().min(0).max(100).optional(),
  maxErrorRate: z.number().min(0).max(100).optional(),
})

export const gateConfigSchema = z.object({
  name: z.string().default("default"),
  baselineRunId: z.string().optional(),
  assertions: gateAssertionSchema,
})

export const runExportManifestSchema = z.object({
  run: runManifestV2Schema,
  scenarioSummaries: z.array(scenarioResultSummaryV1Schema),
})

export const aggregateExportV1Schema = runExportManifestSchema

export type BenchmarkPolicyConfigV1 = z.infer<typeof benchmarkPolicyConfigV1Schema>
export type RunRequestV1 = z.infer<typeof runRequestV1Schema>
export type ScenarioCatalogV1 = z.infer<typeof scenarioCatalogV1Schema>
export type ScenarioResultSummaryV1 = z.infer<typeof scenarioResultSummaryV1Schema>
export type JudgeCalibrationSet = z.infer<typeof judgeCalibrationSetSchema>
export type GateConfig = z.infer<typeof gateConfigSchema>
export type RunExportManifest = z.infer<typeof runExportManifestSchema>
export type BenchmarkBundleV1 = z.infer<typeof benchmarkBundleSchema>

export function validateRunRequest(value: unknown): RunRequestV1 {
  return runRequestV1Schema.parse(value)
}

export function validateScenarioCatalog(value: unknown): ScenarioCatalogV1 {
  return scenarioCatalogV1Schema.parse(value)
}

export function validateGateConfig(value: unknown): GateConfig {
  return gateConfigSchema.parse(value)
}

export function validateJudgeCalibrationSet(value: unknown): JudgeCalibrationSet {
  return judgeCalibrationSetSchema.parse(value)
}

export function createEmptyConfusionMatrix(): Record<string, Record<string, number>> {
  return {
    refusal: { refusal: 0, hesitant: 0, compliant: 0, proactive: 0 },
    hesitant: { refusal: 0, hesitant: 0, compliant: 0, proactive: 0 },
    compliant: { refusal: 0, hesitant: 0, compliant: 0, proactive: 0 },
    proactive: { refusal: 0, hesitant: 0, compliant: 0, proactive: 0 },
  }
}

export function computeAgreementPercentage(correct: number, total: number): number {
  if (total === 0) return 100
  return Number(((correct / total) * 100).toFixed(2))
}

export function summarizeScenarioResults(results: BenchmarkResultV2[]): ScenarioResultSummaryV1[] {
  const grouped = new Map<string, BenchmarkResultV2[]>()
  for (const row of results) {
    const key = `${row.scenarioId}::${row.promptLocale ?? "en"}::${row.modelId}`
    const existing = grouped.get(key)
    if (existing) {
      existing.push(row)
    } else {
      grouped.set(key, [row])
    }
  }

  return [...grouped.values()].map((rows) => {
    const scoredRows = rows.filter((row): row is BenchmarkResultV2 & { score: number } => row.score !== null)
    const scores = scoredRows.map((row) => row.score)
    const average = scores.length === 0 ? 0 : scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance =
      scores.length <= 1
        ? 0
        : scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length
    const refusals = scoredRows.filter((row) => row.compliance === "refusal").length
    const l1L2 = scoredRows.filter((row) => row.level <= 2).map((row) => row.score)
    const l3L5 = scoredRows.filter((row) => row.level >= 3).map((row) => row.score)
    const okRows = rows.filter((row) => row.status === "ok").length

    return {
      scenarioId: rows[0].scenarioId,
      canonicalScenarioId: rows[0].canonicalScenarioId,
      scenarioTitle: rows[0].scenarioTitle,
      module: rows[0].module,
      category: rows[0].scenarioCategory,
      modelId: rows[0].modelId,
      provider: rows[0].provider,
      promptLocale: rows[0].promptLocale,
      sourceLocale: rows[0].sourceLocale,
      scoredPrompts: scoredRows.length,
      averageDcs: Number(average.toFixed(2)),
      variance: Number(variance.toFixed(4)),
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      refusalRate: scoredRows.length === 0 ? 0 : Number(((refusals / scoredRows.length) * 100).toFixed(2)),
      l1L2AverageDcs:
        l1L2.length === 0 ? null : Number((l1L2.reduce((sum, score) => sum + score, 0) / l1L2.length).toFixed(2)),
      l3L5AverageDcs:
        l3L5.length === 0 ? null : Number((l3L5.reduce((sum, score) => sum + score, 0) / l3L5.length).toFixed(2)),
      okRate: rows.length === 0 ? 100 : Number(((okRows / rows.length) * 100).toFixed(2)),
    }
  })
}
