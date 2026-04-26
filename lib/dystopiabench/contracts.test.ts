import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createBenchmarkBundle, filterBundleModulesByReleaseTier, validateBenchmarkBundle } from "./bundles"
import { validateRunRequest } from "./contracts"
import { buildScenarioSummaries, manifestToJsonl, runMetadataToCsv } from "./exports"
import { evaluateGate } from "./gates"
import { loadScenarioModulesFromSources } from "./scenario-loader"
import type { RunManifestV2 } from "./schemas"

function makeManifest(overrides: Partial<RunManifestV2> = {}): RunManifestV2 {
  return {
    schemaVersion: 5,
    runId: "test-run",
    timestamp: 1,
    date: "2026-03-27T00:00:00.000Z",
    metadata: {
      module: "both",
      models: ["deepseek-v3.2"],
      levels: [1, 4, 5],
      totalPrompts: 3,
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
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      providerPrecisionPolicy: "default",
      replicates: 2,
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
      drfr: 33,
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
      scoreStdDev: 10,
      minScore: 0,
      maxScore: 33,
    },
    results: [
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario",
        scenarioCategory: "Surveillance",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 1,
        prompt: "Prompt 1",
        response: "Response 1",
        compliance: "compliant",
        score: 66,
        status: "ok",
        scorable: true,
        replicate: 1,
        timestamp: 1,
      },
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario",
        scenarioCategory: "Surveillance",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 4,
        prompt: "Prompt 4",
        response: "Response 4",
        compliance: "refusal",
        score: 0,
        status: "ok",
        scorable: true,
        replicate: 1,
        timestamp: 2,
      },
      {
        scenarioId: "petrov-001",
        scenarioTitle: "Scenario",
        scenarioCategory: "Surveillance",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 5,
        prompt: "Prompt 5",
        response: "Response 5",
        compliance: "hesitant",
        score: 33,
        status: "ok",
        scorable: true,
        replicate: 2,
        timestamp: 3,
      },
    ],
    ...overrides,
  }
}

test("createBenchmarkBundle creates a pin-able bundle identifier", () => {
  const bundle = createBenchmarkBundle()
  assert.equal(bundle.benchmarkBundleId, "dystopiabench-core@1.0.0")
  assert.equal(bundle.datasetBundleVersion, "dystopiabench-core@1.0.0")
  assert.equal(validateBenchmarkBundle(bundle).benchmarkBundleId, bundle.benchmarkBundleId)
})

test("createBenchmarkBundle derives non-public release tiers from included modules", () => {
  const bundle = createBenchmarkBundle({
    modules: [
      {
        id: "lab/holdout" as never,
        label: "Holdout",
        description: "Holdout module",
        provenance: { sourceType: "local", releaseTier: "holdout" },
        scenarios: [
          {
            id: "lab/holdout-001",
            module: "lab/holdout" as never,
            title: "Holdout Scenario",
            category: "test",
            description: "desc",
            provenance: { sourceType: "local", releaseTier: "holdout" },
            escalationPrompts: [
              { level: 1, label: "L1", prompt: "a" },
              { level: 2, label: "L2", prompt: "b" },
              { level: 3, label: "L3", prompt: "c" },
              { level: 4, label: "L4", prompt: "d" },
              { level: 5, label: "L5", prompt: "e" },
            ],
          },
        ],
      },
    ],
  })

  assert.equal(bundle.releaseTier, "holdout")
})

test("filterBundleModulesByReleaseTier excludes holdout-only modules", () => {
  const filtered = filterBundleModulesByReleaseTier(
    [
      {
        id: "core/petrov" as never,
        label: "Core",
        description: "Core module",
        provenance: { sourceType: "core", releaseTier: "core-public" },
        scenarios: [
          {
            id: "core/petrov-001",
            module: "core/petrov" as never,
            title: "Core Scenario",
            category: "test",
            description: "desc",
            provenance: { sourceType: "core", releaseTier: "core-public" },
            escalationPrompts: [
              { level: 1, label: "L1", prompt: "a" },
              { level: 2, label: "L2", prompt: "b" },
              { level: 3, label: "L3", prompt: "c" },
              { level: 4, label: "L4", prompt: "d" },
              { level: 5, label: "L5", prompt: "e" },
            ],
          },
        ],
      },
      {
        id: "lab/holdout" as never,
        label: "Holdout",
        description: "Holdout module",
        provenance: { sourceType: "local", releaseTier: "holdout" },
        scenarios: [
          {
            id: "lab/holdout-001",
            module: "lab/holdout" as never,
            title: "Holdout Scenario",
            category: "test",
            description: "desc",
            provenance: { sourceType: "local", releaseTier: "holdout" },
            escalationPrompts: [
              { level: 1, label: "L1", prompt: "a" },
              { level: 2, label: "L2", prompt: "b" },
              { level: 3, label: "L3", prompt: "c" },
              { level: 4, label: "L4", prompt: "d" },
              { level: 5, label: "L5", prompt: "e" },
            ],
          },
        ],
      },
    ],
    new Set(["core-public"]),
  )

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "core/petrov")
})

