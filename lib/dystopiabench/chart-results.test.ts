import assert from "node:assert/strict"
import test from "node:test"
import {
  filterChartableManifestResults,
  isActiveManifestResult,
  isChartableManifestResult,
} from "./chart-results"
import type { RunManifestV2 } from "./schemas"

function makeResult(
  overrides: Partial<RunManifestV2["results"][number]> = {},
): RunManifestV2["results"][number] {
  return {
    scenarioId: "petrov-01",
    scenarioTitle: "Sentinel Launch Authorization Drift",
    scenarioCategory: "test",
    module: "petrov",
    modelId: "gpt-5.3-codex",
    modelLabel: "GPT 5.3 Codex",
    provider: "OpenAI",
    modelString: "openai/gpt-5.3-codex",
    level: 1,
    prompt: "Prompt",
    response: "Response",
    compliance: "refusal",
    score: 0,
    status: "ok",
    scorable: true,
    timestamp: Date.UTC(2026, 2, 26),
    ...overrides,
  }
}

test("isChartableManifestResult accepts only explicitly scorable scored rows", () => {
  assert.equal(isChartableManifestResult(makeResult()), true)
  assert.equal(isChartableManifestResult(makeResult({ scorable: false })), false)
  assert.equal(isChartableManifestResult(makeResult({ score: null })), false)
  assert.equal(isChartableManifestResult(makeResult({ scorable: undefined })), false)
})

test("isActiveManifestResult rejects temporarily disabled modules and unknown scenarios", () => {
  assert.equal(isActiveManifestResult(makeResult()), true)
  assert.equal(isActiveManifestResult(makeResult({ module: "kafka" })), false)
  assert.equal(isActiveManifestResult(makeResult({ scenarioId: "kafka-01" })), false)
  assert.equal(isActiveManifestResult(makeResult({ scenarioId: "not-in-catalog" })), false)
})

test("filterChartableManifestResults keeps only active chartable rows", () => {
  const manifest = {
    results: [
      makeResult({ scenarioId: "petrov-01", module: "petrov", score: 33 }),
      makeResult({ scenarioId: "kafka-01", module: "kafka", score: 66 }),
      makeResult({ scenarioId: "petrov-02", module: "petrov", scorable: false }),
    ],
  } as RunManifestV2

  assert.deepEqual(
    filterChartableManifestResults(manifest).map((result) => ({
      scenarioId: result.scenarioId,
      module: result.module,
      score: result.score,
    })),
    [{ scenarioId: "petrov-01", module: "petrov", score: 33 }],
  )
})
