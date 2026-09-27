import { z } from "zod"

export const complianceRatingSchema = z.enum([
  "refusal",
  "hesitant",
  "compliant",
  "proactive",
])

export const benchmarkStatusSchema = z.enum([
  "ok",
  "model_error",
  "judge_error",
  "aborted",
  "invalid_response",
  "skipped",
])

export const conversationModeSchema = z.enum(["stateful", "stateless"])
export const schedulerModeSchema = z.enum(["level-wave", "conversation"])
export const judgeStrategySchema = z.enum(["single", "pair-with-tiebreak"])
export const providerPrecisionPolicySchema = z.enum(["default", "non-quantized-only"])
export const conversationContinuitySchema = z.enum(["intact", "reset_after_failure"])
export const rerunScopeSchema = z.enum(["from-first-failed", "to-max-failed", "all-levels", "failed-only"])
export const derivationKindSchema = z.enum(["rerun_failures", "awareness_analysis"])
export const auxiliaryOutcomeLabelSchema = z.enum(["none", "weak", "moderate", "strong", "high"])
export const complianceSeveritySchema = z.enum(["none", "low", "medium", "high", "critical"])
export const traceAvailabilitySchema = z.enum(["none", "token-only", "summary", "full"])
export const traceCaptureSourceSchema = z.enum([
  "ai-sdk-reasoning",
  "usage-only",
  "provider-metadata",
  "unavailable",
])
export const scoreabilityReasonSchema = z.enum([
  "EMPTY_GENERATED_COMPLETION",
  "EMPTY_SILENT_REFUSAL",
  "EMPTY_UNVERIFIED_RESPONSE",
  "INCOMPLETE_RESPONSE",
  "PROVIDER_CONTENT_FILTER",
])
export const adjudicationSourceSchema = z.enum([
  "single-judge",
  "judge-panel",
])
export const artifactVisibilitySchema = z.enum(["public", "private"])
export const endpointUsedSchema = z.enum(["ai_sdk_chat", "openrouter_chat_primary", "openrouter_chat_fallback", "openrouter_batch", "local_chat", "litellm_chat"])
export const modelSystemPromptModeSchema = z.enum(["standard", "none"])

export const GENERATION_CONFIG = {
  model: {
    temperature: 1,
  },
  judge: {
    temperature: 0,
  },
  retryPolicy: {
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffJitterMs: 1000,
  },
  timeoutMs: 900_000,
} as const

const generationModelConfigSchema = z.object({
  temperature: z.number(),
  topP: z.number().min(0).max(1).optional(),
})

const generationJudgeConfigSchema = z.object({
  temperature: z.number(),
  topP: z.number().min(0).max(1).optional(),
})

export const judgeVoteSchema = z.object({
  judge: z.string(),
  role: z.enum(["primary", "secondary", "arbiter", "arena"]).optional(),
  compliance: complianceRatingSchema,
  reasoning: z.string(),
  rawOutput: z.string().optional(),
  reasoningTraceText: z.string().optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
  selected: z.boolean().optional(),
  sidedWith: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  adjudicationSource: adjudicationSourceSchema.optional(),
})

export const judgePanelConfigSnapshotSchema = z.object({
  judgeStrategy: judgeStrategySchema,
  judgeModels: z.array(z.string()).min(1),
  judgeTieBreakerModel: z.string().optional(),
  judgePromptVersion: z.string().optional(),
})

export const judgePanelAgreementSchema = z.object({
  exactAgreementRate: z.number().min(0).max(100),
  averagePairwiseAgreementRate: z.number().min(0).max(100).optional(),
  unanimous: z.boolean().optional(),
})

export const judgeAdjudicationRecordSchema = z.object({
  finalCompliance: complianceRatingSchema,
  finalScore: z.number().int().min(0).max(100),
  source: adjudicationSourceSchema,
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  selectedJudge: z.string().optional(),
})

export const judgePanelRecordSchema = z.object({
  config: judgePanelConfigSnapshotSchema,
  outputs: z.array(judgeVoteSchema).min(1),
  adjudication: judgeAdjudicationRecordSchema.optional(),
  agreement: judgePanelAgreementSchema.optional(),
})

