import { z } from "zod"
import type { ScenarioModule, ScenarioProvenance, ScenarioReleaseTier, ScenarioSplit } from "./types"

export const scenarioSplitSchema = z.enum([
  "public-core",
  "public-canary",
  "private-holdout",
  "partner-only",
  "organization-local",
])

export const scenarioReviewStatusSchema = z.enum(["draft", "verified", "approved", "retired"])
export const scenarioContaminationRiskSchema = z.enum(["low", "medium", "high", "unknown"])
export const scenarioSensitivityTierSchema = z.enum(["public", "internal", "restricted", "critical"])

export const scenarioCitationSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().url().optional(),
  source: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
})

export const scenarioCanaryTokenSchema = z.object({
  tokenId: z.string().trim().min(1),
  marker: z.string().trim().min(1),
  placement: z.enum(["prompt", "context", "metadata"]),
  notes: z.string().trim().min(1).optional(),
})

export const scenarioReviewRecordSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  scenarioId: z.string().trim().min(1),
  moduleId: z.string().trim().min(1),
  split: scenarioSplitSchema,
  reviewStatus: scenarioReviewStatusSchema,
  annotationRubricVersion: z.string().trim().min(1),
  reviewers: z.array(z.string().trim().min(1)).default([]),
  adjudicatedBy: z.array(z.string().trim().min(1)).default([]),
  citations: z.array(scenarioCitationSchema).default([]),
  knownLimitations: z.array(z.string().trim().min(1)).default([]),
  contaminationRisk: scenarioContaminationRiskSchema,
  sensitivityTier: scenarioSensitivityTierSchema,
  canaryTokens: z.array(scenarioCanaryTokenSchema).default([]),
  reviewedAt: z.string().trim().min(1),
  notes: z.string().trim().min(1).optional(),
})

export const scenarioReviewManifestSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  generatedAt: z.string().trim().min(1),
  benchmarkBundleId: z.string().trim().min(1).optional(),
  records: z.array(scenarioReviewRecordSchema).min(1),
})

export type ScenarioReviewRecord = z.infer<typeof scenarioReviewRecordSchema>
export type ScenarioReviewManifest = z.infer<typeof scenarioReviewManifestSchema>

export const SPLIT_TO_RELEASE_TIER: Record<ScenarioSplit, ScenarioReleaseTier> = {
  "public-core": "core-public",
  "public-canary": "core-public",
  "private-holdout": "holdout",
  "partner-only": "partner-only",
  "organization-local": "organization-local",
}

export function deriveReleaseTierFromSplit(split: ScenarioSplit | undefined): ScenarioReleaseTier | undefined {
  if (!split) return undefined
  return SPLIT_TO_RELEASE_TIER[split]
}

export function inferSplitFromReleaseTier(releaseTier: ScenarioReleaseTier | undefined): ScenarioSplit | undefined {
  switch (releaseTier) {
    case "core-public":
      return "public-core"
    case "holdout":
      return "private-holdout"
    case "partner-only":
      return "partner-only"
    case "organization-local":
      return "organization-local"
    default:
      return undefined
  }
}

export function isPublicSplit(split: ScenarioSplit | undefined): boolean {
  return split === "public-core" || split === "public-canary"
}

export function isCompletedReviewStatus(status: ScenarioProvenance["reviewStatus"]): boolean {
  return status === "verified" || status === "approved"
}

export function normalizeScenarioProvenance(
  provenance: ScenarioProvenance | undefined,
  defaults: Partial<ScenarioProvenance> = {},
): ScenarioProvenance | undefined {
  if (!provenance && Object.keys(defaults).length === 0) return undefined

  const merged = {
    ...defaults,
    ...provenance,
  } satisfies Partial<ScenarioProvenance>

  const split = merged.split ?? inferSplitFromReleaseTier(merged.releaseTier)
  const releaseTier = merged.releaseTier ?? deriveReleaseTierFromSplit(split)
  if (!merged.sourceType) return undefined

  return {
    ...merged,
    sourceType: merged.sourceType,
    split,
    releaseTier,
  }
}

export function requiresCompletedReviewMetadata(provenance: ScenarioProvenance | undefined): boolean {
  if (!provenance) return false
  const split = provenance.split ?? inferSplitFromReleaseTier(provenance.releaseTier)
  if (!split) return false
  return split !== "public-core"
}

