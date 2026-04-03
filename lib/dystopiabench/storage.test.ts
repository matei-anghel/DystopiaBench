import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { RunManifestV2 } from "./schemas"
import { publishLatest, writeRunManifest } from "./storage"

function makeManifest(runId: string, timestamp: number, mode: "stateful" | "stateless"): RunManifestV2 {
  return {
    schemaVersion: 6,
    runId,
    timestamp,
    date: new Date(timestamp).toISOString(),
    metadata: {
      module: "both",
      models: ["gpt-5.3-codex"],
      levels: [1],
      totalPrompts: 1,
      benchmarkDefinition: {
        benchmarkId: "dystopiabench-core",
        benchmarkBundleId: "dystopiabench-core@1.0.0",
        benchmarkBundleVersion: "1.0.0",
        datasetBundleVersion: "dystopiabench-core@1.0.0",
        scenarioCatalogVersion: "catalog",
        systemPromptVersion: "v5",
        benchmarkPromptVersion: "v6",
        judgePromptVersion: "v6",
        releaseTier: "core-public",
        splitSummary: { "public-core": 1 },
        publicSafe: true,
      },
      judgeModel: "google/gemini-3-flash-preview",
      judgeModels: ["google/gemini-3-flash-preview"],
      judgeStrategy: "single",
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
      artifactPolicy: {
        visibility: "public",
        publicSafe: true,
        publishTargets: ["public-dashboard", "exports"],
      },
      transportPolicy: "chat-first-fallback",
      conversationMode: mode,
      providerPrecisionPolicy: "default",
      splitSummary: { "public-core": 1 },
      generationConfig: {
        model: { temperature: 0, topP: 1, maxOutputTokens: 1500 },
        judge: { temperature: 0, topP: 1, maxOutputTokens: 220 },
        retryPolicy: { maxRetries: 2, backoffBaseMs: 1000, backoffJitterMs: 1000 },
        timeoutMs: 90000,
      },
    },
    summary: {
      totalPrompts: 1,
      scoredPrompts: 1,
      averageDcs: 0,
      drfr: 100,
      statusCounts: {
        ok: 1,
        model_error: 0,
        judge_error: 0,
        aborted: 0,
        invalid_response: 0,
      },
      modelSuccessRate: 100,
      judgeSuccessRate: 100,
      scorableRate: 100,
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
        modelId: "gpt-5.3-codex",
        modelLabel: "GPT 5.3 Codex",
        provider: "OpenAI",
        modelString: "openai/gpt-5.3-codex",
        level: 1,
        prompt: "Prompt",
        response: "Refusal",
        compliance: "refusal",
        primaryComplianceLabel: "refusal",
        score: 0,
        status: "ok",
        severity: "none",
        operationalityFlag: false,
        targetHarmMechanisms: [],
        safeAlternativeHelpfulnessFlag: false,
        manipulationOrEvasionFlag: false,
        confidence: 1,
        adjudicationSource: "single-judge",
        scorable: true,
        conversationContinuity: "intact",
        scenarioSplit: "public-core",
        scenarioSensitivityTier: "public",
        sampleId: `${runId}-sample`,
        attemptId: `${runId}-attempt`,
        promptHash: "a".repeat(64),
        responseHash: "b".repeat(64),
        judgePanelConfigSnapshot: {
          judgeStrategy: "single",
          judgeModels: ["google/gemini-3-flash-preview"],
          judgePromptVersion: "v6",
        },
        timestamp,
      },
    ],
  }
}

