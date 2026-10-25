import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"
import {
  ALL_MODULES,
  ALL_SCENARIOS,
  SCENARIO_CATALOG_VERSION,
  SCENARIOS_BY_ID,
} from "../lib/dystopiabench/scenarios"
import {
  GENERATION_CONFIG,
  runManifestV2Schema,
  type BenchmarkResultV2,
  type ConversationMode,
  type ProviderPrecisionPolicy,
  type RunManifestV2,
  type RunMetadataV2,
} from "../lib/dystopiabench/schemas"
import { summarizeResults } from "../lib/dystopiabench/runner"
import {
  getDataDir,
  makeRunId,
  publishLatest,
  sanitizeRunId,
  writeRunManifest,
} from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (arg) {
    return arg.slice(prefix.length)
  }

  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }

  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getRequiredArg(flag: string): string {
  const value = parseArg(flag)?.trim()
  if (!value) {
    throw new Error(`Missing ${flag}.`)
  }
  return value
}

function parseRetainRuns(input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid --retain value. Use a non-negative integer.")
  }
  return value
}

function parseArchiveDir(input: string | undefined): string | undefined {
  if (!input) return undefined
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Invalid --archive-dir value. Provide a non-empty relative folder name.")
  }
  if (trimmed.includes("..") || trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    throw new Error("Invalid --archive-dir value. Use a relative folder under public/data.")
  }
  return trimmed
}

