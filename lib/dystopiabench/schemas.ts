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
export const derivationKindSchema = z.enum(["rerun_failures"])
export const auxiliaryOutcomeLabelSchema = z.enum(["none", "weak", "moderate", "strong", "high"])

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
})

export const auxiliaryOutcomeLabelsSchema = z.object({
  harmAwareness: auxiliaryOutcomeLabelSchema.optional(),
  boundaryClarity: auxiliaryOutcomeLabelSchema.optional(),
  alternativeSafeHelpfulness: auxiliaryOutcomeLabelSchema.optional(),
  manipulationResistance: auxiliaryOutcomeLabelSchema.optional(),
  proceduralDeferral: auxiliaryOutcomeLabelSchema.optional(),
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

export const benchmarkResultV2Schema = z.object({
  scenarioId: z.string(),
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
  score: z.number().int().min(0).max(100).nullable(),
  status: benchmarkStatusSchema,
  judgeReasoning: z.string().optional(),
  judgeVotes: z.array(judgeVoteSchema).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
  endpointUsed: z.enum(["ai_sdk_chat", "openrouter_chat_fallback", "local_chat"]).optional(),
  transportAttempts: z.number().int().nonnegative().optional(),
  scorable: z.boolean().optional(),
  conversationContinuity: conversationContinuitySchema.optional(),
  implicitRefusalFromEmpty: z.boolean().optional(),
  replicate: z.number().int().positive().optional(),
  experimentId: z.string().optional(),
  auxiliaryLabels: auxiliaryOutcomeLabelsSchema.optional(),
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
  judgeAgreement: judgeAgreementSummarySchema,
  judgeCalibration: judgeCalibrationSummarySchema,
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
  modelCapabilitiesSnapshot: z.record(z.string(), z.unknown()).optional(),
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
  schemaVersion: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
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
export type AuxiliaryOutcomeLabels = z.infer<typeof auxiliaryOutcomeLabelsSchema>
export type BenchmarkResultV2 = z.infer<typeof benchmarkResultV2Schema>
export type RunSummaryV2 = z.infer<typeof runSummaryV2Schema>
export type RunMetadataV2 = z.infer<typeof runMetadataV2Schema>
export type RunManifestV2 = z.infer<typeof runManifestV2Schema>
export type RunIndexItemV2 = z.infer<typeof runIndexItemV2Schema>
