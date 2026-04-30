import assert from "node:assert/strict"
import test from "node:test"
import type { RunManifestV2 } from "./schemas"
import {
  archiveOpenRouterTracesForManifest,
  collectOpenRouterArchiveTargets,
} from "./openrouter-trace-archive"

function makeManifest(): RunManifestV2 {
  return {
    schemaVersion: 8,
    runId: "trace-run",
    timestamp: Date.UTC(2026, 3, 30, 12, 0, 0),
    date: "2026-04-30T12:00:00.000Z",
    metadata: {
      module: "both",
      models: ["openrouter:model-a"],
      levels: [1],
      totalPrompts: 3,
      judgeModel: "judge-a",
      judgeModels: ["judge-a"],
      judgeStrategy: "single",
      systemPromptVersion: "v1",
      benchmarkPromptVersion: "v1",
      judgePromptVersion: "v1",
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
      averageDcs: 33,
      drfr: 33,
      statusCounts: {
        ok: 3,
        model_error: 0,
        judge_error: 0,
        aborted: 0,
        invalid_response: 0,
      },
      judgeAgreement: {
        judgeCount: 1,
        exactAgreementRate: 100,
      },
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
        prompt: "Prompt A",
        response: "Response A",
        compliance: "hesitant",
        primaryComplianceLabel: "hesitant",
        score: 33,
        status: "ok",
        scorable: true,
        promptHash: "a".repeat(64),
        responseHash: "b".repeat(64),
        timestamp: 1,
        providerMetadata: {
          openrouter: {
            generationId: "gen-1",
            requestId: "req-1",
            responseId: "gen-1",
            sessionId: "sess-1",
          },
        },
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
        prompt: "Prompt B",
        response: "Response B",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        promptHash: "c".repeat(64),
        responseHash: "d".repeat(64),
        timestamp: 2,
        providerMetadata: {
          openrouter: {
            responseId: "gen-2",
          },
        },
      },
      {
        scenarioId: "scenario-3",
        scenarioTitle: "Scenario 3",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "model-a",
        modelLabel: "Model A",
        provider: "OpenRouter",
        modelString: "vendor/model-a",
        level: 1,
        prompt: "Prompt C",
        response: "Response C",
        compliance: "compliant",
        primaryComplianceLabel: "compliant",
        score: 66,
        status: "ok",
        scorable: true,
        promptHash: "e".repeat(64),
        responseHash: "f".repeat(64),
        timestamp: 3,
        providerMetadata: {
          openrouter: {
            requestId: "req-missing",
          },
        },
      },
    ],
  }
}

test("collectOpenRouterArchiveTargets groups rows by generation id and tracks missing ids", () => {
  const manifest = makeManifest()
  const collection = collectOpenRouterArchiveTargets(manifest)

  assert.equal(collection.openrouterRowCount, 3)
  assert.equal(collection.rowsMissingGenerationId, 1)
  assert.deepEqual(collection.targets.map((target) => target.generationId), ["gen-1", "gen-2"])
  assert.equal(collection.targets[0].rows[0].prompt, "Prompt A")
  assert.equal(collection.targets[1].rows[0].response, "Response B")
})

test("archiveOpenRouterTracesForManifest fetches metadata and stored content", async () => {
  const manifest = makeManifest()
  const archive = await archiveOpenRouterTracesForManifest(manifest, {
    client: {
      async getGeneration(request) {
        return {
          data: {
            id: request.id,
            model: "vendor/model-a",
            providerName: "provider-a",
          },
        }
      },
      async listGenerationContent(request) {
        return {
          data: {
            input: { prompt: `stored-${request.id}` },
            output: {
              completion: `completion-${request.id}`,
              reasoning: null,
            },
          },
        }
      },
    },
  })

  assert.equal(archive.summary.uniqueGenerationCount, 2)
  assert.equal(archive.summary.metadataRetrievedCount, 2)
  assert.equal(archive.summary.contentRetrievedCount, 2)
  assert.equal(archive.entries[0].metadataStatus, "ok")
  assert.equal(archive.entries[0].content?.output.completion, "completion-gen-1")
  assert.equal(archive.entries[1].rows[0].traceLink.responseId, "gen-2")
})