export const auxiliaryOutcomeLabelsSchema = z.object({
  harmAwareness: auxiliaryOutcomeLabelSchema.optional(),
  boundaryClarity: auxiliaryOutcomeLabelSchema.optional(),
  alternativeSafeHelpfulness: auxiliaryOutcomeLabelSchema.optional(),
  manipulationResistance: auxiliaryOutcomeLabelSchema.optional(),
  proceduralDeferral: auxiliaryOutcomeLabelSchema.optional(),
})

export const judgeAgreementSummarySchema = z.object({
  judgeCount: z.number().int().positive(),
  exactAgreementRate: z.number().min(0).max(100),
  averagePairwiseAgreementRate: z.number().min(0).max(100).optional(),
}).optional()

export const riskSlicesSummarySchema = z.object({
  l1L2AverageDcs: z.number().min(0).max(100).nullable(),
  l3L5AverageDcs: z.number().min(0).max(100).nullable(),
  reliabilityAdjustedAverageDcs: z.number().min(0).max(100).nullable(),
  moduleAverageDcs: z.record(z.string(), z.number().min(0).max(100)),
})

export const auxiliaryLabelCoverageSchema = z.object({
  rowCoverageRate: z.number().min(0).max(100),
  harmAwarenessRate: z.number().min(0).max(100),
  boundaryClarityRate: z.number().min(0).max(100),
  alternativeSafeHelpfulnessRate: z.number().min(0).max(100),
  manipulationResistanceRate: z.number().min(0).max(100),
  proceduralDeferralRate: z.number().min(0).max(100),
})

export const repeatStatsSummarySchema = z.object({
  targetReplicates: z.number().int().positive(),
  totalTuples: z.number().int().nonnegative(),
  scoredTuples: z.number().int().nonnegative(),
  averageObservedReplicates: z.number().nonnegative(),
  fullyObservedTupleCount: z.number().int().nonnegative(),
  partiallyObservedTupleCount: z.number().int().nonnegative(),
  meanWithinTupleStdDev: z.number().nonnegative(),
  maxWithinTupleStdDev: z.number().nonnegative(),
})

const tokenCountSchema = z.number().int().nonnegative()

export const tokenUsageSummarySchema = z.object({
  inputTokens: tokenCountSchema.default(0),
  cachedInputTokens: tokenCountSchema.default(0),
  uncachedInputTokens: tokenCountSchema.default(0),
  outputTokens: tokenCountSchema.default(0),
  textOutputTokens: tokenCountSchema.default(0),
  reasoningTokens: tokenCountSchema.default(0),
  totalTokens: tokenCountSchema.default(0),
})

export const costBreakdownSchema = z.object({
  inputUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
  totalUsd: z.number().nonnegative(),
})

export const runCostBreakdownSchema = z.object({
  modelUsd: z.number().nonnegative(),
  judgeUsd: z.number().nonnegative(),
  totalUsd: z.number().nonnegative(),
})

export const rowTimingSchema = z.object({
  modelLatencyMs: z.number().int().nonnegative(),
  judgeLatencyMs: z.number().int().nonnegative(),
  totalLatencyMs: z.number().int().nonnegative(),
})

export const telemetrySummarySchema = z.object({
  modelUsage: tokenUsageSummarySchema,
  judgeUsage: tokenUsageSummarySchema,
  totalUsage: tokenUsageSummarySchema,
  estimatedCostUsd: runCostBreakdownSchema,
  averageModelLatencyMs: z.number().nonnegative(),
  averageJudgeLatencyMs: z.number().nonnegative(),
  averageRowLatencyMs: z.number().nonnegative(),
  runWallTimeMs: z.number().int().nonnegative(),
  tokenCoverageRate: z.number().min(0).max(100),
  reasoningTokenCoverageRate: z.number().min(0).max(100),
})

export const runIntegrityModelSummarySchema = z.object({
  modelId: z.string(),
  totalRows: z.number().int().nonnegative(),
  nonEmptyResponseRows: z.number().int().nonnegative(),
  providerContentFilterRows: z.number().int().nonnegative(),
  emptyResponseRows: z.number().int().nonnegative(),
  implicitEmptyRefusalRows: z.number().int().nonnegative(),
  unverifiedEmptyRows: z.number().int().nonnegative(),
  judgedRows: z.number().int().nonnegative(),
  nonEmptyResponseRate: z.number().min(0).max(100),
  evidenceResponseRate: z.number().min(0).max(100),
  implicitEmptyRefusalRate: z.number().min(0).max(100),
})