function loadManifest(runId: string): RunManifestV2 {
  const dataDir = getDataDir()
  const path = join(dataDir, `benchmark-${sanitizeRunId(runId)}.json`)
  const gzipPath = `${path}.gz`

  if (!existsSync(path) && !existsSync(gzipPath)) {
    throw new Error(`Run file not found: ${path}`)
  }

  const contents = existsSync(path) ? readFileSync(path, "utf8") : gunzipSync(readFileSync(gzipPath)).toString("utf8")
  const raw = JSON.parse(contents) as unknown
  const parsed = runManifestV2Schema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Run file is not a valid benchmark manifest: ${path}`)
  }

  return parsed.data
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function normalizeConversationMode(metadata: RunMetadataV2): ConversationMode {
  return metadata.conversationMode === "stateless" ? "stateless" : "stateful"
}

function normalizeJudgeStrategy(metadata: RunMetadataV2): NonNullable<RunMetadataV2["judgeStrategy"]> {
  return metadata.judgeStrategy ?? "single"
}

function normalizeJudgeModels(metadata: RunMetadataV2): string[] {
  const explicit = metadata.judgeModels ?? []
  const fallback = metadata.judgeModel ? [metadata.judgeModel] : []
  return unique([...explicit, ...fallback])
}

function normalizeProviderPrecisionPolicy(
  metadata: RunMetadataV2,
): ProviderPrecisionPolicy {
  return metadata.providerPrecisionPolicy ?? "default"
}

function normalizeGenerationConfig(metadata: RunMetadataV2) {
  const config = metadata.generationConfig ?? GENERATION_CONFIG
  return {
    model: {
      temperature: config.model.temperature,
      topP: config.model.topP,
    },
    judge: {
      temperature: config.judge.temperature,
      topP: config.judge.topP,
    },
  }
}

function assertEqual(label: string, left: unknown, right: unknown) {
  if (stableStringify(left) !== stableStringify(right)) {
    throw new Error(`${label} mismatch between base and patch runs.`)
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right)
}

const JUDGE_PANEL_CHANGE_NOTE =
  "Judge panel changed for appended model rows because the previous judge models were flaky through the OpenRouter API."

function mergePurposeWithJudgePanelNote(basePurpose?: string, patchPurpose?: string): string {
  return unique(
    [basePurpose, patchPurpose, JUDGE_PANEL_CHANGE_NOTE]
      .filter((value): value is string => Boolean(value?.trim())),
  ).join(" ")
}

function mergeCapabilities(
  base: RunMetadataV2["modelCapabilitiesSnapshot"],
  patch: RunMetadataV2["modelCapabilitiesSnapshot"],
): RunMetadataV2["modelCapabilitiesSnapshot"] {
  return {
    ...(base ?? {}),
    ...(patch ?? {}),
  }
}

function resultKey(result: Pick<BenchmarkResultV2, "scenarioId" | "modelId" | "level" | "replicate" | "sampleId">): string {
  return result.sampleId ?? `${result.scenarioId}::${result.modelId}::${result.level}::r${result.replicate ?? 1}`
}

function getScenarioOrder(scenarioId: string): number {
  const index = ALL_SCENARIOS.findIndex((scenario) => scenario.id === scenarioId)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function getModelOrder(models: string[], modelId: string): number {
  const index = models.indexOf(modelId)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function sortResults(results: BenchmarkResultV2[], modelOrder: string[]): BenchmarkResultV2[] {
  return [...results].sort((left, right) => {
    const scenarioDiff = getScenarioOrder(left.scenarioId) - getScenarioOrder(right.scenarioId)
    if (scenarioDiff !== 0) return scenarioDiff

    const modelDiff =
      getModelOrder(modelOrder, left.modelId) - getModelOrder(modelOrder, right.modelId)
    if (modelDiff !== 0) return modelDiff

    const levelDiff = left.level - right.level
    if (levelDiff !== 0) return levelDiff

    const replicateDiff = (left.replicate ?? 1) - (right.replicate ?? 1)
    if (replicateDiff !== 0) return replicateDiff

    return left.timestamp - right.timestamp
  })
}

export interface MergeRunManifestsOptions {
  runId: string
  allowAdditiveModels?: boolean
  now?: Date
}

function normalizeScenarioCatalogVersion(metadata: RunMetadataV2): string | undefined {
  return metadata.scenarioCatalogVersion ?? metadata.benchmarkDefinition?.scenarioCatalogVersion
}

function assertNoOverlappingResultKeys(base: RunManifestV2, patch: RunManifestV2): void {
  const baseKeys = new Set(base.results.map(resultKey))
  const overlappingKeys = patch.results
    .map(resultKey)
    .filter((key) => baseKeys.has(key))

  if (overlappingKeys.length > 0) {
    throw new Error(
      `Patch run overlaps ${overlappingKeys.length} existing result key(s). ` +
      "Additive model merge only supports new model rows."
    )
  }
}

export function mergeRunManifests(
  base: RunManifestV2,
  patch: RunManifestV2,
  options: MergeRunManifestsOptions,
): RunManifestV2 {
  const baseMode = normalizeConversationMode(base.metadata)
  const patchMode = normalizeConversationMode(patch.metadata)
  assertEqual("conversationMode", baseMode, patchMode)
  if (baseMode !== "stateful") {
    throw new Error("This merge utility is intended for stateful escalation runs.")
  }

  const baseJudgeStrategy = normalizeJudgeStrategy(base.metadata)
  const patchJudgeStrategy = normalizeJudgeStrategy(patch.metadata)
  const baseJudgeModels = normalizeJudgeModels(base.metadata)
  const patchJudgeModels = normalizeJudgeModels(patch.metadata)
  const judgePanelChanged =
    !valuesEqual(baseJudgeStrategy, patchJudgeStrategy) ||
    !valuesEqual(base.metadata.judgeModel, patch.metadata.judgeModel) ||
    !valuesEqual(baseJudgeModels, patchJudgeModels) ||
    !valuesEqual(base.metadata.judgeTieBreakerModel, patch.metadata.judgeTieBreakerModel)

  if (!options.allowAdditiveModels || !judgePanelChanged) {
    assertEqual("judgeStrategy", baseJudgeStrategy, patchJudgeStrategy)
    assertEqual("judgeModel", base.metadata.judgeModel, patch.metadata.judgeModel)
    assertEqual("judgeModels", baseJudgeModels, patchJudgeModels)
    assertEqual("judgeTieBreakerModel", base.metadata.judgeTieBreakerModel, patch.metadata.judgeTieBreakerModel)
  }
  assertEqual("systemPromptVersion", base.metadata.systemPromptVersion, patch.metadata.systemPromptVersion)
  assertEqual("benchmarkPromptVersion", base.metadata.benchmarkPromptVersion, patch.metadata.benchmarkPromptVersion)
  assertEqual("judgePromptVersion", base.metadata.judgePromptVersion, patch.metadata.judgePromptVersion)
  assertEqual("levels", unique(base.metadata.levels).sort(), unique(patch.metadata.levels).sort())
  assertEqual(
    "scenarioCatalogVersion",
    normalizeScenarioCatalogVersion(base.metadata),
    normalizeScenarioCatalogVersion(patch.metadata),
  )
  assertEqual(
    "providerPrecisionPolicy",
    normalizeProviderPrecisionPolicy(base.metadata),
    normalizeProviderPrecisionPolicy(patch.metadata),
  )
  assertEqual(
    "generationConfig",
    normalizeGenerationConfig(base.metadata),
    normalizeGenerationConfig(patch.metadata),
  )

  const baseModels = unique(base.metadata.models)
  const patchModels = unique(patch.metadata.models)
  if (options.allowAdditiveModels) {
    assertNoOverlappingResultKeys(base, patch)
  } else {
    assertEqual("models", baseModels, patchModels)
  }

  const mergedResultsByKey = new Map<string, BenchmarkResultV2>()
  for (const result of base.results) {
    mergedResultsByKey.set(resultKey(result), result)
  }
  for (const result of patch.results) {
    mergedResultsByKey.set(resultKey(result), result)
  }

  const mergedModels = unique([...baseModels, ...patchModels])
  const mergedResults = sortResults([...mergedResultsByKey.values()], mergedModels)

  const selectedScenarioIds = ALL_SCENARIOS
    .map((scenario) => scenario.id)
    .filter((scenarioId) => mergedResults.some((result) => result.scenarioId === scenarioId))
  const extraScenarioIds = unique(mergedResults.map((result) => result.scenarioId))
    .filter((scenarioId) => !selectedScenarioIds.includes(scenarioId))
    .sort()
  const allSelectedScenarioIds = [...selectedScenarioIds, ...extraScenarioIds]

  const scenarioModuleIds: string[] = ALL_MODULES
    .map((module) => module.id)
    .filter((moduleId) =>
      allSelectedScenarioIds.some((scenarioId) => SCENARIOS_BY_ID.get(scenarioId)?.module === moduleId),
    )
  const extraModuleIds = unique(mergedResults.map((result) => String(result.module)))
    .filter((moduleId) => !scenarioModuleIds.includes(moduleId))
    .sort((left, right) => String(left).localeCompare(String(right)))

  const mergedMetadata: RunMetadataV2 = {
    module: scenarioModuleIds.length === 1 ? scenarioModuleIds[0] : "both",
    models: mergedModels,
    levels: unique([...base.metadata.levels, ...patch.metadata.levels]).sort((a, b) => a - b),
    totalPrompts: mergedResults.length,
    scenarioCatalogVersion:
      base.metadata.scenarioCatalogVersion === patch.metadata.scenarioCatalogVersion
        ? (base.metadata.scenarioCatalogVersion ?? SCENARIO_CATALOG_VERSION)
        : SCENARIO_CATALOG_VERSION,
    scenarioModuleIds: [...scenarioModuleIds, ...extraModuleIds],
    selectedScenarioIds: allSelectedScenarioIds,
    selectedScenarioCount: allSelectedScenarioIds.length,
    judgeModel: base.metadata.judgeModel,
    judgeModels: judgePanelChanged ? unique([...baseJudgeModels, ...patchJudgeModels]) : baseJudgeModels,
    judgeStrategy: judgePanelChanged ? "pair-with-tiebreak" : baseJudgeStrategy,
    judgeTieBreakerModel: base.metadata.judgeTieBreakerModel ?? patch.metadata.judgeTieBreakerModel,
    systemPromptVersion: base.metadata.systemPromptVersion,
    benchmarkPromptVersion: base.metadata.benchmarkPromptVersion,
    judgePromptVersion: base.metadata.judgePromptVersion,
    transportPolicy: base.metadata.transportPolicy,
    conversationMode: baseMode,
    providerPrecisionPolicy: base.metadata.providerPrecisionPolicy,
    purpose: judgePanelChanged
      ? mergePurposeWithJudgePanelNote(base.metadata.purpose, patch.metadata.purpose)
      : base.metadata.purpose ?? patch.metadata.purpose,
    modelCapabilitiesSnapshot: mergeCapabilities(
      base.metadata.modelCapabilitiesSnapshot,
      patch.metadata.modelCapabilitiesSnapshot,
    ),
    generationConfig: base.metadata.generationConfig ?? patch.metadata.generationConfig ?? GENERATION_CONFIG,
  }

  const now = options.now ?? new Date()
  const mergedManifest: RunManifestV2 = {
    runId: options.runId,
    timestamp: now.getTime(),
    date: now.toISOString(),
    metadata: mergedMetadata,
    summary: summarizeResults(mergedResults),
    results: mergedResults,
  }

  return mergedManifest
}

function main() {
  const baseRunId = sanitizeRunId(getRequiredArg("--base-run-id"))
  const patchRunId = sanitizeRunId(getRequiredArg("--patch-run-id"))
  const runId = sanitizeRunId(parseArg("--run-id") ?? `merge-${makeRunId()}`)
  const publish = hasFlag("--publish")
  const allowAdditiveModels = hasFlag("--allow-additive-models")
  const retainRuns = parseRetainRuns(parseArg("--retain"))
  const archiveDir = parseArchiveDir(parseArg("--archive-dir"))

  if (!publish && (retainRuns !== undefined || archiveDir !== undefined)) {
    throw new Error("--retain and --archive-dir require --publish.")
  }

  const base = loadManifest(baseRunId)
  const patch = loadManifest(patchRunId)
  const mergedManifest = mergeRunManifests(base, patch, { runId, allowAdditiveModels })

  writeRunManifest(mergedManifest)
  console.log(`Wrote merged run: public/data/benchmark-${runId}.json`)
  console.log(`Base run: ${baseRunId}`)
  console.log(`Patch run: ${patchRunId}`)
  console.log(`Merged prompts: ${mergedManifest.summary.totalPrompts}`)
  console.log(`Merged modules: ${(mergedManifest.metadata.scenarioModuleIds ?? []).join(", ")}`)

  if (publish) {
    publishLatest(mergedManifest, { retainRuns, archiveDir })
    console.log(`Published merged run ${runId}`)
    console.log("Updated public/data/benchmark-results-stateful.json")
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
