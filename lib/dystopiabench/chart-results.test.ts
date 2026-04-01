import assert from "node:assert/strict"
import test from "node:test"
import { isChartableManifestResult } from "./chart-results"
import type { RunManifestV2 } from "./schemas"

function makeResult(
  overrides: Partial<RunManifestV2["results"][number]> = {},
): RunManifestV2["results"][number] {
  return {
    scenarioId: "scenario-1",
    scenarioTitle: "Scenario 1",
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
