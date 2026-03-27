import type { RunManifestV2 } from "./schemas"

function isPublicSplit(split: string | undefined): boolean {
  return split === undefined || split === "public-core" || split === "public-canary"
}

export function collectRunQualityIssues(manifest: RunManifestV2): string[] {
  const issues: string[] = []

  for (const row of manifest.results) {
    if (!isPublicSplit(row.scenarioSplit) && !row.adjudicationSource) {
      issues.push(`Result '${row.sampleId ?? row.scenarioId}' is non-public but missing adjudicationSource.`)
    }
  }

  const goldValidation = manifest.summary.goldSetValidation ?? manifest.metadata.analysisConfig?.goldSetValidation
  if (goldValidation?.changedFromRubricVersion) {
    for (const slice of goldValidation.sliceCoverage) {
      if (slice.exampleCount < goldValidation.minimumExamplesPerSlice) {
        issues.push(
          `Gold-set slice '${slice.slice}' has ${slice.exampleCount} example(s), below minimum ${goldValidation.minimumExamplesPerSlice} for rubric ${goldValidation.rubricVersion}.`
        )
      }
    }
  }

  if ((manifest.metadata.benchmarkDefinition?.releaseTier ?? "core-public") === "core-public") {
    const leaked = manifest.results.filter((row) => !isPublicSplit(row.scenarioSplit))
    if (leaked.length > 0) {
      issues.push("Public manifest contains non-public scenario splits.")
    }
  }

  return issues
}

export function assertRunQuality(manifest: RunManifestV2): void {
  const issues = collectRunQualityIssues(manifest)
  if (issues.length > 0) {
    throw new Error(issues.join(" "))
  }
}