export const runIntegritySummarySchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  failures: z.array(z.string()),
  warnings: z.array(z.string()),
  modelSummaries: z.array(runIntegrityModelSummarySchema),
})

export const benchmarkResultV2Schema = z.object({
  scenarioId: z.string(),
  canonicalScenarioId: z.string().optional(),
  scenarioTitle: z.string(),
  scenarioCategory: z.string(),
  module: z.string(),
  modelId: z.string(),
  modelLabel: z.string(),
  provider: z.string(),
  modelString: z.string(),
  level: z.number().int().min(1).max(5),
  prompt: z.string(),
  response: z.string(),
  compliance: complianceRatingSchema.optional(),
  primaryComplianceLabel: complianceRatingSchema.optional(),
  score: z.number().int().min(0).max(100).nullable(),
  status: benchmarkStatusSchema,
  judgeReasoning: z.string().optional(),
  judgeVotes: z.array(judgeVoteSchema).optional(),
  judgePanel: judgePanelRecordSchema.optional(),
  severity: complianceSeveritySchema.optional(),
  operationalityFlag: z.boolean().optional(),
  targetHarmMechanisms: z.array(z.string().trim().min(1)).optional(),
  safeAlternativeHelpfulnessFlag: z.boolean().optional(),
  manipulationOrEvasionFlag: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  adjudicationSource: adjudicationSourceSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
  endpointUsed: endpointUsedSchema.optional(),
  transportAttempts: z.number().int().nonnegative().optional(),
  scorable: z.boolean().optional(),
  conversationContinuity: conversationContinuitySchema.optional(),
  implicitRefusalFromEmpty: z.boolean().optional(),
  replicate: z.number().int().positive().optional(),
  experimentId: z.string().optional(),
  auxiliaryLabels: auxiliaryOutcomeLabelsSchema.optional(),
  sampleId: z.string().optional(),
  attemptId: z.string().optional(),
  promptHash: z.string().length(64).optional(),
  responseHash: z.string().length(64).optional(),
  traceAvailability: traceAvailabilitySchema.optional(),
  traceCaptureSource: traceCaptureSourceSchema.optional(),
  scoreabilityReason: scoreabilityReasonSchema.optional(),
  reasoningTraceText: z.string().optional(),
  reasoningTokenCount: z.number().int().nonnegative().optional(),
  promptTokenCount: z.number().int().nonnegative().optional(),
  responseTokenCount: z.number().int().nonnegative().optional(),
  totalTokenCount: z.number().int().nonnegative().optional(),
  modelUsage: tokenUsageSummarySchema.optional(),
  judgeUsage: tokenUsageSummarySchema.optional(),
  totalUsage: tokenUsageSummarySchema.optional(),
  modelEstimatedCostUsd: costBreakdownSchema.optional(),
  judgeEstimatedCostUsd: costBreakdownSchema.optional(),
  estimatedCostUsd: runCostBreakdownSchema.optional(),
  timing: rowTimingSchema.optional(),
  finishReason: z.string().nullish().transform((value) => value ?? undefined),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
  judgePanelConfigSnapshot: judgePanelConfigSnapshotSchema.optional(),
  artifactLineage: z.object({
    sourceRunId: z.string().optional(),
    sourceSampleId: z.string().optional(),
    derivationKind: derivationKindSchema.optional(),
    parentAttemptId: z.string().optional(),
  }).optional(),
  timestamp: z.number().int(),
})

export const runSummaryV2Schema = z.object({
  totalPrompts: z.number().int().nonnegative(),
  scoredPrompts: z.number().int().nonnegative(),
  averageDcs: z.number().int().min(0).max(100),
  drfr: z.number().int().min(0).max(100),
  statusCounts: z.record(benchmarkStatusSchema, z.number().int().nonnegative()),
  modelSuccessRate: z.number().min(0).max(100).optional(),
  judgeSuccessRate: z.number().min(0).max(100).optional(),
  scorableRate: z.number().min(0).max(100).optional(),
  scoreStdDev: z.number().nonnegative().optional(),
  minScore: z.number().min(0).max(100).optional(),
  maxScore: z.number().min(0).max(100).optional(),
  riskSlices: riskSlicesSummarySchema.optional(),
  auxiliaryLabelCoverage: auxiliaryLabelCoverageSchema.optional(),
  repeatStats: repeatStatsSummarySchema.optional(),
  telemetry: telemetrySummarySchema.optional(),
  integrity: runIntegritySummarySchema.optional(),
  judgeAgreement: judgeAgreementSummarySchema,
})

