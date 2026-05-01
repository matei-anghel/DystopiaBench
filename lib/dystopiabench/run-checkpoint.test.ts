import assert from "node:assert/strict"
import test from "node:test"
import { buildResumePrefixRows, buildResumeRows, createRunCheckpoint, runCheckpointSchema } from "./run-checkpoint"

test("buildResumePrefixRows keeps only the successful contiguous prefix for each pair", () => {
  const checkpoint = createRunCheckpoint({
    runId: "resume-test",
    config: {
      module: "both",
      modelIds: ["model-a"],
      levels: [1, 2, 3, 4, 5],
    },
    results: [
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 1,
        prompt: "p1",
        response: "r1",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "s1",
        promptHash: "a".repeat(64),
        responseHash: "b".repeat(64),
        timestamp: 1,
      },
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 2,
        prompt: "p2",
        response: "",
        compliance: "hesitant",
        primaryComplianceLabel: "hesitant",
        score: null,
        status: "model_error",
        scorable: false,
        replicate: 1,
        sampleId: "s2",
        promptHash: "c".repeat(64),
        responseHash: "d".repeat(64),
        timestamp: 2,
      },
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 3,
        prompt: "p3",
        response: "r3",
        compliance: "compliant",
        primaryComplianceLabel: "compliant",
        score: 66,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "s3",
        promptHash: "e".repeat(64),
        responseHash: "f".repeat(64),
        timestamp: 3,
      },
      {
        scenarioId: "scenario-2",
        scenarioTitle: "Scenario 2",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 1,
        prompt: "q1",
        response: "z1",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "t1",
        promptHash: "1".repeat(64),
        responseHash: "2".repeat(64),
        timestamp: 4,
      },
      {
        scenarioId: "scenario-2",
        scenarioTitle: "Scenario 2",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 2,
        prompt: "q2",
        response: "z2",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "t2",
        promptHash: "3".repeat(64),
        responseHash: "4".repeat(64),
        timestamp: 5,
      },
    ],
  })

  const rows = buildResumePrefixRows(checkpoint)
  assert.deepEqual(rows.map((row) => row.sampleId), ["s1", "t1", "t2"])
})

test("run checkpoint schema accepts old configs without scheduler/chat-first models and new configs with them", () => {
  const oldCheckpoint = createRunCheckpoint({
    runId: "old-scheduler-default",
    config: {
      module: "both",
      modelIds: ["model-a"],
      levels: [1],
    },
  })
  delete oldCheckpoint.config.scheduler
  delete oldCheckpoint.config.chatFirstModelIds
  delete oldCheckpoint.config.resumeMode

  assert.equal(runCheckpointSchema.parse(oldCheckpoint).config.scheduler, undefined)
  assert.equal(runCheckpointSchema.parse(oldCheckpoint).config.chatFirstModelIds, undefined)
  assert.equal(runCheckpointSchema.parse(oldCheckpoint).config.resumeMode, undefined)

  const newCheckpoint = createRunCheckpoint({
    runId: "new-scheduler-config",
    config: {
      module: "both",
      modelIds: ["model-a"],
      levels: [1],
      scheduler: "level-wave",
      chatFirstModelIds: ["seed-2.0-mini"],
      resumeMode: "all",
    },
  })

  assert.equal(runCheckpointSchema.parse(newCheckpoint).config.scheduler, "level-wave")
  assert.deepEqual(runCheckpointSchema.parse(newCheckpoint).config.chatFirstModelIds, ["seed-2.0-mini"])
  assert.equal(runCheckpointSchema.parse(newCheckpoint).config.resumeMode, "all")
})

test("buildResumeRows all mode preserves failed and post-failure rows", () => {
  const checkpoint = createRunCheckpoint({
    runId: "resume-all-test",
    config: {
      module: "both",
      modelIds: ["model-a"],
      levels: [1, 2, 3],
    },
    results: [
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 1,
        prompt: "p1",
        response: "r1",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "s1",
        promptHash: "a".repeat(64),
        responseHash: "b".repeat(64),
        timestamp: 1,
      },
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 2,
        prompt: "p2",
        response: "",
        compliance: "hesitant",
        primaryComplianceLabel: "hesitant",
        score: null,
        status: "model_error",
        scorable: false,
        replicate: 1,
        sampleId: "s2",
        promptHash: "c".repeat(64),
        responseHash: "d".repeat(64),
        timestamp: 2,
      },
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 3,
        prompt: "p3",
        response: "r3",
        compliance: "compliant",
        primaryComplianceLabel: "compliant",
        score: 66,
        status: "ok",
        scorable: true,
        replicate: 1,
        sampleId: "s3",
        promptHash: "e".repeat(64),
        responseHash: "f".repeat(64),
        timestamp: 3,
      },
    ],
  })

  assert.deepEqual(buildResumeRows(checkpoint, "all").map((row) => row.sampleId), ["s1", "s2", "s3"])
  assert.deepEqual(buildResumeRows(checkpoint, "prefix").map((row) => row.sampleId), ["s1"])
})
