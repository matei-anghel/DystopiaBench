import { readFileSync } from "node:fs"
import { AVAILABLE_MODELS, getModelById } from "../lib/dystopiabench/models"
import { validateScenarioLocalePack } from "../lib/dystopiabench/locale-packs"
import { DEFAULT_SOURCE_LOCALE, normalizeLocaleTag } from "../lib/dystopiabench/locales"
import { ALL_MODULES, ALL_SCENARIOS, getRegisteredModuleIds, getScenariosByModule } from "../lib/dystopiabench/scenarios"
import { createBenchmarkBundle } from "../lib/dystopiabench/bundles"
import { loadScenarioModulesFromSources } from "../lib/dystopiabench/scenario-loader"
import {
  type EvalAwarenessMode,
  runBenchmark,
  type JudgeStrategy,
  type ProviderPrecisionPolicy,
  type RunBenchmarkOptions,
  type TransportPolicy,
} from "../lib/dystopiabench/runner"
import {
  makeRunId,
  publishLatest,
  sanitizeRunId,
  writeRunManifest,
} from "../lib/dystopiabench/storage"
import { toModuleId, type BenchmarkModuleSelector } from "../lib/dystopiabench/types"

type ModuleArg = BenchmarkModuleSelector

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`

  // First look for --flag=value format
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (arg) {
    return arg.slice(prefix.length)
  }

  // If not found, look for --flag value format (separated by space)
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }

  // Also handle the edge case where pnpm weirdly passes "--levels=1 2 3 4 5"
  // If the user typed `--levels=1,2,3` but we received `--levels=1 2 3`
  const allArgsStr = process.argv.slice(2).join(' ')
  const match = [...allArgsStr.matchAll(new RegExp(`${flag}=([\\w\\d, ]+)`, 'g'))]
  if (match.length > 0 && match[0][1]) {
    // Replace spaces with commas in case the shell split strictly on comma
    return match[0][1].replace(/\s+/g, ',')
  }

  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function parseModule(input: string | undefined): ModuleArg {
  const registeredModules = new Set(getRegisteredModuleIds().map(String))
  if (!input) return "both"
  if (input === "both") return input
  if (registeredModules.has(input)) return toModuleId(input)
  throw new Error(`Invalid --module value. Use one of: ${[...registeredModules, "both"].join(", ")}.`)
}

function parseLevels(input: string | undefined): Array<1 | 2 | 3 | 4 | 5> {
  if (!input) return [1, 2, 3, 4, 5]

  const parsed = input
    .split(/[\s,]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5) as Array<
      1 | 2 | 3 | 4 | 5
    >

  if (parsed.length === 0) {
    throw new Error("Invalid --levels value. Example: --levels=1,2,3,4,5")
  }

  return Array.from(new Set(parsed)).sort() as Array<1 | 2 | 3 | 4 | 5>
}


function parseRetainRuns(input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid --retain value. Use a non-negative integer, e.g. --retain=20")
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

function normalizeModelInputList(input: string | undefined): string[] {
  if (!input) return []
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function isValidModelSpecifier(input: string): boolean {
  if (getModelById(input)) return true
  if (input.startsWith("openrouter:") || input.startsWith("local:")) return true
  return input.includes("/")
}

function parseModels(input: string | undefined): string[] {
  if (!input) return AVAILABLE_MODELS.map((model) => model.id)
  const requested = normalizeModelInputList(input)

  const invalid = requested.filter((id) => !isValidModelSpecifier(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown model id(s): ${invalid.join(", ")}`)
  }
  return requested
}

function isValidJudgeModelSpecifier(input: string): boolean {
  if (getModelById(input)) return true
  if (input.startsWith("openrouter:")) return true
  return input.includes("/")
}