export const benchmarkDefinitionSchema = z.object({
  benchmarkId: z.string(),
  benchmarkBundleId: z.string().optional(),
  benchmarkBundleVersion: z.string().optional(),
  datasetBundleVersion: z.string().optional(),
  scenarioCatalogVersion: z.string().optional(),
  scenarioModuleIds: z.array(z.string()).optional(),
  selectedScenarioIds: z.array(z.string()).optional(),
  selectedScenarioCount: z.number().int().nonnegative().optional(),
  scoringRubricVersion: z.string().optional(),
  promptPackVersion: z.string().optional(),
  systemPromptVersion: z.string(),
  benchmarkPromptVersion: z.string().default("v1"),
  judgePromptVersion: z.string().default("v1"),
})

export const executionConfigSchema = z.object({
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).optional(),
  chatFirstModelIds: z.array(z.string()).optional(),
  fallbackOnTimeout: z.boolean().optional(),
  conversationMode: conversationModeSchema.optional(),
  scheduler: schedulerModeSchema.optional(),
  modelSystemPromptMode: modelSystemPromptModeSchema.optional(),
  providerPrecisionPolicy: providerPrecisionPolicySchema.optional(),
  timeoutMs: z.number().int().positive(),
  concurrency: z.number().int().positive().optional(),
  perModelConcurrency: z.number().int().positive().optional(),
  requestStartDelayMs: z.number().int().nonnegative().optional(),
  replicates: z.number().int().positive().default(3),
  retryPolicy: z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffBaseMs: z.number().int().positive(),
    backoffJitterMs: z.number().int().nonnegative(),
  }),
  generationConfig: z.object({
    model: generationModelConfigSchema,
    judge: generationJudgeConfigSchema,
  }),
})

export const analysisConfigSchema = z.object({
  judgeModel: z.string(),
  judgeModels: z.array(z.string()).optional(),
  judgeStrategy: judgeStrategySchema.optional(),
  judgeTieBreakerModel: z.string().optional(),
})

export const artifactPolicySchema = z.object({
  visibility: artifactVisibilitySchema,
  publishTargets: z.array(z.enum(["public-dashboard", "private-artifacts", "exports"])).default([]),
})

export const runMetadataV2Schema = z.object({
  module: z.string(),
  models: z.array(z.string()).default([]),
  levels: z.array(z.number().int().min(1).max(5)).default([]),
  totalPrompts: z.number().int().nonnegative(),
  benchmarkDefinition: benchmarkDefinitionSchema.optional(),
  executionConfig: executionConfigSchema.optional(),
  analysisConfig: analysisConfigSchema.optional(),
  scenarioCatalogVersion: z.string().optional(),
  scenarioModuleIds: z.array(z.string()).optional(),
  selectedScenarioIds: z.array(z.string()).optional(),
  selectedScenarioCount: z.number().int().nonnegative().optional(),
  judgeModel: z.string(),
  judgeModels: z.array(z.string()).optional(),
  judgeStrategy: judgeStrategySchema.optional(),
  judgeTieBreakerModel: z.string().optional(),
  systemPromptVersion: z.string(),
  benchmarkPromptVersion: z.string().default("v1"),
  judgePromptVersion: z.string().default("v1"),
  artifactPolicy: artifactPolicySchema.optional(),
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).optional(),
  chatFirstModelIds: z.array(z.string()).optional(),
  fallbackOnTimeout: z.boolean().optional(),
  conversationMode: conversationModeSchema.optional(),
  scheduler: schedulerModeSchema.optional(),
  modelSystemPromptMode: modelSystemPromptModeSchema.optional(),
  providerPrecisionPolicy: providerPrecisionPolicySchema.optional(),
  derivedFromRunId: z.string().optional(),
  derivationKind: derivationKindSchema.optional(),
  rerunScope: rerunScopeSchema.optional(),
  rerunPairCount: z.number().int().nonnegative().optional(),
  replacedTupleCount: z.number().int().nonnegative().optional(),
  experimentId: z.string().optional(),
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
  replicates: z.number().int().positive().optional(),
  modelCapabilitiesSnapshot: z.record(z.string(), z.unknown()).optional(),
  generationConfig: z
    .object({
      model: generationModelConfigSchema,
      judge: generationJudgeConfigSchema,
      retryPolicy: z.object({
        maxRetries: z.number().int().nonnegative(),
        backoffBaseMs: z.number().int().positive(),
        backoffJitterMs: z.number().int().nonnegative(),
      }),
      timeoutMs: z.number().int().positive(),
      concurrency: z.number().int().positive().optional(),
      perModelConcurrency: z.number().int().positive().optional(),
      requestStartDelayMs: z.number().int().nonnegative().optional(),
      scheduler: schedulerModeSchema.optional(),
      chatFirstModelIds: z.array(z.string()).optional(),
      fallbackOnTimeout: z.boolean().optional(),
    })
    .default(GENERATION_CONFIG),
})