export function hasCompletedReviewMetadata(provenance: ScenarioProvenance | undefined): boolean {
  if (!provenance) return false
  if (!requiresCompletedReviewMetadata(provenance)) return true

  const split = provenance.split ?? inferSplitFromReleaseTier(provenance.releaseTier)
  const reviewers = provenance.reviewers?.length ?? 0
  const citations = provenance.citations?.length ?? 0
  const limitations = provenance.knownLimitations?.length ?? 0
  const adjudicators = provenance.adjudicatedBy?.length ?? 0

  if (!split) return false
  if (!isCompletedReviewStatus(provenance.reviewStatus)) return false
  if (!provenance.annotationRubricVersion) return false
  if (reviewers === 0) return false
  if (citations === 0) return false
  if (limitations === 0) return false
  if (!provenance.contaminationRisk || !provenance.sensitivityTier) return false
  if ((split === "private-holdout" || provenance.reviewStatus === "approved") && adjudicators === 0) {
    return false
  }

  return true
}

function allowsSplitForBundleTier(split: ScenarioSplit, releaseTier: ScenarioReleaseTier): boolean {
  switch (releaseTier) {
    case "core-public":
      return split === "public-core" || split === "public-canary"
    case "holdout":
      return split === "public-core" || split === "public-canary" || split === "private-holdout"
    case "partner-only":
      return split === "public-core" || split === "public-canary" || split === "partner-only"
    case "organization-local":
      return true
    default:
      return false
  }
}

export function collectBundleGovernanceIssues(
  modules: ScenarioModule[],
  bundleReleaseTier: ScenarioReleaseTier,
): string[] {
  const issues: string[] = []

  for (const moduleDefinition of modules) {
    const moduleProvenance = normalizeScenarioProvenance(moduleDefinition.provenance)
    const moduleSplit = moduleProvenance?.split ?? "public-core"
    if (!allowsSplitForBundleTier(moduleSplit, bundleReleaseTier)) {
      issues.push(
        `Module '${moduleDefinition.id}' uses split '${moduleSplit}' incompatible with bundle release tier '${bundleReleaseTier}'.`
      )
    }

    if (requiresCompletedReviewMetadata(moduleProvenance) && !hasCompletedReviewMetadata(moduleProvenance)) {
      issues.push(`Module '${moduleDefinition.id}' is missing completed review metadata for split '${moduleSplit}'.`)
    }

    for (const scenario of moduleDefinition.scenarios) {
      const scenarioProvenance = normalizeScenarioProvenance(scenario.provenance, moduleProvenance)
      const split = scenarioProvenance?.split ?? moduleSplit
      if (!allowsSplitForBundleTier(split, bundleReleaseTier)) {
        issues.push(
          `Scenario '${scenario.id}' uses split '${split}' incompatible with bundle release tier '${bundleReleaseTier}'.`
        )
      }

      if (requiresCompletedReviewMetadata(scenarioProvenance) && !hasCompletedReviewMetadata(scenarioProvenance)) {
        issues.push(`Scenario '${scenario.id}' is missing completed review metadata for split '${split}'.`)
      }
    }
  }

  return issues
}

export function assertBundleGovernance(modules: ScenarioModule[], bundleReleaseTier: ScenarioReleaseTier): void {
  const issues = collectBundleGovernanceIssues(modules, bundleReleaseTier)
  if (issues.length > 0) {
    throw new Error(issues.join(" "))
  }
}

export function buildScenarioReviewManifest(
  modules: ScenarioModule[],
  options: { benchmarkBundleId?: string; generatedAt?: string } = {},
): ScenarioReviewManifest {
  return scenarioReviewManifestSchema.parse({
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    benchmarkBundleId: options.benchmarkBundleId,
    records: modules.flatMap((moduleDefinition) =>
      moduleDefinition.scenarios.map((scenario) => {
        const provenance = normalizeScenarioProvenance(scenario.provenance, moduleDefinition.provenance)
        return {
          schemaVersion: 1,
          scenarioId: scenario.id,
          moduleId: String(moduleDefinition.id),
          split: provenance?.split ?? "public-core",
          reviewStatus: provenance?.reviewStatus ?? "draft",
          annotationRubricVersion: provenance?.annotationRubricVersion ?? "unassigned",
          reviewers: provenance?.reviewers ?? [],
          adjudicatedBy: provenance?.adjudicatedBy ?? [],
          citations: provenance?.citations ?? [],
          knownLimitations: provenance?.knownLimitations ?? [],
          contaminationRisk: provenance?.contaminationRisk ?? "unknown",
          sensitivityTier: provenance?.sensitivityTier ?? "internal",
          canaryTokens: provenance?.canaryTokens ?? [],
          reviewedAt: provenance?.updatedAt ?? provenance?.createdAt ?? new Date().toISOString(),
        }
      }),
    ),
  })
}
