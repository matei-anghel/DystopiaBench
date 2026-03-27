import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createBenchmarkBundle, validateBenchmarkBundle } from "./bundles"
import { buildScenarioReviewManifest } from "./governance"
import { assertRunQuality } from "./quality"
import { makeRunManifest, makeScenarioModule } from "./test-fixtures"

test("validateBenchmarkBundle accepts reviewed public-core bundles", () => {
  const moduleDefinition = makeScenarioModule({
    provenance: {
      sourceType: "core",
      releaseTier: "core-public",
      split: "public-core",
      reviewStatus: "approved",
      annotationRubricVersion: "dcs-4tier-v2",
      reviewers: ["core-reviewer"],
      adjudicatedBy: ["core-reviewer"],
      citations: [{ title: "Core provenance" }],
      knownLimitations: ["Public scenarios can face contamination drift."],
      contaminationRisk: "medium",
      sensitivityTier: "public",
    },
  })

  const bundle = createBenchmarkBundle({ modules: [moduleDefinition], releaseTier: "core-public" })
  assert.equal(validateBenchmarkBundle(bundle).benchmarkBundleId, bundle.benchmarkBundleId)
})

test("validateBenchmarkBundle rejects private holdout bundles without review metadata", () => {
  const moduleDefinition = makeScenarioModule({
    id: "lab/holdout" as never,
    provenance: {
      sourceType: "local",
      releaseTier: "holdout",
      split: "private-holdout",
      reviewStatus: "draft",
    },
    scenarios: [
      {
        ...makeScenarioModule().scenarios[0],
        id: "lab/holdout-001",
        module: "lab/holdout" as never,
        provenance: {
          sourceType: "local",
          releaseTier: "holdout",
          split: "private-holdout",
          reviewStatus: "draft",
        },
      },
    ],
  })

  const bundle = createBenchmarkBundle({ modules: [moduleDefinition], releaseTier: "holdout" })
  assert.throws(() => validateBenchmarkBundle(bundle), /missing completed review metadata/)
})

test("validateBenchmarkBundle rejects impossible split mixes", () => {
  const moduleDefinition = makeScenarioModule({
    provenance: {
      sourceType: "local",
      releaseTier: "partner-only",
      split: "partner-only",
      reviewStatus: "approved",
      annotationRubricVersion: "dcs-4tier-v2",
      reviewers: ["partner-reviewer"],
      adjudicatedBy: ["partner-reviewer"],
      citations: [{ title: "Partner provenance" }],
      knownLimitations: ["Partner distribution only."],
      contaminationRisk: "low",
      sensitivityTier: "internal",
    },
  })

  const bundle = createBenchmarkBundle({ modules: [moduleDefinition], releaseTier: "holdout" })
  assert.throws(
    () => validateBenchmarkBundle(bundle),
    /mixes release tiers incompatible with bundle tier 'holdout'/
  )
})

test("buildScenarioReviewManifest emits records for every scenario", () => {
  const moduleDefinition = makeScenarioModule({
    provenance: {
      sourceType: "core",
      releaseTier: "core-public",
      split: "public-core",
      reviewStatus: "approved",
      annotationRubricVersion: "dcs-4tier-v2",
      reviewers: ["core-reviewer"],
      adjudicatedBy: ["core-reviewer"],
      citations: [{ title: "Core provenance" }],
      knownLimitations: ["Public scenarios can face contamination drift."],
      contaminationRisk: "medium",
      sensitivityTier: "public",
    },
  })

  const manifest = buildScenarioReviewManifest([moduleDefinition], {
    benchmarkBundleId: "fixture-bundle@1.0.0",
  })

  assert.equal(manifest.records.length, 1)
  assert.equal(manifest.records[0].split, "public-core")
})

test("bundle fixtures remain valid across disk round-trips", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-bundle-fixture-"))

  try {
    const bundlePath = join(tempRoot, "public-core.bundle.json")
    const bundle = createBenchmarkBundle({
      modules: [
        makeScenarioModule({
          provenance: {
            sourceType: "core",
            releaseTier: "core-public",
            split: "public-core",
            reviewStatus: "approved",
            annotationRubricVersion: "dcs-4tier-v2",
            reviewers: ["core-reviewer"],
            adjudicatedBy: ["core-reviewer"],
            citations: [{ title: "Core provenance" }],
            knownLimitations: ["Public scenarios can face contamination drift."],
            contaminationRisk: "medium",
            sensitivityTier: "public",
          },
        }),
      ],
    })
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf-8")
    const reloaded = validateBenchmarkBundle(JSON.parse(readFileSync(bundlePath, "utf-8")) as unknown)
    assert.equal(reloaded.releaseTier, "core-public")
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("run quality checks fail when changed rubric versions lack gold-set slice coverage", () => {
  const manifest = makeRunManifest({
    summary: {
      ...makeRunManifest().summary,
      goldSetValidation: {
        rubricVersion: "dcs-4tier-v2",
        changedFromRubricVersion: "dcs-4tier-v1",
        minimumExamplesPerSlice: 3,
        totalExampleCount: 2,
        sliceCoverage: [
          {
            slice: "public-core",
            exampleCount: 2,
            coverageRate: 100,
            accuracy: 100,
          },
        ],
      },
    },
  })

  assert.throws(() => assertRunQuality(manifest), /below minimum 3/)
})
