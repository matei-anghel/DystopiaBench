import { getOpenRouterApiKey } from "../lib/dystopiabench/env"
import {
  AVAILABLE_MODELS,
  DEFAULT_JUDGE_MODEL,
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
  PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
  getModelById,
} from "../lib/dystopiabench/models"
import { ALL_MODULES, ALL_SCENARIOS, getRegisteredModuleIds, getScenariosByModule } from "../lib/dystopiabench/scenarios"
import { createBenchmarkBundle } from "../lib/dystopiabench/bundles"
import { loadScenarioModulesFromSources } from "../lib/dystopiabench/scenario-loader"
import {
  archiveAndWriteOpenRouterTracesForManifest,
  collectOpenRouterArchiveTargets,
} from "../lib/dystopiabench/openrouter-trace-archive"
import {
  buildResumeRows,
  checkpointResultKey,
  createRunCheckpoint,
  hasRunCheckpoint,
  readRunCheckpoint,
  writeRunCheckpoint,
  type RunCheckpoint,
  type RunCheckpointConfig,
} from "../lib/dystopiabench/run-checkpoint"
import {
  bold,
  cyan,
  dim,
  formatCount,
  formatDuration,
  green,
  magenta,
  purple,
  red,
  renderKeyValueRows,
  renderProgressBar,
  underline,
  yellow,
} from "../lib/dystopiabench/terminal-output"
import {
  runBenchmark,
  type JudgeStrategy,
  type ModelReasoningVariant,
  type ProviderPrecisionPolicy,
  type SchedulerMode,
  type TransportPolicy,
} from "../lib/dystopiabench/runner"
import {
  makeRunId,
  publishLatest,
  sanitizeRunId,
  validatePrivateArtifactDir,
  writeRunManifest,
} from "../lib/dystopiabench/storage"
import { GENERATION_CONFIG } from "../lib/dystopiabench/schemas"
import { toModuleId, type BenchmarkModuleSelector } from "../lib/dystopiabench/types"

type ModuleArg = BenchmarkModuleSelector

const CLI_LOG_PREFIX = bold(cyan("BENCH"))

type CompletedManifest = Awaited<ReturnType<typeof runBenchmark>>
type OpenRouterArchiveStatus =
  | {
      kind: "archived"
      relativePath: string
      uniqueGenerationCount: number
      rowsMissingGenerationId: number
      metadataRetrievedCount: number
      contentRetrievedCount: number
    }
  | {
      kind: "skipped"
      reason: string
      openrouterRowCount?: number
      rowsMissingGenerationId?: number
    }
  | {
      kind: "failed"
      reason: string
      openrouterRowCount: number
      uniqueGenerationCount: number
    }

function colorDcs(value: number | null): string {
  const label = value === null ? "-".padStart(3) : String(value).padStart(3)
  if (value === null) return dim(label)
  if (value <= 25) return green(label)
  if (value <= 50) return yellow(label)
  if (value <= 75) return cyan(label)
  return magenta(label)
}

function renderModelSummary(manifest: CompletedManifest): string {
  const rows = [...new Set(manifest.results.map((result) => result.modelId))].map((modelId) => {
    const modelResults = manifest.results.filter((result) => result.modelId === modelId)
    const scored = modelResults.filter((result) => result.level >= 3 && result.score !== null)
    const errors = modelResults.filter((result) => result.status !== "ok").length
    const fallback = modelResults.filter((result) => result.endpointUsed === "openrouter_chat_fallback").length
    const avgDcs =
      scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, result) => sum + (result.score ?? 0), 0) / scored.length)
    const avgCost =
      modelResults.reduce((sum, result) => sum + (result.estimatedCostUsd?.totalUsd ?? 0), 0) /
      Math.max(modelResults.length, 1)
    const avgTokens =
      modelResults.reduce((sum, result) => sum + (result.totalUsage?.totalTokens ?? result.totalTokenCount ?? 0), 0) /
      Math.max(modelResults.length, 1)
    const durations = modelResults.map((result) => result.timing?.totalLatencyMs ?? 0).filter((value) => value > 0)
    const avgDuration =
      durations.length === 0 ? 0 : durations.reduce((sum, value) => sum + value, 0) / durations.length
    const slowest = durations.length === 0 ? 0 : Math.max(...durations)

    return {
      modelId,
      tests: `${modelResults.length}/${modelResults.length}`,
      avgDcs,
      errors,
      fallback,
      avgCost,
      avgTokens,
      avgDuration,
      slowest,
    }
  })

  const modelWidth = Math.max(5, ...rows.map((row) => row.modelId.length))
  const header = [
    "Model".padEnd(modelWidth),
    "Tests".padStart(7),
    "Avg DCS".padStart(7),
    "Errors".padStart(6),
    "Fallback".padStart(8),
    "Avg Cost".padStart(9),
    "Avg Tokens".padStart(10),
    "Avg Duration".padStart(12),
    "Slowest".padStart(9),
  ].join("  ")

  const lines = rows.map((row) => [
    purple(row.modelId.padEnd(modelWidth)),
    dim(row.tests.padStart(7)),
    colorDcs(row.avgDcs),
    row.errors > 0 ? red(String(row.errors).padStart(6)) : dim("-".padStart(6)),
    row.fallback > 0 ? yellow(String(row.fallback).padStart(8)) : dim("-".padStart(8)),
    green(`$${row.avgCost.toFixed(4)}`.padStart(9)),
    cyan(formatCount(Math.round(row.avgTokens)).padStart(10)),
    magenta(formatDuration(row.avgDuration).padStart(12)),
    magenta(formatDuration(row.slowest).padStart(9)),
  ].join("  "))

  return [`  ${underline(header)}`, ...lines.map((line) => `  ${line}`)].join("\n")
}

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
  if (!input) return "all"
  if (input === "all" || input === "both") return input
  const requestedModules = normalizeModelInputList(input)
  if (requestedModules.length === 0) {
    throw new Error(`Invalid --module value. Use one of: ${[...registeredModules, "all", "both"].join(", ")}.`)
  }
  const invalidModules = requestedModules.filter((moduleId) => !registeredModules.has(moduleId))
  if (invalidModules.length > 0) {
    throw new Error(`Invalid --module value. Unknown module id(s): ${invalidModules.join(", ")}.`)
  }
  if (requestedModules.length === 1) return toModuleId(requestedModules[0])
  return requestedModules.join(",") as ModuleArg
}

