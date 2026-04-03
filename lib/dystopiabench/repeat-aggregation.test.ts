import assert from "node:assert/strict"
import test from "node:test"
import { getDRFRByModel } from "./analytics"
import { aggregateResultsByTuple } from "./repeat-aggregation"
import { summarizeResults } from "./runner"
import type { BenchmarkResultV2 } from "./schemas"
import type { BenchmarkResult } from "./types"

function makeResult(overrides: Partial<BenchmarkResultV2> = {}): BenchmarkResultV2 {
  return {
    scenarioId: "scenario-1",
    scenarioTitle: "Scenario 1",
    scenarioCategory: "test",
    module: "petrov",
    modelId: "deepseek-v3.2",
    modelLabel: "DeepSeek V3.2",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v3.2",
    level: 1,
    prompt: "Prompt",
    response: "Response",
    compliance: "refusal",
    score: 0,
    status: "ok",
    scorable: true,
    replicate: 1,
    timestamp: 1,
    ...overrides,
  }
}

test("aggregateResultsByTuple groups repeated attempts and retains variance metadata", () => {
  const tuples = aggregateResultsByTuple([
    makeResult({ score: 0, compliance: "refusal", replicate: 1, timestamp: 1 }),
    makeResult({ score: 66, compliance: "compliant", replicate: 2, timestamp: 2 }),
    makeResult({
      scenarioId: "scenario-2",
      scenarioTitle: "Scenario 2",
      level: 5,
      score: 100,
      compliance: "proactive",
      timestamp: 3,
    }),
  ])

  assert.equal(tuples.length, 2)
  assert.equal(tuples[0].scenarioId, "scenario-1")
  assert.equal(tuples[0].scenarioTitle, "Scenario 1")
  assert.equal(tuples[0].score, 33)
  assert.equal(tuples[0].compliance, "hesitant")
  assert.equal(tuples[0].refusalRate, 50)
  assert.equal(tuples[0].scoreStdDev, 33)
  assert.equal(tuples[0].observedReplicates, 2)
  assert.equal(tuples[0].scoredReplicates, 2)
  assert.equal(tuples[0].reliableScore, 33)
  assert.deepEqual(tuples[0].statusCounts, {
    ok: 2,
    model_error: 0,
    judge_error: 0,
    aborted: 0,
    invalid_response: 0,
  })
})

test("summarizeResults uses tuple-level averages while keeping attempt counts", () => {
  const summary = summarizeResults([
    makeResult({ score: 0, compliance: "refusal", replicate: 1, timestamp: 1 }),
    makeResult({ score: 100, compliance: "proactive", replicate: 2, timestamp: 2 }),
    makeResult({
      scenarioId: "scenario-2",
      scenarioTitle: "Scenario 2",
      level: 5,
      score: 0,
      compliance: "refusal",
      replicate: 1,
      timestamp: 3,
    }),
  ], {
    targetReplicates: 2,
  })

  assert.equal(summary.totalPrompts, 3)
  assert.equal(summary.scoredPrompts, 3)
  assert.equal(summary.averageDcs, 25)
  assert.equal(summary.drfr, 75)
  assert.equal(summary.scoreStdDev, 25)
  assert.equal(summary.minScore, 0)
  assert.equal(summary.maxScore, 50)
  assert.equal(summary.riskSlices?.l1L2AverageDcs, 50)
  assert.equal(summary.riskSlices?.l3L5AverageDcs, 0)
  assert.deepEqual(summary.repeatStats, {
    targetReplicates: 2,
    totalTuples: 2,
    scoredTuples: 2,
    averageObservedReplicates: 1.5,
    fullyObservedTupleCount: 1,
    partiallyObservedTupleCount: 1,
    meanWithinTupleStdDev: 25,
    maxWithinTupleStdDev: 50,
  })
})

test("DRFR analytics use tuple refusal rates when repeat-aware rows are loaded", () => {
  const rows: BenchmarkResult[] = [
    {
      scenarioId: "scenario-1",
      scenarioTitle: "Scenario 1",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek V3.2",
      provider: "DeepSeek",
      level: 1,
      compliance: "hesitant",
      score: 33,
      refusalRate: 50,
      replicateCount: 2,
      scoreStdDev: 33,
    },
    {
      scenarioId: "scenario-2",
      scenarioTitle: "Scenario 2",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek V3.2",
      provider: "DeepSeek",
      level: 5,
      compliance: "refusal",
      score: 0,
      refusalRate: 100,
      replicateCount: 1,
      scoreStdDev: 0,
    },
  ]

  const drfrByModel = getDRFRByModel(rows)
  assert.equal(drfrByModel.length, 1)
  assert.equal(drfrByModel[0].drfr, 75)
})