function parseJudgeModels(judgeModelsArg: string | undefined, judgeModelArg: string | undefined): string[] {
  const requested = normalizeModelInputList(judgeModelsArg)
  const explicit = requested.filter(Boolean)
  const fallback = judgeModelArg ? [judgeModelArg] : []
  const combined = [...explicit, ...fallback]

  const invalid = combined.filter((id) => id && !isValidJudgeModelSpecifier(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown judge model selector(s): ${invalid.join(", ")}`)
  }

  return Array.from(new Set(combined.filter(Boolean)))
}

function parseScenarioIds(input: string | undefined): string[] | undefined {
  if (!input) return undefined

  const scenarioIds = input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)

  return scenarioIds.length > 0 ? Array.from(new Set(scenarioIds)) : undefined
}

function parseTransport(input: string | undefined): TransportPolicy {
  if (!input) return "chat-first-fallback"
  if (input === "chat-first-fallback" || input === "chat-only") return input
  throw new Error("Invalid --transport value. Use one of: chat-first-fallback, chat-only.")
}

function parseConversationMode(input: string | undefined): "stateful" | "stateless" {
  if (!input || input === "stateful") return "stateful"
  if (input === "stateless") return "stateless"
  throw new Error("Invalid --conversation-mode value. Use one of: stateful, stateless.")
}

function parseJudgeStrategy(input: string | undefined): JudgeStrategy {
  if (!input || input === "single") return "single"
  if (input === "pair-with-tiebreak") return "pair-with-tiebreak"
  throw new Error("Invalid --judge-strategy value. Use one of: single, pair-with-tiebreak.")
}

function parseProviderPrecision(input: string | undefined): ProviderPrecisionPolicy {
  if (!input || input === "default") return "default"
  if (input === "non-quantized-only") return "non-quantized-only"
  throw new Error("Invalid --provider-precision value. Use one of: default, non-quantized-only.")
}

function parseEvalAwarenessMode(input: string | undefined): EvalAwarenessMode {
  if (!input || input === "auto") return "auto"
  if (input === "off" || input === "required") return input
  throw new Error("Invalid --eval-awareness value. Use one of: off, auto, required.")
}

function parseAwarenessThreshold(input: string | undefined): RunBenchmarkOptions["awarenessThreshold"] {
  if (!input) return undefined
  if (["none", "weak", "moderate", "strong", "high"].includes(input)) {
    return input as NonNullable<RunBenchmarkOptions["awarenessThreshold"]>
  }
  throw new Error("Invalid --awareness-threshold value. Use one of: none, weak, moderate, strong, high.")
}

function parsePositiveIntFlag(flag: string, input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${flag} value. Use a positive integer.`)
  }
  return value
}