test("validateBenchmarkBundle rejects public bundles that contain holdout content", () => {
  const bundle = createBenchmarkBundle({
    releaseTier: "core-public",
    modules: [
      {
        id: "lab/holdout" as never,
        label: "Holdout",
        description: "Holdout module",
        provenance: { sourceType: "local", releaseTier: "holdout" },
        scenarios: [
          {
            id: "lab/holdout-001",
            module: "lab/holdout" as never,
            title: "Holdout Scenario",
            category: "test",
            description: "desc",
            provenance: { sourceType: "local", releaseTier: "holdout" },
            escalationPrompts: [
              { level: 1, label: "L1", prompt: "a" },
              { level: 2, label: "L2", prompt: "b" },
              { level: 3, label: "L3", prompt: "c" },
              { level: 4, label: "L4", prompt: "d" },
              { level: 5, label: "L5", prompt: "e" },
            ],
          },
        ],
      },
    ],
  })

  assert.throws(
    () => validateBenchmarkBundle({ ...bundle, releaseTier: "core-public" }),
    /marked core-public but contains non-public content/
  )
})

test("validateBenchmarkBundle rejects stale scenario catalog versions", () => {
  const bundle = createBenchmarkBundle()

  assert.throws(
    () => validateBenchmarkBundle({ ...bundle, scenarioCatalogVersion: "stale-catalog" }),
    /Scenario catalog version mismatch/
  )
})

test("validateRunRequest accepts experiment metadata and scenario sources", () => {
  const request = validateRunRequest({
    modelIds: ["deepseek-v3.2"],
    experimentId: "eval-2026-03",
    scenarioSources: [{ source: "core", namespace: "partner" }],
  })

  assert.equal(request.experimentId, "eval-2026-03")
  assert.deepEqual(request.scenarioSources, [{ source: "core", namespace: "partner" }])
})

test("loadScenarioModulesFromSources resolves npm-prefixed scenario bundles", async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "dystopiabench-npm-source-"))
  const packageRoot = join(fixtureRoot, "node_modules", "@lab", "scenario-pack")
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({ name: "@lab/scenario-pack", version: "1.0.0" }, null, 2),
    "utf-8",
  )
  writeFileSync(
    join(packageRoot, "bundle.json"),
    JSON.stringify({
      id: "biosecurity",
      label: "Biosecurity",
      description: "Biosecurity module",
      scenarios: [
        {
          id: "bio-001",
          title: "Escalation",
          category: "test",
          description: "desc",
          escalationPrompts: [
            { level: 1, label: "L1", prompt: "a" },
            { level: 2, label: "L2", prompt: "b" },
            { level: 3, label: "L3", prompt: "c" },
            { level: 4, label: "L4", prompt: "d" },
            { level: 5, label: "L5", prompt: "e" },
          ],
        },
      ],
    }, null, 2),
    "utf-8",
  )

  const modules = await loadScenarioModulesFromSources(
    ["npm:@lab/scenario-pack/bundle.json"],
    fixtureRoot,
  )

  assert.equal(modules.length, 1)
  assert.equal(modules[0].provenance?.sourceType, "npm")
  assert.equal(modules[0].scenarios[0].provenance?.sourceType, "npm")
})

test("buildScenarioSummaries and exports produce lab-friendly aggregates", () => {
  const manifest = makeManifest()
  const summaries = buildScenarioSummaries(manifest.results)
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].scenarioId, "petrov-001")
  assert.match(manifestToJsonl(manifest), /"scenarioId":"petrov-001"/)
  assert.match(runMetadataToCsv(manifest), /benchmarkBundleId/)
})

test("evaluateGate fails when a run regresses past configured thresholds", () => {
  const manifest = makeManifest()
  const baseline = makeManifest({
    summary: {
      ...makeManifest().summary,
      averageDcs: 10,
    },
  })

  const evaluation = evaluateGate(
    manifest,
    {
      name: "release",
      baselineRunId: "baseline",
      assertions: {
        maxOverallDcs: 20,
        maxScoreIncreaseVsBaseline: 5,
        minRefusalRateL4L5: 80,
      },
    },
    baseline,
  )

  assert.equal(evaluation.passed, false)
  assert.ok(evaluation.findings.length >= 2)
})
