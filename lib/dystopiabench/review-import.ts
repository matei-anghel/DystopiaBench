import { z } from "zod"
import { complianceRatingSchema, runManifestV2Schema, type RunManifestV2 } from "./schemas"
import { COMPLIANCE_SCORES } from "./types"

export const reviewedAdjudicationRecordSchema = z.object({
  sampleId: z.string().trim().min(1).optional(),
  scenarioId: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  level: z.number().int().min(1).max(5),
  replicate: z.number().int().positive().optional(),
  compliance: complianceRatingSchema,
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().trim().min(1).optional(),
  adjudicationSource: z.enum(["human-review", "gold-set", "imported-review"]).default("imported-review"),
  operationalityFlag: z.boolean().optional(),
  severity: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  targetHarmMechanisms: z.array(z.string().trim().min(1)).optional(),
  safeAlternativeHelpfulnessFlag: z.boolean().optional(),
  manipulationOrEvasionFlag: z.boolean().optional(),
})

export const reviewedAdjudicationImportSchema = z.array(reviewedAdjudicationRecordSchema)

export type ReviewedAdjudicationRecord = z.infer<typeof reviewedAdjudicationRecordSchema>

function matchesRecord(
  row: RunManifestV2["results"][number],
  record: ReviewedAdjudicationRecord,
): boolean {
  if (record.sampleId && row.sampleId) {
    return row.sampleId === record.sampleId
  }

  return (
    row.scenarioId === record.scenarioId &&
    row.modelId === record.modelId &&
    row.level === record.level &&
    (row.replicate ?? 1) === (record.replicate ?? 1)
  )
}

export function applyReviewedAdjudications(
  manifestInput: RunManifestV2 | unknown,
  recordsInput: ReviewedAdjudicationRecord[] | unknown,
): RunManifestV2 {
  const manifest = runManifestV2Schema.parse(manifestInput)
  const records = reviewedAdjudicationImportSchema.parse(recordsInput)

  const results = manifest.results.map((row) => {
    const review = records.find((record) => matchesRecord(row, record))
    if (!review) return row

    return {
      ...row,
      compliance: review.compliance,
      primaryComplianceLabel: review.compliance,
      score: row.score === null ? null : COMPLIANCE_SCORES[review.compliance],
      confidence: review.confidence ?? row.confidence,
      adjudicationSource: review.adjudicationSource,
      judgeReasoning: review.notes ?? row.judgeReasoning,
      operationalityFlag: review.operationalityFlag ?? row.operationalityFlag,
      severity: review.severity ?? row.severity,
      targetHarmMechanisms: review.targetHarmMechanisms ?? row.targetHarmMechanisms,
      safeAlternativeHelpfulnessFlag:
        review.safeAlternativeHelpfulnessFlag ?? row.safeAlternativeHelpfulnessFlag,
      manipulationOrEvasionFlag:
        review.manipulationOrEvasionFlag ?? row.manipulationOrEvasionFlag,
    }
  })

  return {
    ...manifest,
    results,
  }
}
