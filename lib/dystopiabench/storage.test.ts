import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { RunManifestV2 } from "./schemas"
import { dashboardChartPayloadSchema } from "./schemas"
import { publishLatest, writeRunManifest } from "./storage"

function makeManifest(runId: string, timestamp: number, mode: "stateful" | "stateless"): RunManifestV2 {
  return {
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
      },
      judgeModel: "google/gemini-3-flash-preview",
      judgeModels: ["google/gemini-3-flash-preview"],
      judgeStrategy: "single",
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
      artifactPolicy: {
        visibility: "public",
        publishTargets: ["public-dashboard", "exports"],
      },
      transportPolicy: "chat-first-fallback",
      conversationMode: mode,
      providerPrecisionPolicy: "default",
      generationConfig: {
        model: { temperature: 0, topP: 1 },
        judge: { temperature: 0, topP: 1 },
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
        scenarioId: "petrov-01",
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
    assert.equal(existsSync(join(dataDir, "benchmark-results.json")), false)
    assert.equal(existsSync(join(dataDir, "benchmark-results-stateful.json")), true)
    assert.equal(existsSync(join(dataDir, "benchmark-results-stateful.chart.json")), true)
    assert.equal(existsSync(join(dataDir, "runs.json")), true)

    const chartPayload = dashboardChartPayloadSchema.parse(
      JSON.parse(readFileSync(join(dataDir, "benchmark-results-stateful.chart.json"), "utf-8")),
    )
    assert.equal(chartPayload.runId, "run-a")
    assert.equal(chartPayload.results.length, 1)

    const leftoverTempFiles = readdirSync(dataDir).filter((file) => file.includes(".tmp"))
    assert.deepEqual(leftoverTempFiles, [])
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("writeRunManifest can persist a public-safe run into a private artifact subfolder", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const manifest = makeManifest("fable-run", Date.UTC(2026, 2, 23, 10, 0, 0), "stateful")
    const written = writeRunManifest(manifest, { privateArtifactDir: "fable-5" })

    assert.equal(written.relativeRunPath, join("artifacts", "private", "fable-5", "benchmark-fable-run.json"))
    assert.equal(existsSync(join(tempRoot, "artifacts", "private", "fable-5", "benchmark-fable-run.json")), true)
    assert.equal(existsSync(join(tempRoot, "public", "data", "benchmark-fable-run.json")), false)
    assert.equal(manifest.metadata.artifactPolicy?.visibility, "private")
    assert.deepEqual(manifest.metadata.artifactPolicy?.publishTargets, ["private-artifacts", "exports"])
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
    const statefulLatest = JSON.parse(
      readFileSync(join(dataDir, "benchmark-results-stateful.json"), "utf-8")
    ) as RunManifestV2
    const statelessLatest = JSON.parse(
      readFileSync(join(dataDir, "benchmark-results-stateless.json"), "utf-8")
    ) as RunManifestV2
    const runsIndex = JSON.parse(readFileSync(join(dataDir, "runs.json"), "utf-8")) as Array<{ id: string }>

    assert.equal(statefulLatest.runId, "run-a")
    assert.equal(statelessLatest.runId, "run-b")
    assert.equal(existsSync(join(dataDir, "benchmark-results-stateful.chart.json")), true)
    assert.equal(existsSync(join(dataDir, "benchmark-results-stateless.chart.json")), true)
    assert.deepEqual(runsIndex.map((item) => item.id), ["run-b", "run-a"])
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("publishLatest blocks private artifact runs", () => {
  const originalCwd = process.cwd()
  const tempRoot = mkdtempSync(join(tmpdir(), "dystopiabench-storage-"))
  process.chdir(tempRoot)

  try {
    const manifest = makeManifest("run-private", Date.UTC(2026, 2, 23, 12, 0, 0), "stateful")
    manifest.metadata.benchmarkDefinition = {
      benchmarkId: "acme-private",
      benchmarkBundleId: "acme-private@1.0.0",
      benchmarkBundleVersion: "1.0.0",
      datasetBundleVersion: "acme-private@1.0.0",
      scenarioCatalogVersion: "catalog",
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
    }
    manifest.metadata.artifactPolicy = {
      visibility: "private",
      publishTargets: ["private-artifacts", "exports"],
    }

    writeRunManifest(manifest)
    assert.throws(() => publishLatest(manifest), /Refusing to publish private artifact/)
    assert.equal(existsSync(join(tempRoot, "public", "data", "benchmark-results-stateful.json")), false)
    assert.equal(existsSync(join(tempRoot, "artifacts", "private", "runs", "benchmark-run-private.json")), true)
  } finally {
    process.chdir(originalCwd)
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