function parseNonNegativeIntFlag(flag: string, input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${flag} value. Use a non-negative integer.`)
  }
  return value
}

function parseRuntimeOverrides(): Pick<
  RunBenchmarkOptions,
  | "timeoutMs"
  | "concurrency"
  | "perModelConcurrency"
  | "maxRetries"
  | "retryBackoffBaseMs"
  | "retryBackoffJitterMs"
> {
  return {
    timeoutMs: parsePositiveIntFlag("--timeout-ms", parseArg("--timeout-ms")),
    concurrency: parsePositiveIntFlag("--concurrency", parseArg("--concurrency")),
    perModelConcurrency: parsePositiveIntFlag("--per-model-concurrency", parseArg("--per-model-concurrency")),
    maxRetries: parseNonNegativeIntFlag("--max-retries", parseArg("--max-retries")),
    retryBackoffBaseMs: parsePositiveIntFlag("--retry-backoff-base-ms", parseArg("--retry-backoff-base-ms")),
    retryBackoffJitterMs: parseNonNegativeIntFlag("--retry-backoff-jitter-ms", parseArg("--retry-backoff-jitter-ms")),
  }
}

function parseScenarioSources(input: string | undefined): string[] | undefined {
  const values = normalizeModelInputList(input)
  return values.length > 0 ? values : undefined
}

function parseLocalePack(input: string | undefined) {
  if (!input) return undefined
  return validateScenarioLocalePack(JSON.parse(readFileSync(input, "utf-8")) as unknown)
}

async function main() {
  const moduleArg = parseModule(parseArg("--module"))
  const levels = parseLevels(parseArg("--levels"))
  const models = parseModels(parseArg("--models"))
  const judgeModel = parseArg("--judge-model")
  const judgeStrategy = parseJudgeStrategy(parseArg("--judge-strategy"))
  const judgeModelsArg = parseArg("--judge-models")
  if (judgeStrategy === "pair-with-tiebreak" && judgeModelsArg) {
    throw new Error("--judge-models cannot be combined with --judge-strategy=pair-with-tiebreak.")
  }
  const judgeModels = judgeStrategy === "single" ? parseJudgeModels(judgeModelsArg, judgeModel) : undefined
  const scenarioIds = parseScenarioIds(parseArg("--scenario-ids"))
  const runId = sanitizeRunId(parseArg("--run-id") ?? makeRunId())
  const retainRuns = parseRetainRuns(parseArg("--retain"))
  const archiveDir = parseArchiveDir(parseArg("--archive-dir"))
  const transport = parseTransport(parseArg("--transport"))
  const conversationMode = parseConversationMode(parseArg("--conversation-mode"))
  const providerPrecision = parseProviderPrecision(parseArg("--provider-precision"))
  const evalAwarenessMode = parseEvalAwarenessMode(parseArg("--eval-awareness"))
  const awarenessJudgeModel = parseArg("--awareness-judge-model")
  const awarenessThreshold = parseAwarenessThreshold(parseArg("--awareness-threshold"))
  const replicates = parsePositiveIntFlag("--replicates", parseArg("--replicates")) ?? 1
  const experimentId = parseArg("--experiment-id")
  const project = parseArg("--project")
  const owner = parseArg("--owner")
  const purpose = parseArg("--purpose")
  const modelSnapshot = parseArg("--model-snapshot")
  const providerRegion = parseArg("--provider-region")
  const policyVersion = parseArg("--policy-version")
  const gitCommit = parseArg("--git-commit")
  const datasetBundleVersion = parseArg("--dataset-bundle-version")
  const benchmarkId = parseArg("--benchmark-id")
  const benchmarkBundleVersion = parseArg("--benchmark-bundle-version")
  const scenarioSources = parseScenarioSources(parseArg("--scenario-sources"))
  const sourceLocale = normalizeLocaleTag(parseArg("--source-locale") ?? DEFAULT_SOURCE_LOCALE)
  const localePack = parseLocalePack(parseArg("--locale-pack"))
  const promptLocale = normalizeLocaleTag(parseArg("--locale") ?? localePack?.targetLocale ?? sourceLocale)
  const localePreset = parseArg("--locale-preset")
  const allowNonPublicPublish = hasFlag("--allow-nonpublic-publish")
  const publishLatestAliases = !hasFlag("--no-publish-latest")
  const runtimeOverrides = parseRuntimeOverrides()

  if (localePack && promptLocale !== localePack.targetLocale) {
    throw new Error(`--locale (${promptLocale}) must match locale pack targetLocale (${localePack.targetLocale}).`)
  }

  if (!publishLatestAliases && (retainRuns !== undefined || archiveDir !== undefined)) {
    throw new Error("--retain and --archive-dir require publishing latest aliases. Remove --no-publish-latest or omit retention flags.")
  }

  console.log(`Running benchmark ${runId}`)
  console.log(`Module: ${moduleArg}`)
  console.log(`Models: ${models.join(", ")}`)
  console.log(`Levels: ${levels.join(", ")}`)
  if (scenarioIds && scenarioIds.length > 0) {
    console.log(`Scenarios: ${scenarioIds.join(", ")} (${scenarioIds.length})`)
  } else {
    const scenarioCount = moduleArg === "both" ? ALL_SCENARIOS.length : getScenariosByModule(moduleArg).length
    console.log(`Scenarios: all (${scenarioCount})`)
  }
  console.log(`Judge strategy: ${judgeStrategy}`)
  console.log(
    `Judge: ${judgeStrategy === "pair-with-tiebreak"
      ? `${judgeModel ?? "default"} + kimi-k2.5 + openai/gpt-5.4-mini`
      : judgeModels && judgeModels.length > 0
        ? judgeModels.join(", ")
        : "default"}`
  )
  console.log(`Transport: ${transport}`)
  console.log(`Conversation mode: ${conversationMode}`)
  console.log(`Provider precision: ${providerPrecision}`)
  console.log(`Eval awareness: ${evalAwarenessMode}`)
  if (awarenessJudgeModel) console.log(`Awareness judge: ${awarenessJudgeModel}`)
  if (awarenessThreshold) console.log(`Awareness threshold: ${awarenessThreshold}`)
  console.log(`Prompt locale: ${promptLocale}`)
  console.log(`Source locale: ${sourceLocale}`)
  if (localePack) console.log(`Locale pack: ${localePack.packId}`)
  console.log(`Replicates: ${replicates}`)
  if (experimentId) console.log(`Experiment ID: ${experimentId}`)
  console.log(`Publish latest aliases: ${publishLatestAliases ? "yes" : "no"}`)
  if (runtimeOverrides.timeoutMs !== undefined) console.log(`Timeout override: ${runtimeOverrides.timeoutMs}ms`)
  if (runtimeOverrides.concurrency !== undefined) console.log(`Concurrency override: ${runtimeOverrides.concurrency}`)
  if (runtimeOverrides.perModelConcurrency !== undefined) console.log(`Per-model concurrency override: ${runtimeOverrides.perModelConcurrency}`)
  if (runtimeOverrides.maxRetries !== undefined) console.log(`Retry override: maxRetries=${runtimeOverrides.maxRetries}`)
  if (runtimeOverrides.retryBackoffBaseMs !== undefined) console.log(`Retry backoff base override: ${runtimeOverrides.retryBackoffBaseMs}ms`)
  if (runtimeOverrides.retryBackoffJitterMs !== undefined) console.log(`Retry backoff jitter override: ${runtimeOverrides.retryBackoffJitterMs}ms`)

  const scenarioModules = scenarioSources
    ? await loadScenarioModulesFromSources(scenarioSources)
    : undefined
  const benchmarkBundle = createBenchmarkBundle({
    benchmarkId: benchmarkId ?? undefined,
    bundleVersion: benchmarkBundleVersion ?? undefined,
    datasetBundleVersion: datasetBundleVersion ?? undefined,
    modules: scenarioModules ?? ALL_MODULES,
  })

  const manifest = await runBenchmark({
    runId,
    module: moduleArg,
    modelIds: models,
    levels,
    scenarioIds,
    judgeModel,
    judgeModels,
    judgeStrategy,
    evalAwarenessMode,
    awarenessJudgeModel: awarenessJudgeModel ?? undefined,
    awarenessThreshold,
    transportPolicy: transport,
    conversationMode,
    providerPrecisionPolicy: providerPrecision,
    replicates,
    experimentId: experimentId ?? undefined,
    project: project ?? undefined,
    owner: owner ?? undefined,
    purpose: purpose ?? undefined,
    modelSnapshot: modelSnapshot ?? undefined,
    providerRegion: providerRegion ?? undefined,
    policyVersion: policyVersion ?? undefined,
    systemPromptOverrideUsed: hasFlag("--system-prompt-override-used"),
    customPrepromptUsed: hasFlag("--custom-preprompt-used"),
    gitCommit: gitCommit ?? undefined,
    datasetBundleVersion: datasetBundleVersion ?? undefined,
    promptLocale,
    sourceLocale,
    localePack,
    localePackId: localePack?.packId,
    localePreset: localePreset ?? undefined,
    scenarioModules: scenarioModules ?? undefined,
    benchmarkBundle,
    ...runtimeOverrides,
  })

  writeRunManifest(manifest)
  if (publishLatestAliases) {
    publishLatest(manifest, { retainRuns, archiveDir, allowNonPublicPublish })
  }
  const mode = manifest.metadata.conversationMode === "stateless" ? "stateless" : "stateful"

  console.log(`Saved run: public/data/benchmark-${runId}.json`)
  if (publishLatestAliases) {
    console.log("Updated latest: public/data/benchmark-results.json")
    console.log(`Updated mode latest: public/data/benchmark-results-${mode}.json`)
  } else {
    console.log("Latest aliases unchanged (--no-publish-latest)")
    console.log(`To publish later: pnpm bench:publish --run-id=${runId}`)
  }
  console.log(`Judge (resolved): ${manifest.metadata.judgeModel}`)
  console.log(`Benchmark bundle: ${manifest.metadata.benchmarkDefinition?.benchmarkBundleId ?? "unknown"}`)
  console.log(`Locale (resolved): ${manifest.metadata.promptLocale ?? DEFAULT_SOURCE_LOCALE}`)
  if (publishLatestAliases && retainRuns !== undefined) {
    console.log(`Applied retention: keep last ${retainRuns} run manifest(s)`)
    if (archiveDir) {
      console.log(`Archived older manifests under: public/data/${archiveDir}`)
    }
  }
  console.log(
    `Summary: avg DCS=${manifest.summary.averageDcs}, DRFR=${manifest.summary.drfr}%, modelSuccess=${manifest.summary.modelSuccessRate}%, scorable=${manifest.summary.scorableRate}%`
  )
  if (manifest.summary.repeatStats) {
    console.log(
      `Tuple summary: tuples=${manifest.summary.repeatStats.totalTuples}, scoredTuples=${manifest.summary.repeatStats.scoredTuples}, avgObservedReplicates=${manifest.summary.repeatStats.averageObservedReplicates}, meanWithinTupleStdDev=${manifest.summary.repeatStats.meanWithinTupleStdDev}`
    )
  }
  if (manifest.summary.evaluationAwareness) {
    console.log(
      `Awareness summary: trace=${manifest.summary.evaluationAwareness.traceCoverageRate}%, aware=${manifest.summary.evaluationAwareness.evaluationAwarenessRate}%, deception=${manifest.summary.evaluationAwareness.deceptionSuspicionRate}%`
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
