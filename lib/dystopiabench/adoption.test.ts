import assert from "node:assert/strict"
import test from "node:test"
import { createBenchmarkBundle } from "./bundles"
import { buildScenarioSummaries, manifestToJsonl, runMetadataToCsv, scenarioSummariesToCsv } from "./exports"
import { evaluateGate } from "./gates"
import type { RunManifestV2 } from "./schemas"

function makeManifest(): RunManifestV2 {
  return {
    schemaVersion: 5,
    runId: "adoption-test-run",
    timestamp: 1,
    date: "2026-03-27T00:00:00.000Z",
    metadata: {
      module: "both",
      models: ["deepseek-v3.2"],
      levels: [1, 4, 5],
      totalPrompts: 3,
      judgeModel: "google/gemini-3-flash-preview",
      judgeModels: ["google/gemini-3-flash-preview"],
      judgeStrategy: "single",
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      providerPrecisionPolicy: "default",
      experimentId: "exp-1",
      replicates: 1,
      generationConfig: {
        model: { temperature: 0, topP: 1, maxOutputTokens: 1500 },
        judge: { temperature: 0, topP: 1, maxOutputTokens: 220 },
        retryPolicy: { maxRetries: 2, backoffBaseMs: 1000, backoffJitterMs: 1000 },
        timeoutMs: 90000,
      },
    },
    summary: {
      totalPrompts: 3,
      scoredPrompts: 3,
      averageDcs: 22,
      drfr: 67,
      statusCounts: {
        ok: 3,
        model_error: 0,
        judge_error: 0,
        aborted: 0,
        invalid_response: 0,
      },
      modelSuccessRate: 100,
      judgeSuccessRate: 100,
      scorableRate: 100,
    },
    results: [
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario A",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 1,
        prompt: "P1",
        response: "R1",
        compliance: "hesitant",
        score: 33,
        status: "ok",
        scorable: true,
        timestamp: 1,
      },
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario A",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 4,
        prompt: "P4",
        response: "R4",
        compliance: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        timestamp: 2,
      },
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario A",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 5,
        prompt: "P5",
        response: "R5",
        compliance: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        timestamp: 3,
      },
    ],
  }
}

test("createBenchmarkBundle emits stable lab-facing bundle metadata", () => {
  const bundle = createBenchmarkBundle()
  assert.equal(bundle.benchmarkBundleId, "dystopiabench-core@1.0.0")
  assert.equal(bundle.bundleVersion, "1.0.0")
  assert.equal(bundle.releaseTier, "core-public")
})

test("export helpers emit summaries and serializations", () => {
  const manifest = makeManifest()
  const summaries = buildScenarioSummaries(manifest.results)

  assert.equal(summaries.length, 1)
  assert.match(manifestToJsonl(manifest), /"scenarioId":"petrov-001"/)
  assert.match(scenarioSummariesToCsv(summaries), /scenarioId,scenarioTitle/)
  assert.match(runMetadataToCsv(manifest), /key,value/)
})

test("gate evaluation fails when the run exceeds configured thresholds", () => {
  const manifest = makeManifest()
  const result = evaluateGate(
    manifest,
    {
      name: "strict",
      assertions: {
        maxOverallDcs: 10,
        minRefusalRateL4L5: 90,
      },
    },
  )

  assert.equal(result.passed, false)
  assert.ok(result.findings.some((entry) => entry.includes("averageDcs")))
})
