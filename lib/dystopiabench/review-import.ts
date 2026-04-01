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
type ManifestResultRow = RunManifestV2["results"][number]

function tupleTargetKey(params: {
  scenarioId: string
  modelId: string
  level: number
  replicate?: number
}): string {
  return `${params.scenarioId}::${params.modelId}::${params.level}::${params.replicate ?? 1}`
}

function getManifestRowIdentity(row: ManifestResultRow): string {
  return row.sampleId ? `sample:${row.sampleId}` : `tuple:${tupleTargetKey(row)}`
}

function describeTupleTarget(params: {
  scenarioId: string
  modelId: string
  level: number
  replicate?: number
}): string {
  return `scenarioId=${params.scenarioId}, modelId=${params.modelId}, level=${params.level}, replicate=${params.replicate ?? 1}`
}

function describeReviewRecord(record: ReviewedAdjudicationRecord): string {
  if (record.sampleId) {
    return `sampleId=${record.sampleId}`
  }
  return describeTupleTarget(record)
}

function indexRowsByKey(
  rows: ManifestResultRow[],
  getKey: (row: ManifestResultRow) => string | undefined,
): Map<string, ManifestResultRow[]> {
  const index = new Map<string, ManifestResultRow[]>()

  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    const existing = index.get(key)
    if (existing) {
      existing.push(row)
    } else {
      index.set(key, [row])
    }
  }

  return index
}

function resolveManifestRow(
  record: ReviewedAdjudicationRecord,
  rowsBySampleId: ReadonlyMap<string, ManifestResultRow[]>,
  rowsByTupleKey: ReadonlyMap<string, ManifestResultRow[]>,
): ManifestResultRow {
  const matchedRows =
    record.sampleId
      ? rowsBySampleId.get(record.sampleId) ?? []
      : rowsByTupleKey.get(tupleTargetKey(record)) ?? []

  if (matchedRows.length === 0) {
    throw new Error(`Imported review did not match any manifest row for ${describeReviewRecord(record)}.`)
  }

  if (matchedRows.length > 1) {
    throw new Error(`Imported review matched multiple manifest rows for ${describeReviewRecord(record)}.`)
  }

  return matchedRows[0]
}

export function applyReviewedAdjudications(
  manifestInput: RunManifestV2 | unknown,
  recordsInput: ReviewedAdjudicationRecord[] | unknown,
): RunManifestV2 {
  const manifest = runManifestV2Schema.parse(manifestInput)
  const records = reviewedAdjudicationImportSchema.parse(recordsInput)
  const rowsBySampleId = indexRowsByKey(manifest.results, (row) => row.sampleId)
  const rowsByTupleKey = indexRowsByKey(manifest.results, (row) => tupleTargetKey(row))
  const reviewsByRowIdentity = new Map<string, ReviewedAdjudicationRecord>()

  for (const record of records) {
    const matchedRow = resolveManifestRow(record, rowsBySampleId, rowsByTupleKey)
    const rowIdentity = getManifestRowIdentity(matchedRow)

    if (reviewsByRowIdentity.has(rowIdentity)) {
      const rowDescriptor =
        matchedRow.sampleId
          ? `sampleId=${matchedRow.sampleId}`
          : describeTupleTarget(matchedRow)
      throw new Error(`Duplicate imported reviews target the same manifest row (${rowDescriptor}).`)
    }

    reviewsByRowIdentity.set(rowIdentity, record)
  }

  const results = manifest.results.map((row) => {
    const review = reviewsByRowIdentity.get(getManifestRowIdentity(row))
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
