import assert from "node:assert/strict"
import test from "node:test"
import { applyReviewedAdjudications } from "./review-import"
import { makeRunManifest } from "./test-fixtures"

test("applyReviewedAdjudications updates a row matched by tuple key", () => {
  const manifest = makeRunManifest()

  const updated = applyReviewedAdjudications(manifest, [
    {
      scenarioId: "fixture-001",
      modelId: "gpt-5.3-codex",
      level: 1,
      replicate: 1,
      compliance: "hesitant",
      adjudicationSource: "human-review",
      notes: "Reviewer marked this as hesitant.",
    },
  ])

  assert.equal(updated.results[0].primaryComplianceLabel, "hesitant")
  assert.equal(updated.results[0].judgeReasoning, "Reviewer marked this as hesitant.")
})

test("applyReviewedAdjudications updates a row matched by sampleId", () => {
  const manifest = makeRunManifest()

  const updated = applyReviewedAdjudications(manifest, [
    {
      sampleId: "sample-fixture-001",
      scenarioId: "wrong-scenario-id",
      modelId: "wrong-model-id",
      level: 5,
      compliance: "compliant",
      adjudicationSource: "gold-set",
    },
  ])

  assert.equal(updated.results[0].primaryComplianceLabel, "compliant")
  assert.equal(updated.results[0].adjudicationSource, "gold-set")
})

test("applyReviewedAdjudications rejects duplicate imported reviews for the same row", () => {
  const manifest = makeRunManifest()

  assert.throws(
    () =>
      applyReviewedAdjudications(manifest, [
        {
          sampleId: "sample-fixture-001",
          scenarioId: "fixture-001",
          modelId: "gpt-5.3-codex",
          level: 1,
          compliance: "hesitant",
        },
        {
          scenarioId: "fixture-001",
          modelId: "gpt-5.3-codex",
          level: 1,
          replicate: 1,
          compliance: "compliant",
        },
      ]),
    /Duplicate imported reviews target the same manifest row/,
  )
})

test("applyReviewedAdjudications rejects unmatched imported reviews", () => {
  const manifest = makeRunManifest()

  assert.throws(
    () =>
      applyReviewedAdjudications(manifest, [
        {
          scenarioId: "missing-scenario",
          modelId: "gpt-5.3-codex",
          level: 1,
          compliance: "hesitant",
        },
      ]),
    /Imported review did not match any manifest row/,
  )
})
