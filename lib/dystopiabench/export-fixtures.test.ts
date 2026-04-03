import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  buildScenarioSummaries,
  createRunEvalCard,
  manifestToInspectLog,
  manifestToJsonl,
  manifestToOpenAIEvalsJsonl,
  runMetadataToCsv,
  scenarioSummariesToCsv,
  writePromptRowsParquet,
  writeRunMetadataParquet,
  writeScenarioSummariesParquet,
} from "./exports"
import { applyReviewedAdjudications } from "./review-import"
import { makeRunManifest } from "./test-fixtures"

test("export helpers generate fixture-backed JSONL and CSV outputs", () => {
  const manifest = makeRunManifest()
  const summaries = buildScenarioSummaries(manifest.results)

  assert.match(manifestToJsonl(manifest), /"scenarioId":"fixture-001"/)
  assert.match(manifestToOpenAIEvalsJsonl(manifest), /"ideal":"refusal"/)
  assert.match(scenarioSummariesToCsv(summaries), /scenarioId,.*scenarioTitle/)
  assert.match(runMetadataToCsv(manifest), /artifactPolicy/)
  assert.match(runMetadataToCsv(manifest), /totalCostUsd/)
})

test("parquet exports write fixture files to disk", async () => {
  const manifest = makeRunManifest()
  const summaries = buildScenarioSummaries(manifest.results)
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-export-fixtures-"))

  try {
    const promptRowsPath = join(tempRoot, "rows.parquet")
    const summaryPath = join(tempRoot, "scenario-summaries.parquet")
    const metadataPath = join(tempRoot, "run-metadata.parquet")

    await writePromptRowsParquet(promptRowsPath, manifest)
    await writeScenarioSummariesParquet(summaryPath, summaries)
    await writeRunMetadataParquet(metadataPath, manifest)

    for (const path of [promptRowsPath, summaryPath, metadataPath]) {
      assert.equal(existsSync(path), true)
      assert.ok(statSync(path).size > 0)
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("interoperability exports include inspect-style samples and eval card metadata", () => {
  const manifest = makeRunManifest()
  const inspectLog = manifestToInspectLog(manifest)
  const evalCard = createRunEvalCard(manifest)

  assert.equal(Array.isArray(inspectLog.samples), true)
  assert.equal(evalCard.runId, manifest.runId)
  assert.equal(evalCard.scenarioCounts.bySplit["public-core"], 1)
  assert.equal(evalCard.evaluationAwareness?.traceCoverageRate, 100)
  assert.equal(evalCard.telemetry?.totalTokens, 262)
  assert.equal((inspectLog.metadata as { telemetry?: { total_cost_usd?: number } }).telemetry?.total_cost_usd, 0.0007414)
})

test("review imports merge adjudications back into manifest rows", () => {
  const manifest = makeRunManifest()
  const updated = applyReviewedAdjudications(manifest, [
    {
      scenarioId: "fixture-001",
      modelId: "gpt-5.3-codex",
      level: 1,
      compliance: "hesitant",
      confidence: 0.75,
      adjudicationSource: "human-review",
      notes: "Human reviewer marked this as hesitant due to partial assistance.",
      replicate: 1,
    },
  ])

  assert.equal(updated.results[0].primaryComplianceLabel, "hesitant")
  assert.equal(updated.results[0].confidence, 0.75)
  assert.equal(updated.results[0].adjudicationSource, "human-review")
})

test("eval card JSON shape is stable across disk serialization", () => {
  const manifest = makeRunManifest()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-eval-card-fixtures-"))

  try {
    const path = join(tempRoot, "eval-card.json")
    const evalCard = createRunEvalCard(manifest)
    const serialized = JSON.stringify(evalCard, null, 2)
    writeFileSync(path, serialized, "utf-8")
    assert.match(serialized, /"gating"/)
    assert.match(serialized, /"artifactPolicy"/)
    assert.match(serialized, /"telemetry"/)
    assert.equal(JSON.parse(serialized).runId, manifest.runId)
    assert.equal(JSON.parse(readFileSync(path, "utf-8")).runId, manifest.runId)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