export const runManifestV2Schema = z.object({
  runId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  timestamp: z.number().int(),
  date: z.string(),
  metadata: runMetadataV2Schema,
  summary: runSummaryV2Schema,
  results: z.array(benchmarkResultV2Schema),
})

export const runIndexItemV2Schema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  timestamp: z.number().int(),
  date: z.string(),
  metadata: runMetadataV2Schema,
  summary: runSummaryV2Schema,
})

export const runIndexV2Schema = z.array(runIndexItemV2Schema)

export const dashboardChartResultSchema = z.object({
  scenarioId: z.string(),
  canonicalScenarioId: z.string().optional(),
  scenarioTitle: z.string(),
  scenarioCategory: z.string(),
  module: z.string(),
  modelId: z.string(),
  modelLabel: z.string(),
  provider: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  compliance: complianceRatingSchema,
  score: z.number().int().min(0).max(100),
  replicateCount: z.number().int().positive().optional(),
  scoreStdDev: z.number().nonnegative().optional(),
  refusalRate: z.number().min(0).max(100).optional(),
})

export const dashboardChartPayloadSchema = z.object({
  runId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  timestamp: z.number().int(),
  date: z.string(),
  conversationMode: conversationModeSchema,
  metadata: runMetadataV2Schema,
  summary: runSummaryV2Schema,
  results: z.array(dashboardChartResultSchema),
})

export type ComplianceRating = z.infer<typeof complianceRatingSchema>
export type BenchmarkStatus = z.infer<typeof benchmarkStatusSchema>
export type ConversationMode = z.infer<typeof conversationModeSchema>
export type SchedulerMode = z.infer<typeof schedulerModeSchema>
export type JudgeStrategy = z.infer<typeof judgeStrategySchema>
export type ProviderPrecisionPolicy = z.infer<typeof providerPrecisionPolicySchema>
export type ConversationContinuity = z.infer<typeof conversationContinuitySchema>
export type RerunScope = z.infer<typeof rerunScopeSchema>
export type DerivationKind = z.infer<typeof derivationKindSchema>
export type JudgeVoteV2 = z.infer<typeof judgeVoteSchema>
export type JudgePanelRecord = z.infer<typeof judgePanelRecordSchema>
export type AuxiliaryOutcomeLabels = z.infer<typeof auxiliaryOutcomeLabelsSchema>
export type TokenUsageSummary = z.infer<typeof tokenUsageSummarySchema>
export type CostBreakdown = z.infer<typeof costBreakdownSchema>
export type RunCostBreakdown = z.infer<typeof runCostBreakdownSchema>
export type RowTiming = z.infer<typeof rowTimingSchema>
export type TelemetrySummary = z.infer<typeof telemetrySummarySchema>
export type BenchmarkResultV2 = z.infer<typeof benchmarkResultV2Schema>
export type RunSummaryV2 = z.infer<typeof runSummaryV2Schema>
export type RunMetadataV2 = z.infer<typeof runMetadataV2Schema>
export type RunManifestV2 = z.infer<typeof runManifestV2Schema>
export type RunIndexItemV2 = z.infer<typeof runIndexItemV2Schema>
export type DashboardChartResult = z.infer<typeof dashboardChartResultSchema>
export type DashboardChartPayload = z.infer<typeof dashboardChartPayloadSchema>
