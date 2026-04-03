import { z } from "zod"
import type { RunManifestV2 } from "./schemas"
import { artifactVisibilitySchema, runManifestV2Schema } from "./schemas"

export const evalCardSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  generatedAt: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  benchmark: z.object({
    benchmarkId: z.string().trim().min(1),
    benchmarkBundleId: z.string().trim().min(1).optional(),
    benchmarkBundleVersion: z.string().trim().min(1).optional(),
    datasetBundleVersion: z.string().trim().min(1).optional(),
    releaseTier: z.string().trim().min(1).optional(),
    splitSummary: z.record(z.string(), z.number().int().nonnegative()),
  }),
  scenarioCounts: z.object({
    total: z.number().int().nonnegative(),
    bySplit: z.record(z.string(), z.number().int().nonnegative()),
    bySensitivityTier: z.record(z.string(), z.number().int().nonnegative()),
  }),
  judge: z.object({
    judgeModel: z.string().trim().min(1),
    judgeModels: z.array(z.string()).default([]),
    judgeStrategy: z.string().trim().min(1).optional(),
    judgeTieBreakerModel: z.string().trim().min(1).optional(),
    calibrationReference: z.object({
      calibrationSetId: z.string().trim().min(1),
      calibrationSetVersion: z.string().trim().min(1),
      accuracy: z.number().min(0).max(100).optional(),
    }).optional(),
  }),
  contamination: z.object({
    notes: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  }),
  evaluationAwareness: z.object({
    traceCoverageRate: z.number().min(0).max(100).optional(),
    evaluationAwarenessRate: z.number().min(0).max(100).optional(),
    deceptionSuspicionRate: z.number().min(0).max(100).optional(),
    responseTraceConflictRate: z.number().min(0).max(100).optional(),
  }).optional(),
  gating: z.object({
    verdict: z.enum(["pass", "fail", "not-evaluated"]),
    summary: z.string().trim().min(1),
  }),
  artifactPolicy: z.object({
    visibility: artifactVisibilitySchema,
    publicSafe: z.boolean(),
  }),
  telemetry: z.object({
    wallClockMs: z.number().int().nonnegative().optional(),
    totalCostUsd: z.number().nonnegative().optional(),
    benchmarkCostUsd: z.number().nonnegative().optional(),
    judgingCostUsd: z.number().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    reasoningTokens: z.number().int().nonnegative().optional(),
    nonReasoningOutputTokens: z.number().int().nonnegative().optional(),
  }).optional(),
})

export type EvalCard = z.infer<typeof evalCardSchema>

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1
      return acc
    },
    {} as Record<T, number>,
  )
}

export function createEvalCard(
  manifestInput: RunManifestV2 | unknown,
  options: { gatingVerdict?: "pass" | "fail"; gatingSummary?: string; generatedAt?: string } = {},
): EvalCard {
  const manifest = runManifestV2Schema.parse(manifestInput)
  const splitSummary = manifest.metadata.splitSummary ?? manifest.metadata.benchmarkDefinition?.splitSummary ?? {}
  const scenarioSplits = manifest.results.map((row) => row.scenarioSplit ?? "public-core")
  const sensitivityTiers = manifest.results.map((row) => row.scenarioSensitivityTier ?? "public")

  const contaminationNotes = Array.from(
    new Set(
      manifest.results.flatMap((row) =>
        row.canaryTokens && row.canaryTokens.length > 0
          ? [`Preserve canary markers for ${row.scenarioId} in private/internal artifacts.`]
          : [],
      ),
    ),
  )

  return evalCardSchema.parse({
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    runId: manifest.runId,
    benchmark: {
      benchmarkId: manifest.metadata.benchmarkDefinition?.benchmarkId ?? "dystopiabench",
      benchmarkBundleId: manifest.metadata.benchmarkDefinition?.benchmarkBundleId,
      benchmarkBundleVersion: manifest.metadata.benchmarkDefinition?.benchmarkBundleVersion,
      datasetBundleVersion: manifest.metadata.benchmarkDefinition?.datasetBundleVersion ?? manifest.metadata.datasetBundleVersion,
      releaseTier: manifest.metadata.benchmarkDefinition?.releaseTier,
      splitSummary,
    },
    scenarioCounts: {
      total: manifest.results.length,
      bySplit: countBy(scenarioSplits),
      bySensitivityTier: countBy(sensitivityTiers),
    },
    judge: {
      judgeModel: manifest.metadata.judgeModel,
      judgeModels: manifest.metadata.judgeModels ?? [],
      judgeStrategy: manifest.metadata.judgeStrategy,
      judgeTieBreakerModel: manifest.metadata.judgeTieBreakerModel,
      calibrationReference: manifest.summary.judgeCalibration
        ? {
            calibrationSetId: manifest.summary.judgeCalibration.calibrationSetId,
            calibrationSetVersion: manifest.summary.judgeCalibration.calibrationSetVersion,
            accuracy: manifest.summary.judgeCalibration.accuracy,
          }
        : undefined,
    },
    contamination: {
      notes: contaminationNotes,
      limitations: Array.from(
        new Set(
          manifest.results.flatMap((row) =>
            row.scenarioSplit === "public-core"
              ? ["Public scenarios may be susceptible to contamination from public training corpora."]
              : [],
          ),
        ),
      ),
    },
    evaluationAwareness: manifest.summary.evaluationAwareness
      ? {
          traceCoverageRate: manifest.summary.evaluationAwareness.traceCoverageRate,
          evaluationAwarenessRate: manifest.summary.evaluationAwareness.evaluationAwarenessRate,
          deceptionSuspicionRate: manifest.summary.evaluationAwareness.deceptionSuspicionRate,
          responseTraceConflictRate: manifest.summary.evaluationAwareness.responseTraceConflictRate,
        }
      : undefined,
    gating: {
      verdict: options.gatingVerdict ?? "not-evaluated",
      summary: options.gatingSummary ?? "No gating verdict recorded for this artifact.",
    },
    artifactPolicy: {
      visibility: manifest.metadata.artifactPolicy?.visibility ?? "public",
      publicSafe: manifest.metadata.artifactPolicy?.publicSafe ?? true,
    },
    telemetry: manifest.summary.telemetry
      ? {
          wallClockMs: manifest.summary.telemetry.wallClockMs,
          totalCostUsd: manifest.summary.telemetry.overall.costUsd,
          benchmarkCostUsd: manifest.summary.telemetry.benchmark.costUsd,
          judgingCostUsd: manifest.summary.telemetry.judging.costUsd,
          totalTokens: manifest.summary.telemetry.overall.totalTokens,
          reasoningTokens: manifest.summary.telemetry.overall.reasoningTokens,
          nonReasoningOutputTokens: manifest.summary.telemetry.overall.nonReasoningOutputTokens,
        }
      : undefined,
  })
}
