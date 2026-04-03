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
])

export const conversationModeSchema = z.enum(["stateful", "stateless"])
export const judgeStrategySchema = z.enum(["single", "pair-with-tiebreak"])
export const providerPrecisionPolicySchema = z.enum(["default", "non-quantized-only"])
export const conversationContinuitySchema = z.enum(["intact", "reset_after_failure"])
export const rerunScopeSchema = z.enum(["to-max-failed", "all-levels", "failed-only"])
export const derivationKindSchema = z.enum(["rerun_failures", "awareness_analysis"])
export const auxiliaryOutcomeLabelSchema = z.enum(["none", "weak", "moderate", "strong", "high"])
export const complianceSeveritySchema = z.enum(["none", "low", "medium", "high", "critical"])
export const evalAwarenessModeSchema = z.enum(["off", "auto", "required"])
export const traceAvailabilitySchema = z.enum(["none", "token-only", "summary", "full"])
export const traceCaptureSourceSchema = z.enum([
  "ai-sdk-reasoning",
  "usage-only",
  "provider-metadata",
  "unavailable",
])
export const awarenessAnalysisModeSchema = z.enum(["reasoning+response", "response-only"])
export const responseTraceConsistencySchema = z.enum(["aligned", "mixed", "conflicted", "unknown"])
export const adjudicationSourceSchema = z.enum([
  "single-judge",
  "judge-panel",
  "human-review",
  "gold-set",
  "imported-review",
])
export const artifactVisibilitySchema = z.enum(["public", "private"])
export const endpointUsedSchema = z.enum(["ai_sdk_chat", "openrouter_chat_fallback", "local_chat"])
export const pricingSourceSchema = z.enum(["curated", "catalog"])
export const localeTagSchema = z.string().trim().min(2)

export const GENERATION_CONFIG = {
  model: {
    temperature: 0,
    topP: 1,
    maxOutputTokens: 1500,
  },
  judge: {
    temperature: 0,
    topP: 1,
    maxOutputTokens: 220,
  },
  retryPolicy: {
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffJitterMs: 1000,
  },
  timeoutMs: 90_000,
} as const

export const judgeVoteSchema = z.object({
  judge: z.string(),
  role: z.enum(["primary", "secondary", "arbiter", "arena"]).optional(),
  compliance: complianceRatingSchema,
  reasoning: z.string(),
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
  calibrationSetId: z.string().optional(),
  calibrationSetVersion: z.string().optional(),
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

export const evaluationAwarenessEvidenceFlagsSchema = z.object({
  traceMentionsEvaluation: z.boolean().optional(),
  traceMentionsPolicyOptics: z.boolean().optional(),
  responseMentionsEvaluation: z.boolean().optional(),
  behaviorShiftFlag: z.boolean().optional(),
  hiddenDeliberationMismatch: z.boolean().optional(),
})

export const evaluationAwarenessAnalysisSchema = z.object({
  analysisMode: awarenessAnalysisModeSchema,
  evaluationAwareness: auxiliaryOutcomeLabelSchema,
  deceptionSuspicion: auxiliaryOutcomeLabelSchema,
  responseTraceConsistency: responseTraceConsistencySchema,
  evidenceFlags: evaluationAwarenessEvidenceFlagsSchema.default({}),
  analysisReasoning: z.string(),
  analysisConfidence: z.number().min(0).max(1).optional(),
  analysisModel: z.string().optional(),
  heuristicsOnly: z.boolean().optional(),
})

export const rubricSliceCoverageSchema = z.object({
  slice: z.string(),
  exampleCount: z.number().int().nonnegative(),
  coverageRate: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100).optional(),
})

export const judgeCalibrationSummarySchema = z.object({
  calibrationSetId: z.string(),
  calibrationSetVersion: z.string(),
  judgeModel: z.string(),
  accuracy: z.number().min(0).max(100),
  weightedAgreement: z.number().min(0).max(1),
  exampleCount: z.number().int().nonnegative(),
  promptVersion: z.string(),
  confusionMatrix: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  sliceCoverage: z.array(rubricSliceCoverageSchema).default([]),
}).optional()

export const goldSetValidationSummarySchema = z.object({
  rubricVersion: z.string(),
  changedFromRubricVersion: z.string().optional(),
  minimumExamplesPerSlice: z.number().int().positive(),
  totalExampleCount: z.number().int().nonnegative(),
  sliceCoverage: z.array(rubricSliceCoverageSchema).default([]),
}).optional()

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

export const evaluationAwarenessSummarySchema = z.object({
  traceCoverageRate: z.number().min(0).max(100),
  traceTextCoverageRate: z.number().min(0).max(100),
  reasoningTokenCoverageRate: z.number().min(0).max(100),
  evaluationAwarenessRate: z.number().min(0).max(100),
  deceptionSuspicionRate: z.number().min(0).max(100),
  responseTraceConflictRate: z.number().min(0).max(100),
  awarenessByModel: z.record(z.string(), z.number().min(0).max(100)),
  awarenessByLevel: z.record(z.string(), z.number().min(0).max(100)),
  deceptionByLevel: z.record(z.string(), z.number().min(0).max(100)),
})

export const tokenUsageTelemetrySchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  nonCachedInputTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
  billableInputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  nonReasoningOutputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
})

export const pricingSnapshotEntrySchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  source: pricingSourceSchema,
})

export const invocationMetricsSchema = z.object({
  phase: z.enum(["benchmark", "judge", "arbiter"]),
  actorModelId: z.string(),
  actorModelString: z.string(),
  actorProvider: z.string(),
  endpointUsed: endpointUsedSchema.optional(),
  status: z.enum(["ok", "error"]),
  transportAttempts: z.number().int().nonnegative(),
  startedAt: z.number().int(),
  completedAt: z.number().int(),
  durationMs: z.number().int().nonnegative(),
  usage: tokenUsageTelemetrySchema.optional(),
  pricing: pricingSnapshotEntrySchema.optional(),
  costUsd: z.number().nonnegative().nullable().optional(),
  errorName: z.string().optional(),
  errorMessage: z.string().optional(),
  rawUsage: z.unknown().optional(),
})

export const telemetryAggregateSchema = z.object({
  callCount: z.number().int().nonnegative(),
  callsWithUsage: z.number().int().nonnegative(),
  callsWithPricing: z.number().int().nonnegative(),
  callsWithReasoningTokens: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  nonCachedInputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  billableInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative(),
  nonReasoningOutputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
})

export const resultTelemetrySchema = z.object({
  benchmarkCalls: z.array(invocationMetricsSchema).default([]),
  judgeCalls: z.array(invocationMetricsSchema).default([]),
  totals: telemetryAggregateSchema,
})

export const runTelemetrySummarySchema = z.object({
  startedAt: z.number().int(),
  completedAt: z.number().int(),
  wallClockMs: z.number().int().nonnegative(),
  benchmark: telemetryAggregateSchema,
  judging: telemetryAggregateSchema,
  overall: telemetryAggregateSchema,
  byActorModelId: z.record(z.string(), telemetryAggregateSchema),
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
  compliance: complianceRatingSchema,
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
  scenarioSplit: z.enum([
    "public-core",
    "public-canary",
    "private-holdout",
    "partner-only",
    "organization-local",
  ]).optional(),
  scenarioSensitivityTier: z.enum(["public", "internal", "restricted", "critical"]).optional(),
  canaryTokens: z.array(
    z.object({
      tokenId: z.string(),
      marker: z.string(),
      placement: z.enum(["prompt", "context", "metadata"]),
      notes: z.string().optional(),
    }),
  ).optional(),
  sampleId: z.string().optional(),
  attemptId: z.string().optional(),
  promptHash: z.string().length(64).optional(),
  responseHash: z.string().length(64).optional(),
  promptLocale: localeTagSchema.optional(),
  sourceLocale: localeTagSchema.optional(),
  traceAvailability: traceAvailabilitySchema.optional(),
  traceCaptureSource: traceCaptureSourceSchema.optional(),
  reasoningTraceText: z.string().optional(),
  reasoningTokenCount: z.number().int().nonnegative().optional(),
  responseTokenCount: z.number().int().nonnegative().optional(),
  finishReason: z.string().optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
  evaluationAwarenessAnalysis: evaluationAwarenessAnalysisSchema.optional(),
  judgePanelConfigSnapshot: judgePanelConfigSnapshotSchema.optional(),
  artifactLineage: z.object({
    sourceRunId: z.string().optional(),
    sourceSampleId: z.string().optional(),
    derivationKind: derivationKindSchema.optional(),
    parentAttemptId: z.string().optional(),
  }).optional(),
  telemetry: resultTelemetrySchema.optional(),
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
  evaluationAwareness: evaluationAwarenessSummarySchema.optional(),
  judgeAgreement: judgeAgreementSummarySchema,
  judgeCalibration: judgeCalibrationSummarySchema,
  goldSetValidation: goldSetValidationSummarySchema,
  telemetry: runTelemetrySummarySchema.optional(),
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
  releaseTier: z.enum(["core-public", "holdout", "partner-only", "organization-local"]).optional(),
  splitSummary: z.record(z.string(), z.number().int().nonnegative()).optional(),
  publicSafe: z.boolean().optional(),
})

