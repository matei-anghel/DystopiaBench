import assert from "node:assert/strict"
import test from "node:test"
import { createResultsIndex, getEscalationCurveByModel } from "./analytics"
import type { BenchmarkResult } from "./types"

function makeChartRow(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    scenarioId: "scenario-a",
    scenarioTitle: "Scenario A",
    scenarioCategory: "test",
    module: "petrov",
    modelId: "model-a",
    modelLabel: "Model A",
    provider: "Provider A",
    level: 1,
    compliance: "refusal",
    score: 0,
    ...overrides,
  }
}

test("createResultsIndex builds lookup maps for models and scenarios", () => {
  const rows = [
    makeChartRow(),
    makeChartRow({ level: 2, score: 66, compliance: "compliant" }),
    makeChartRow({
      modelId: "model-b",
      modelLabel: "Model B",
      provider: "Provider B",
      score: 100,
      compliance: "proactive",
    }),
    makeChartRow({
      scenarioId: "scenario-b",
      scenarioTitle: "Scenario B",
      score: 33,
      compliance: "hesitant",
    }),
  ]

  const index = createResultsIndex(rows)

  assert.deepEqual(index.modelIds, ["model-a", "model-b"])
  assert.deepEqual(index.scenarioIds, ["scenario-a", "scenario-b"])
  assert.equal(index.byModel.get("model-a")?.length, 3)
  assert.equal(index.byScenario.get("scenario-a")?.length, 3)
  assert.equal(index.byScenarioLevel.get("scenario-a::1")?.length, 2)
  assert.equal(index.byScenarioModelLevel.get("scenario-a::model-b::1")?.score, 100)
})

test("getEscalationCurveByModel can reuse a prebuilt results index", () => {
  const rows = [
    makeChartRow(),
    makeChartRow({ level: 2, score: 66, compliance: "compliant" }),
    makeChartRow({
      modelId: "model-b",
      modelLabel: "Model B",
      provider: "Provider B",
      score: 100,
      compliance: "proactive",
    }),
  ]

  const index = createResultsIndex(rows)
  const curve = getEscalationCurveByModel(rows, index)

  assert.equal(curve.length, 5)
  assert.equal(curve[0]["model-a"], 0)
  assert.equal(curve[0]["model-b"], 100)
})

test("getEscalationCurveByModel reports missing levels as null, not 0", () => {
  const rows = [makeChartRow({ level: 1, score: 66, compliance: "compliant" })]

  const curve = getEscalationCurveByModel(rows)

  assert.equal(curve[0]["model-a"], 66)
  assert.equal(curve[1]["model-a"], null)
})
