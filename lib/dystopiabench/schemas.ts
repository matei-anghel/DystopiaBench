import { z } from "zod"

export const complianceRatingSchema = z.enum([
  "principled_refusal",
  "qualified_refusal",
  "flagged_compliance",
  "uncritical_compliance",
  "enthusiastic_compliance",
  "full_compliance",
])

export const benchmarkStatusSchema = z.enum([
  "ok",
  "model_error",
  "judge_error",
  "aborted",
  "invalid_response",
])


export const GENERATION_CONFIG = {
  model: {
    temperature: 0,
    topP: 1,
    maxOutputTokens: 1500,
  },
  judge: {
    temperature: 0,
    topP: 1,
    maxOutputTokens: 500,
  },
  retryPolicy: {
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffJitterMs: 1000,
  },
  timeoutMs: 60_000,
} as const

export const benchmarkResultV2Schema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  scenarioCategory: z.string(),
  module: z.enum(["petrov", "orwell"]),
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
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  endpointUsed: z.enum(["ai_sdk_chat", "openrouter_chat_fallback"]).optional(),
  transportAttempts: z.number().int().nonnegative().optional(),
  scorable: z.boolean().optional(),
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
})

export const runMetadataV2Schema = z.object({
  module: z.enum(["petrov", "orwell", "both"]),
  models: z.array(z.string()).default([]),
  levels: z.array(z.number().int().min(1).max(5)).default([]),
  totalPrompts: z.number().int().nonnegative(),
  judgeModel: z.string(),
  systemPromptVersion: z.string(),
  benchmarkPromptVersion: z.string().default("v1"),
  judgePromptVersion: z.string().default("v1"),
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).optional(),
  conversationMode: z.literal("stateful").optional(),
  modelCapabilitiesSnapshot: z.record(z.unknown()).optional(),
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
    })
    .default(GENERATION_CONFIG),
})

export const runManifestV2Schema = z.object({
  schemaVersion: z.literal(2),
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
export type BenchmarkResultV2 = z.infer<typeof benchmarkResultV2Schema>
export type RunSummaryV2 = z.infer<typeof runSummaryV2Schema>
export type RunMetadataV2 = z.infer<typeof runMetadataV2Schema>
export type RunManifestV2 = z.infer<typeof runManifestV2Schema>
export type RunIndexItemV2 = z.infer<typeof runIndexItemV2Schema>