export const executionConfigSchema = z.object({
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).optional(),
  conversationMode: conversationModeSchema.optional(),
  providerPrecisionPolicy: providerPrecisionPolicySchema.optional(),
  timeoutMs: z.number().int().positive(),
  concurrency: z.number().int().positive().optional(),
  perModelConcurrency: z.number().int().positive().optional(),
  replicates: z.number().int().positive().default(1),
  retryPolicy: z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffBaseMs: z.number().int().positive(),
    backoffJitterMs: z.number().int().nonnegative(),
  }),
  generationConfig: z.object({
    model: z.object({
      temperature: z.number(),
      topP: z.number().min(0).max(1).optional(),
      maxOutputTokens: z.number().int().positive(),
    }),
    judge: z.object({
      temperature: z.number(),
      topP: z.number().min(0).max(1).optional(),
      maxOutputTokens: z.number().int().positive(),
    }),
  }),
})

export const analysisConfigSchema = z.object({
  judgeModel: z.string(),
  judgeModels: z.array(z.string()).optional(),
  judgeStrategy: judgeStrategySchema.optional(),
  judgeTieBreakerModel: z.string().optional(),
  evalAwarenessMode: evalAwarenessModeSchema.optional(),
  awarenessJudgeModel: z.string().optional(),
  awarenessThreshold: auxiliaryOutcomeLabelSchema.optional(),
  goldSetValidation: goldSetValidationSummarySchema,
})

export const artifactPolicySchema = z.object({
  visibility: artifactVisibilitySchema,
  publicSafe: z.boolean(),
  publishTargets: z.array(z.enum(["public-dashboard", "private-artifacts", "exports"])).default([]),
  publicPublishBlockedReason: z.string().optional(),
})

export const runMetadataV2Schema = z.object({
  module: z.string(),
  models: z.array(z.string()).default([]),
  levels: z.array(z.number().int().min(1).max(5)).default([]),
  totalPrompts: z.number().int().nonnegative(),
  promptLocale: localeTagSchema.optional(),
  sourceLocale: localeTagSchema.optional(),
  localePackId: z.string().optional(),
  localePreset: z.string().optional(),
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
  conversationMode: conversationModeSchema.optional(),
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
  pricingSnapshot: z.record(z.string(), pricingSnapshotEntrySchema).optional(),
  modelCapabilitiesSnapshot: z.record(z.string(), z.unknown()).optional(),
  splitSummary: z.record(z.string(), z.number().int().nonnegative()).optional(),
  evalCardPath: z.string().optional(),
  generationConfig: z
    .object({
      model: z.object({
        temperature: z.number(),
        topP: z.number().min(0).max(1).optional(),
        maxOutputTokens: z.number().int().positive(),
      }),
      judge: z.object({
        temperature: z.number(),
        topP: z.number().min(0).max(1).optional(),
        maxOutputTokens: z.number().int().positive(),
      }),
      retryPolicy: z.object({
        maxRetries: z.number().int().nonnegative(),
        backoffBaseMs: z.number().int().positive(),
        backoffJitterMs: z.number().int().nonnegative(),
      }),
      timeoutMs: z.number().int().positive(),
      concurrency: z.number().int().positive().optional(),
      perModelConcurrency: z.number().int().positive().optional(),
    })
    .default(GENERATION_CONFIG),
})

export const runManifestV2Schema = z.object({
  schemaVersion: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
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

export type ComplianceRating = z.infer<typeof complianceRatingSchema>
export type BenchmarkStatus = z.infer<typeof benchmarkStatusSchema>
export type ConversationMode = z.infer<typeof conversationModeSchema>
export type JudgeStrategy = z.infer<typeof judgeStrategySchema>
export type ProviderPrecisionPolicy = z.infer<typeof providerPrecisionPolicySchema>
export type ConversationContinuity = z.infer<typeof conversationContinuitySchema>
export type RerunScope = z.infer<typeof rerunScopeSchema>
export type DerivationKind = z.infer<typeof derivationKindSchema>
export type JudgeVoteV2 = z.infer<typeof judgeVoteSchema>
export type JudgePanelRecord = z.infer<typeof judgePanelRecordSchema>
export type AuxiliaryOutcomeLabels = z.infer<typeof auxiliaryOutcomeLabelsSchema>
export type EvaluationAwarenessAnalysis = z.infer<typeof evaluationAwarenessAnalysisSchema>
export type TokenUsageTelemetry = z.infer<typeof tokenUsageTelemetrySchema>
export type PricingSnapshotEntry = z.infer<typeof pricingSnapshotEntrySchema>
export type InvocationMetrics = z.infer<typeof invocationMetricsSchema>
export type TelemetryAggregate = z.infer<typeof telemetryAggregateSchema>
export type BenchmarkResultV2 = z.infer<typeof benchmarkResultV2Schema>
export type RunSummaryV2 = z.infer<typeof runSummaryV2Schema>
export type RunMetadataV2 = z.infer<typeof runMetadataV2Schema>
export type RunManifestV2 = z.infer<typeof runManifestV2Schema>
export type RunIndexItemV2 = z.infer<typeof runIndexItemV2Schema>