test("writeRunManifest and publishLatest persist manifests without leaving temp files behind", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const manifest = makeManifest("run-a", Date.UTC(2026, 2, 23, 10, 0, 0), "stateful")
    writeRunManifest(manifest)
    publishLatest(manifest)

    const dataDir = join(tempRoot, "public", "data")
    assert.equal(existsSync(join(dataDir, "benchmark-run-a.json")), true)
    assert.equal(existsSync(join(dataDir, "benchmark-results.json")), true)
    assert.equal(existsSync(join(dataDir, "benchmark-results-stateful.json")), true)
    assert.equal(existsSync(join(dataDir, "runs.json")), true)
    assert.equal(existsSync(join(dataDir, "eval-cards", "eval-card-run-a.json")), true)

    const leftoverTempFiles = readdirSync(dataDir).filter((file) => file.includes(".tmp"))
    assert.deepEqual(leftoverTempFiles, [])
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("publishLatest updates the latest aliases and run index atomically across multiple runs", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const firstManifest = makeManifest("run-a", Date.UTC(2026, 2, 23, 10, 0, 0), "stateful")
    const secondManifest = makeManifest("run-b", Date.UTC(2026, 2, 23, 11, 0, 0), "stateless")

    writeRunManifest(firstManifest)
    writeRunManifest(secondManifest)
    publishLatest(firstManifest)
    publishLatest(secondManifest)

    const dataDir = join(tempRoot, "public", "data")
    const latestManifest = JSON.parse(readFileSync(join(dataDir, "benchmark-results.json"), "utf-8")) as RunManifestV2
    const statelessLatest = JSON.parse(
      readFileSync(join(dataDir, "benchmark-results-stateless.json"), "utf-8")
    ) as RunManifestV2
    const runsIndex = JSON.parse(readFileSync(join(dataDir, "runs.json"), "utf-8")) as Array<{ id: string }>

    assert.equal(latestManifest.runId, "run-b")
    assert.equal(statelessLatest.runId, "run-b")
    assert.deepEqual(runsIndex.map((item) => item.id), ["run-b", "run-a"])
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("publishLatest blocks non-public benchmark runs unless explicitly public-safe", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const manifest = makeManifest("run-private", Date.UTC(2026, 2, 23, 12, 0, 0), "stateful")
    manifest.metadata.benchmarkDefinition = {
      benchmarkId: "acme-holdout",
      benchmarkBundleId: "acme-holdout@1.0.0",
      benchmarkBundleVersion: "1.0.0",
      datasetBundleVersion: "acme-holdout@1.0.0",
      scenarioCatalogVersion: "catalog",
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
      releaseTier: "holdout",
      splitSummary: { "private-holdout": 1 },
      publicSafe: false,
    }
    manifest.metadata.artifactPolicy = {
      visibility: "private",
      publicSafe: false,
      publishTargets: ["private-artifacts", "exports"],
      publicPublishBlockedReason: "Artifact contains holdout content.",
    }
    manifest.results[0].scenarioSplit = "private-holdout"
    manifest.results[0].scenarioSensitivityTier = "restricted"

    writeRunManifest(manifest)
    assert.throws(() => publishLatest(manifest), /Refusing to publish non-public benchmark content/)
    assert.throws(
      () => publishLatest(manifest, { allowNonPublicPublish: true }),
      /not explicitly marked public-safe/
    )
    assert.equal(existsSync(join(tempRoot, "public", "data", "benchmark-results.json")), false)
    assert.equal(existsSync(join(tempRoot, "artifacts", "private", "runs", "benchmark-run-private.json")), true)
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("writeRunManifest stores trace-bearing runs in private artifacts by default", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const manifest = makeManifest("run-trace", Date.UTC(2026, 2, 23, 13, 0, 0), "stateful")
    manifest.results[0].reasoningTraceText = "This looks like a safety evaluation."
    manifest.results[0].traceAvailability = "summary"
    manifest.results[0].traceCaptureSource = "ai-sdk-reasoning"

    writeRunManifest(manifest)

    assert.equal(existsSync(join(tempRoot, "artifacts", "private", "runs", "benchmark-run-trace.json")), true)
    assert.equal(existsSync(join(tempRoot, "public", "data", "benchmark-run-trace.json")), false)
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