function countScenariosForModuleSelector(module: ModuleArg): number {
  if (module === "all" || module === "both") return ALL_SCENARIOS.length
  const selectedModules = normalizeModelInputList(module)
  return selectedModules.reduce((sum, moduleId) => sum + getScenariosByModule(moduleId).length, 0)
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

function parsePrivateArtifactDir(input: string | undefined): string | undefined {
  if (!input) return undefined
  return validatePrivateArtifactDir(input)
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
  if (input.startsWith("openrouter:") || input.startsWith("local:") || input.startsWith("litellm:")) return true
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

function parseChatFirstModelIds(input: string | undefined): string[] {
  const requested = normalizeModelInputList(input)
  const invalid = requested.filter((id) => !isValidModelSpecifier(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown chat-first model id(s): ${invalid.join(", ")}`)
  }
  return Array.from(new Set(requested))
}

function isValidJudgeModelSpecifier(input: string): boolean {
  if (getModelById(input)) return true
  if (input.startsWith("openrouter:") || input.startsWith("local:") || input.startsWith("litellm:")) return true
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

function parseScheduler(
  input: string | undefined,
  conversationMode: "stateful" | "stateless",
  resumeDefault?: string,
): SchedulerMode {
  if (!input) {
    if (resumeDefault === "level-wave" || resumeDefault === "conversation") return resumeDefault
    return conversationMode === "stateful" ? "level-wave" : "conversation"
  }
  if (input === "level-wave" || input === "conversation") return input
  throw new Error("Invalid --scheduler value. Use one of: level-wave, conversation.")
}

function parseResumeMode(input: string | undefined, resumeDefault?: string): "all" | "prefix" {
  if (!input) {
    if (resumeDefault === "all" || resumeDefault === "prefix") return resumeDefault
    return "all"
  }
  if (input === "all" || input === "prefix") return input
  throw new Error("Invalid --resume-mode value. Use one of: all, prefix.")
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

function parseScenarioSources(input: string | undefined): string[] | undefined {
  const values = normalizeModelInputList(input)
  return values.length > 0 ? values : undefined
}

function sanitizeReasoningSuffix(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
}

function parseModelReasoningVariants(input: string | undefined): ModelReasoningVariant[] | undefined {
  const values = normalizeModelInputList(input)
  if (values.length === 0) return undefined

  return values.map((value) => {
    const separatorIndex = value.lastIndexOf(":")
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      throw new Error(
        "Invalid --model-reasoning-variants entry. Use model:level, e.g. gpt-5.5:high."
      )
    }

    const modelId = value.slice(0, separatorIndex).trim()
    const level = value.slice(separatorIndex + 1).trim().toLowerCase()
    if (!modelId || !level) {
      throw new Error("Invalid --model-reasoning-variants entry. Model and level are required.")
    }

    const suffix = `reasoning-${sanitizeReasoningSuffix(level)}`
    const openRouterRequest = /opus/i.test(modelId)
      ? {
          reasoning: { enabled: true },
          verbosity: level,
        }
      : {
          reasoning: { effort: level },
        }

    return {
      modelId,
      suffix,
      openRouterRequest,
    }
  })
}

async function main() {
  const resumeRequested = hasFlag("--resume")
  const requestedRunId = parseArg("--run-id")
  if (resumeRequested && !requestedRunId) {
    throw new Error("Use --run-id=<existing-run-id> together with --resume.")
  }

  const runId = sanitizeRunId(requestedRunId ?? makeRunId())
  if (resumeRequested && !hasRunCheckpoint(runId)) {
    throw new Error(`No checkpoint exists for run ${runId}.`)
  }
  if (!resumeRequested && hasRunCheckpoint(runId)) {
    throw new Error(`Checkpoint already exists for run ${runId}. Use --resume to continue it.`)
  }

  const checkpoint = resumeRequested ? readRunCheckpoint(runId) : undefined
  const checkpointConfig = checkpoint?.config

  const moduleArg = parseArg("--module")
    ? parseModule(parseArg("--module"))
    : parseModule(checkpointConfig?.module)
  const levels: Array<1 | 2 | 3 | 4 | 5> = parseArg("--levels")
    ? parseLevels(parseArg("--levels"))
    : checkpointConfig?.levels
      ? [...checkpointConfig.levels] as Array<1 | 2 | 3 | 4 | 5>
      : [1, 2, 3, 4, 5]
  const models = parseArg("--models")
    ? parseModels(parseArg("--models"))
    : checkpointConfig?.modelIds ?? AVAILABLE_MODELS.map((model) => model.id)
  const modelReasoningVariants = parseArg("--model-reasoning-variants")
    ? parseModelReasoningVariants(parseArg("--model-reasoning-variants"))
    : checkpointConfig?.modelReasoningVariants as ModelReasoningVariant[] | undefined
  const judgeModel = parseArg("--judge-model") ?? checkpointConfig?.judgeModel
  const judgeStrategy = parseJudgeStrategy(parseArg("--judge-strategy") ?? checkpointConfig?.judgeStrategy)
  const judgeModelsArg = parseArg("--judge-models")
  const judgeModels =
    judgeStrategy === "single"
      ? parseJudgeModels(judgeModelsArg ?? checkpointConfig?.judgeModels?.join(","), judgeModel)
      : judgeModelsArg
        ? parseJudgeModels(judgeModelsArg, undefined)
        : checkpointConfig?.judgeModels
  if (judgeStrategy === "pair-with-tiebreak" && judgeModel && judgeModelsArg) {
    throw new Error("Use either --judge-model or --judge-models with --judge-strategy=pair-with-tiebreak, not both.")
  }
  if (judgeStrategy === "pair-with-tiebreak" && judgeModels && judgeModels.length !== 3) {
    throw new Error("--judge-models must contain exactly three selectors for pair-with-tiebreak.")
  }
  const scenarioIds = parseArg("--scenario-ids")
    ? parseScenarioIds(parseArg("--scenario-ids"))
    : checkpointConfig?.scenarioIds
  const retainRuns = parseArg("--retain")
    ? parseRetainRuns(parseArg("--retain"))
    : checkpointConfig?.retainRuns
  const archiveDir = parseArg("--archive-dir")
    ? parseArchiveDir(parseArg("--archive-dir"))
    : checkpointConfig?.archiveDir
  const transport = parseTransport(parseArg("--transport") ?? checkpointConfig?.transportPolicy)
  const chatFirstModelIds = parseArg("--chat-first-models")
    ? parseChatFirstModelIds(parseArg("--chat-first-models"))
    : checkpointConfig?.chatFirstModelIds ?? []
  const fallbackOnTimeout = hasFlag("--no-timeout-fallback") ? false : checkpointConfig?.fallbackOnTimeout ?? true
  const conversationMode = parseConversationMode(parseArg("--conversation-mode") ?? checkpointConfig?.conversationMode)
  const scheduler = parseScheduler(
    parseArg("--scheduler"),
    conversationMode,
    resumeRequested ? checkpointConfig?.scheduler ?? "conversation" : undefined,
  )
  const resumeMode = parseResumeMode(parseArg("--resume-mode"), checkpointConfig?.resumeMode)
  const modelSystemPromptMode = hasFlag("--no-model-system-prompt")
    ? "none"
    : checkpointConfig?.modelSystemPromptMode ?? "standard"
  const providerPrecision = parseProviderPrecision(parseArg("--provider-precision") ?? checkpointConfig?.providerPrecisionPolicy)
  const replicates = parsePositiveIntFlag("--replicates", parseArg("--replicates")) ?? checkpointConfig?.replicates ?? 3
  const experimentId = parseArg("--experiment-id") ?? checkpointConfig?.experimentId
  const project = parseArg("--project") ?? checkpointConfig?.project
  const owner = parseArg("--owner") ?? checkpointConfig?.owner
  const purpose = parseArg("--purpose") ?? checkpointConfig?.purpose
  const modelSnapshot = parseArg("--model-snapshot") ?? checkpointConfig?.modelSnapshot
  const providerRegion = parseArg("--provider-region") ?? checkpointConfig?.providerRegion
  const policyVersion = parseArg("--policy-version") ?? checkpointConfig?.policyVersion
  const gitCommit = parseArg("--git-commit") ?? checkpointConfig?.gitCommit
  const datasetBundleVersion = parseArg("--dataset-bundle-version") ?? checkpointConfig?.datasetBundleVersion
  const benchmarkId = parseArg("--benchmark-id") ?? checkpointConfig?.benchmarkId
  const benchmarkBundleVersion = parseArg("--benchmark-bundle-version") ?? checkpointConfig?.benchmarkBundleVersion
  const scenarioSources = parseArg("--scenario-sources")
    ? parseScenarioSources(parseArg("--scenario-sources"))
    : checkpointConfig?.scenarioSources
  const privateArtifactDir =
    parsePrivateArtifactDir(parseArg("--private-artifact-dir")) ?? checkpointConfig?.privateArtifactDir
  const artifactVisibility = (hasFlag("--private-artifacts") || privateArtifactDir)
    ? "private"
    : checkpointConfig?.artifactVisibility
  const publishLatestAliases =
    artifactVisibility === "private" || hasFlag("--no-publish-latest")
      ? false
      : checkpointConfig?.publishLatestAliases ?? true
  const runtimeOverrides = {
    timeoutMs: parsePositiveIntFlag("--timeout-ms", parseArg("--timeout-ms")) ?? checkpointConfig?.timeoutMs,
    concurrency: parsePositiveIntFlag("--concurrency", parseArg("--concurrency")) ?? checkpointConfig?.concurrency,
    perModelConcurrency:
      parsePositiveIntFlag("--per-model-concurrency", parseArg("--per-model-concurrency")) ?? checkpointConfig?.perModelConcurrency,
    requestStartDelayMs:
      parseNonNegativeIntFlag("--request-start-delay-ms", parseArg("--request-start-delay-ms")) ?? checkpointConfig?.requestStartDelayMs,
    maxRetries: parseNonNegativeIntFlag("--max-retries", parseArg("--max-retries")) ?? checkpointConfig?.maxRetries,
    retryBackoffBaseMs:
      parsePositiveIntFlag("--retry-backoff-base-ms", parseArg("--retry-backoff-base-ms")) ?? checkpointConfig?.retryBackoffBaseMs,
    retryBackoffJitterMs:
      parseNonNegativeIntFlag("--retry-backoff-jitter-ms", parseArg("--retry-backoff-jitter-ms")) ?? checkpointConfig?.retryBackoffJitterMs,
  }
  const effectiveTimeoutMs = runtimeOverrides.timeoutMs ?? GENERATION_CONFIG.timeoutMs

  if (!publishLatestAliases && (retainRuns !== undefined || archiveDir !== undefined)) {
    throw new Error("--retain and --archive-dir require publishing latest aliases. Remove --no-publish-latest or omit retention flags.")
  }

  const scenarioSummary =
    scenarioIds && scenarioIds.length > 0
      ? `${scenarioIds.join(", ")} (${scenarioIds.length})`
      : `all (${countScenariosForModuleSelector(moduleArg)})`
  const judgeSummary =
    judgeStrategy === "pair-with-tiebreak"
      ? (judgeModels ?? [
          judgeModel ?? DEFAULT_JUDGE_MODEL,
          PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
          PAIR_WITH_TIEBREAK_ARBITER_MODEL,
        ]).join(", ")
      : judgeModels && judgeModels.length > 0
        ? judgeModels.join(", ")
        : "default"

  console.log(`${CLI_LOG_PREFIX} ${bold("DystopiaBench run")}`)
  console.log(renderKeyValueRows([
    ["Run ID", runId],
    ["Resume", resumeRequested ? "yes" : "no"],
    ["Modules", moduleArg],
    ["Models", models.join(", ")],
    [
      "Reasoning variants",
      modelReasoningVariants
        ? modelReasoningVariants.map((variant) => `${variant.modelId}:${variant.suffix.replace(/^reasoning-/, "")}`).join(", ")
        : undefined,
    ],
    ["Levels", levels.join(", ")],
    ["Scenarios", scenarioSummary],
    ["Judge strategy", judgeStrategy],
    ["Judge", judgeSummary],
    ["Transport", transport],
    ["Chat-first models", chatFirstModelIds.length > 0 ? chatFirstModelIds.join(", ") : undefined],
    ["Timeout fallback", fallbackOnTimeout ? "yes" : "no"],
    ["Conversation mode", conversationMode],
    ["Scheduler", scheduler],
    ["Model system prompt", modelSystemPromptMode],
    ["Resume mode", resumeRequested ? resumeMode : undefined],
    ["Provider precision", providerPrecision],
    ["Replicates", replicates],
    ["Experiment ID", experimentId],
    ["Artifact visibility", artifactVisibility],
    ["Private artifact dir", privateArtifactDir ? `artifacts/private/${privateArtifactDir}` : undefined],
    ["Publish latest", publishLatestAliases ? "yes" : "no"],
    ["Timeout", `${effectiveTimeoutMs}ms${runtimeOverrides.timeoutMs === undefined ? " (default)" : " (override)"}`],
    ["Concurrency", runtimeOverrides.concurrency],
    ["Per-model concurrency", runtimeOverrides.perModelConcurrency],
    ["Request start delay", runtimeOverrides.requestStartDelayMs === undefined ? undefined : `${runtimeOverrides.requestStartDelayMs}ms`],
    ["Retry override", runtimeOverrides.maxRetries === undefined ? undefined : `maxRetries=${runtimeOverrides.maxRetries}`],
    ["Retry backoff base", runtimeOverrides.retryBackoffBaseMs === undefined ? undefined : `${runtimeOverrides.retryBackoffBaseMs}ms`],
    ["Retry backoff jitter", runtimeOverrides.retryBackoffJitterMs === undefined ? undefined : `${runtimeOverrides.retryBackoffJitterMs}ms`],
  ], 22))

  const scenarioModules = scenarioSources
    ? await loadScenarioModulesFromSources(scenarioSources)
    : undefined
  const benchmarkBundle = createBenchmarkBundle({
    benchmarkId: benchmarkId ?? undefined,
    bundleVersion: benchmarkBundleVersion ?? undefined,
    datasetBundleVersion: datasetBundleVersion ?? undefined,
    modules: scenarioModules ?? ALL_MODULES,
  })

  const checkpointConfigValue: RunCheckpointConfig = {
    module: String(moduleArg),
    modelIds: models,
    modelReasoningVariants,
    levels,
    scenarioIds,
    judgeModel: judgeModel ?? undefined,
    judgeModels: judgeModels ?? undefined,
    judgeStrategy,
    transportPolicy: transport,
    chatFirstModelIds,
    fallbackOnTimeout,
    resumeMode,
    conversationMode,
    scheduler,
    modelSystemPromptMode,
    providerPrecisionPolicy: providerPrecision,
    timeoutMs: runtimeOverrides.timeoutMs,
    concurrency: runtimeOverrides.concurrency,
    perModelConcurrency: runtimeOverrides.perModelConcurrency,
    requestStartDelayMs: runtimeOverrides.requestStartDelayMs,
    maxRetries: runtimeOverrides.maxRetries,
    retryBackoffBaseMs: runtimeOverrides.retryBackoffBaseMs,
    retryBackoffJitterMs: runtimeOverrides.retryBackoffJitterMs,
    replicates,
    experimentId: experimentId ?? undefined,
    project: project ?? undefined,
    owner: owner ?? undefined,
    purpose: purpose ?? undefined,
    modelSnapshot: modelSnapshot ?? undefined,
    providerRegion: providerRegion ?? undefined,
    policyVersion: policyVersion ?? undefined,
    systemPromptOverrideUsed: hasFlag("--system-prompt-override-used") || modelSystemPromptMode === "none",
    customPrepromptUsed: hasFlag("--custom-preprompt-used"),
    gitCommit: gitCommit ?? undefined,
    datasetBundleVersion: datasetBundleVersion ?? undefined,
    benchmarkId: benchmarkId ?? undefined,
    benchmarkBundleVersion: benchmarkBundleVersion ?? undefined,
    scenarioSources: scenarioSources ?? undefined,
    retainRuns,
    archiveDir,
    publishLatestAliases,
    privateArtifactDir,
    artifactVisibility,
  }

  const workingCheckpoint: RunCheckpoint = checkpoint
    ? {
        ...checkpoint,
        config: checkpointConfigValue,
      }
    : createRunCheckpoint({
        runId,
        config: checkpointConfigValue,
      })
  const checkpointRowIndex = new Map(workingCheckpoint.results.map((row, index) => [checkpointResultKey(row), index]))
  const resumeRows = resumeRequested ? buildResumeRows(workingCheckpoint, resumeMode) : []
  let checkpointWriteQueue = Promise.resolve()
  let lastCheckpointWriteAt = 0
  let rowsSinceCheckpointWrite = 0
  let checkpointTotalPrompts = workingCheckpoint.totalPlannedPrompts
  const checkpointWriteThresholdRows = 5
  const checkpointWriteThresholdMs = 2000
  const enqueueCheckpointWrite = (status: RunCheckpoint["status"], force = false) => {
    workingCheckpoint.status = status
    workingCheckpoint.totalPlannedPrompts = checkpointTotalPrompts
    workingCheckpoint.completedPrompts = workingCheckpoint.results.length
    const now = Date.now()
    if (!force && rowsSinceCheckpointWrite < checkpointWriteThresholdRows && now - lastCheckpointWriteAt < checkpointWriteThresholdMs) {
      return checkpointWriteQueue
    }
    checkpointWriteQueue = checkpointWriteQueue.then(async () => {
      writeRunCheckpoint(workingCheckpoint)
      lastCheckpointWriteAt = Date.now()
      rowsSinceCheckpointWrite = 0
    })
    return checkpointWriteQueue
  }

  const abortController = new AbortController()
  let interruptCount = 0
  const handleSigint = () => {
    interruptCount += 1
    if (interruptCount === 1) {
      console.log(`\n${CLI_LOG_PREFIX} ${yellow("Interrupt received")} stopping after in-flight requests and saving checkpoint...`)
      abortController.abort()
      void enqueueCheckpointWrite("interrupted", true)
      return
    }

    console.log(`\n${CLI_LOG_PREFIX} ${red("Forcing exit")} checkpointing current progress...`)
    void enqueueCheckpointWrite("interrupted", true).finally(() => {
      process.exit(130)
    })
  }
  process.on("SIGINT", handleSigint)

  const isRecoverableProcessRejection = (reason: unknown): boolean => {
    const searchable = reason instanceof Error
      ? [
          reason.name,
          reason.message,
          String((reason as { code?: unknown }).code ?? ""),
          String((reason as { cause?: { code?: unknown; message?: unknown } }).cause?.code ?? ""),
          String((reason as { cause?: { code?: unknown; message?: unknown } }).cause?.message ?? ""),
        ].join(" ")
      : String(reason)
    const normalized = searchable.toLowerCase()
    return [
      "timeout",
      "aborterror",
      "operation was aborted",
      "this operation was aborted",
      "aborted",
      "terminated",
      "und_err_socket",
      "other side closed",
      "socket closed",
      "fetch failed",
      "econnreset",
    ].some((pattern) => normalized.includes(pattern))
  }

  const handleUnhandledRejection = (reason: unknown) => {
    if (isRecoverableProcessRejection(reason)) {
      const message = reason instanceof Error ? reason.message : String(reason)
      console.warn(`\n${CLI_LOG_PREFIX} ${yellow("Recovered async provider error")} ${message}`)
      void enqueueCheckpointWrite("running", true)
      return
    }

    void enqueueCheckpointWrite("interrupted", true).finally(() => {
      setImmediate(() => {
        throw reason instanceof Error ? reason : new Error(String(reason))
      })
    })
  }
  process.on("unhandledRejection", handleUnhandledRejection)

  let manifest: CompletedManifest
  try {
    manifest = await runBenchmark({
      runId,
      module: moduleArg,
      modelIds: models,
      modelReasoningVariants,
      levels,
      scenarioIds,
      judgeModel,
      judgeModels,
      judgeStrategy,
      transportPolicy: transport,
      chatFirstModelIds,
      fallbackOnTimeout,
      conversationMode,
      scheduler,
      modelSystemPromptMode,
      providerPrecisionPolicy: providerPrecision,
      artifactVisibility,
      replicates,
      experimentId: experimentId ?? undefined,
      project: project ?? undefined,
      owner: owner ?? undefined,
      purpose: purpose ?? undefined,
      modelSnapshot: modelSnapshot ?? undefined,
      providerRegion: providerRegion ?? undefined,
      policyVersion: policyVersion ?? undefined,
      systemPromptOverrideUsed: hasFlag("--system-prompt-override-used") || modelSystemPromptMode === "none",
      customPrepromptUsed: hasFlag("--custom-preprompt-used"),
      gitCommit: gitCommit ?? undefined,
      datasetBundleVersion: datasetBundleVersion ?? undefined,
      scenarioModules: scenarioModules ?? undefined,
      benchmarkBundle,
      existingResults: resumeRows,
      abortSignal: abortController.signal,
      onSetup: async ({ total }) => {
        checkpointTotalPrompts = total
        await enqueueCheckpointWrite("running", true)
      },
      onResult: async ({ row }) => {
        const key = checkpointResultKey(row)
        const existingIndex = checkpointRowIndex.get(key)
        if (existingIndex === undefined) {
          checkpointRowIndex.set(key, workingCheckpoint.results.length)
          workingCheckpoint.results.push(row)
        } else {
          workingCheckpoint.results[existingIndex] = row
        }
        rowsSinceCheckpointWrite += 1
        await enqueueCheckpointWrite("running")
      },
      ...runtimeOverrides,
    })
  } catch (error) {
    await enqueueCheckpointWrite("interrupted", true)
    process.off("SIGINT", handleSigint)
    process.off("unhandledRejection", handleUnhandledRejection)
    throw error
  }
  await checkpointWriteQueue

  const integrity = manifest.summary.integrity
  const integrityFailed = integrity?.verdict === "fail"
  let openRouterArchiveStatus: OpenRouterArchiveStatus | undefined
  const runInterrupted = abortController.signal.aborted || manifest.results.length < checkpointTotalPrompts
  if (!runInterrupted && !hasFlag("--no-openrouter-archive")) {
    const traceTargets = collectOpenRouterArchiveTargets(manifest)
    if (traceTargets.openrouterRowCount === 0) {
      openRouterArchiveStatus = {
        kind: "skipped",
        reason: "no OpenRouter-linked rows in this run",
      }
    } else if (traceTargets.targets.length === 0) {
      openRouterArchiveStatus = {
        kind: "skipped",
        reason: "OpenRouter rows lacked usable generation IDs",
        openrouterRowCount: traceTargets.openrouterRowCount,
        rowsMissingGenerationId: traceTargets.rowsMissingGenerationId,
      }
    } else if (!getOpenRouterApiKey()) {
      openRouterArchiveStatus = {
        kind: "skipped",
        reason: "OPENROUTER_API_KEY unavailable for archive fetch",
        openrouterRowCount: traceTargets.openrouterRowCount,
        rowsMissingGenerationId: traceTargets.rowsMissingGenerationId,
      }
    } else {
      try {
        const written = await archiveAndWriteOpenRouterTracesForManifest(manifest)
        workingCheckpoint.openrouter = {
          linkedRowCount: written.archive.summary.openrouterRowCount,
          rowsMissingGenerationId: written.archive.summary.rowsMissingGenerationId,
          archivePath: written.relativePath,
        }
        openRouterArchiveStatus = {
          kind: "archived",
          relativePath: written.relativePath,
          uniqueGenerationCount: written.archive.summary.uniqueGenerationCount,
          rowsMissingGenerationId: written.archive.summary.rowsMissingGenerationId,
          metadataRetrievedCount: written.archive.summary.metadataRetrievedCount,
          contentRetrievedCount: written.archive.summary.contentRetrievedCount,
        }
      } catch (error) {
        openRouterArchiveStatus = {
          kind: "failed",
          reason: error instanceof Error ? error.message : String(error),
          openrouterRowCount: traceTargets.openrouterRowCount,
          uniqueGenerationCount: traceTargets.targets.length,
        }
      }
    }
  } else {
    openRouterArchiveStatus = {
      kind: "skipped",
      reason: runInterrupted ? "run interrupted before final archive step" : "--no-openrouter-archive",
    }
  }

  workingCheckpoint.results = manifest.results
  checkpointRowIndex.clear()
  manifest.results.forEach((row, index) => checkpointRowIndex.set(checkpointResultKey(row), index))
  workingCheckpoint.totalPlannedPrompts = checkpointTotalPrompts

  let writtenRunManifest: ReturnType<typeof writeRunManifest> | undefined
  if (runInterrupted) {
    await enqueueCheckpointWrite("interrupted", true)
  } else {
    workingCheckpoint.status = "completed"
    await enqueueCheckpointWrite("completed", true)
    writtenRunManifest = writeRunManifest(manifest, { privateArtifactDir })
    if (publishLatestAliases && !integrityFailed) {
      publishLatest(manifest, { retainRuns, archiveDir })
    }
  }
  process.off("SIGINT", handleSigint)
  process.off("unhandledRejection", handleUnhandledRejection)
  const mode = manifest.metadata.conversationMode === "stateless" ? "stateless" : "stateful"

  console.log(`\n${CLI_LOG_PREFIX} ${integrityFailed ? bold(red("Run failed integrity checks")) : bold("Run complete")}`)
  const progressPct = checkpointTotalPrompts === 0 ? 100 : Math.round((manifest.results.length / checkpointTotalPrompts) * 100)
  console.log(`  ${renderProgressBar(progressPct)} ${magenta(`${progressPct}%`)} ${dim(`(${manifest.results.length}/${checkpointTotalPrompts} completed)`)}`)
  if (runInterrupted) {
    console.log(`  ${yellow("checkpoint saved")} interrupted run can be resumed with pnpm bench:run --run-id=${runId} --resume`)
  } else {
    console.log(`  ${green("saved")} ${writtenRunManifest?.relativeRunPath ?? `public/data/benchmark-${runId}.json`}`)
  }
  if (openRouterArchiveStatus?.kind === "archived") {
    console.log(`  ${green("archived")} ${openRouterArchiveStatus.relativePath}`)
  } else if (openRouterArchiveStatus?.kind === "failed") {
    console.log(`  ${yellow("archive failed")} ${openRouterArchiveStatus.reason}`)
  } else if (openRouterArchiveStatus?.kind === "skipped") {
    console.log(`  ${dim("archive skipped")} ${openRouterArchiveStatus.reason}`)
  }
  if (integrityFailed) {
    console.log(`  ${red("integrity failed")} latest aliases not updated`)
  } else if (!runInterrupted && publishLatestAliases) {
    console.log(`  ${green("updated")} public/data/benchmark-results-${mode}.json`)
  } else if (!runInterrupted) {
    console.log(`  ${dim("latest aliases unchanged")} (--no-publish-latest)`)
    console.log(`  ${dim("publish later")} pnpm bench:publish --run-id=${runId}`)
  } else {
    console.log(`  ${dim("latest aliases unchanged")} interrupted runs are checkpointed privately until resumed`)
  }
  console.log(renderKeyValueRows([
    ["Judge resolved", manifest.metadata.judgeModel],
    ["Benchmark bundle", manifest.metadata.benchmarkDefinition?.benchmarkBundleId ?? "unknown"],
  ], 22))
  if (openRouterArchiveStatus?.kind === "archived") {
    console.log(renderKeyValueRows([
      ["OpenRouter archive", openRouterArchiveStatus.relativePath],
      ["Archived generations", openRouterArchiveStatus.uniqueGenerationCount],
      ["Archive metadata", `${openRouterArchiveStatus.metadataRetrievedCount}/${openRouterArchiveStatus.uniqueGenerationCount}`],
      ["Archive content", `${openRouterArchiveStatus.contentRetrievedCount}/${openRouterArchiveStatus.uniqueGenerationCount}`],
    ], 22))
  } else if (openRouterArchiveStatus?.kind === "failed") {
    console.log(renderKeyValueRows([
      ["OpenRouter archive", "failed"],
      ["Archive reason", openRouterArchiveStatus.reason],
      ["Archive targets", openRouterArchiveStatus.uniqueGenerationCount],
    ], 22))
  } else if (
    openRouterArchiveStatus?.kind === "skipped" &&
    openRouterArchiveStatus.openrouterRowCount !== undefined
  ) {
    console.log(renderKeyValueRows([
      ["OpenRouter archive", "skipped"],
      ["Archive reason", openRouterArchiveStatus.reason],
      ["OpenRouter rows", openRouterArchiveStatus.openrouterRowCount],
      ["Missing generation IDs", openRouterArchiveStatus.rowsMissingGenerationId ?? 0],
    ], 22))
  }
  if (publishLatestAliases && retainRuns !== undefined) {
    console.log(`  ${dim("retention".padEnd(22))} keep last ${retainRuns} run manifest(s)`)
    if (archiveDir) {
      console.log(`  ${dim("archive".padEnd(22))} public/data/${archiveDir}`)
    }
  }
  if (manifest.summary.telemetry) {
    console.log(renderKeyValueRows([
      ["Telemetry cost", `$${manifest.summary.telemetry.estimatedCostUsd.totalUsd.toFixed(4)}`],
      ["Tokens", formatCount(manifest.summary.telemetry.totalUsage.totalTokens)],
      ["Reasoning tokens", formatCount(manifest.summary.telemetry.totalUsage.reasoningTokens)],
      ["Wall time", formatDuration(manifest.summary.telemetry.runWallTimeMs)],
    ], 22))
  }
  if (integrity) {
    console.log(renderKeyValueRows([
      ["Integrity verdict", integrity.verdict],
      ["Integrity failures", integrity.failures.length],
      ["Integrity warnings", integrity.warnings.length],
    ], 22))
    for (const failure of integrity.failures) {
      console.log(`  ${red("failure")} ${failure}`)
    }
    for (const warning of integrity.warnings.slice(0, 5)) {
      console.log(`  ${yellow("warning")} ${warning}`)
    }
    if (integrity.warnings.length > 5) {
      console.log(`  ${yellow("warning")} ${integrity.warnings.length - 5} additional integrity warning(s) omitted`)
    }
  }
  console.log(`\n${CLI_LOG_PREFIX} ${bold("Model summary")}`)
  console.log(renderModelSummary(manifest))
  console.log(
    `${CLI_LOG_PREFIX} ${bold("Overall")} ${green(`${manifest.results.length}/${manifest.results.length} done`)} | avg DCS ${colorDcs(manifest.summary.averageDcs)} | DRFR ${yellow(`${manifest.summary.drfr}%`)} | modelSuccess ${green(`${manifest.summary.modelSuccessRate}%`)} | scorable ${green(`${manifest.summary.scorableRate}%`)} | integrity ${integrityFailed ? red("fail") : green("pass")}`
  )
  if (integrityFailed && !runInterrupted) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
