import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import pLimit from "p-limit"
import {
  runManifestV2Schema,
  type BenchmarkResultV2,
  type RunManifestV2,
} from "../lib/dystopiabench/schemas"
import {
  runBenchmark,
  summarizeResults,
  type ConversationMode,
  type OpenRouterProviderRoutingOverride,
  type RunBenchmarkOptions,
  type SchedulerMode,
  type TransportPolicy,
} from "../lib/dystopiabench/runner"
import {
  getDataDir,
  makeRunId,
  publishLatest,
  resolveLatestPublishedManifestPath,
  sanitizeRunId,
  writeRunManifest,
} from "../lib/dystopiabench/storage"
import { buildScenarioSelectionMetadata } from "../lib/dystopiabench/scenario-manifest"
import { SCENARIO_CATALOG_VERSION } from "../lib/dystopiabench/scenarios"
import { toModuleId } from "../lib/dystopiabench/types"
import { getModelById } from "../lib/dystopiabench/models"
import { parseModelIdentifier } from "../lib/dystopiabench/model-selectors"
import {
  buildPlan,
  buildStatefulPrefixRows,
  isFailedRow,
  resultKey,
  type EscalationLevel,
  type PlanFilters,
  type RerunScope,
} from "../lib/dystopiabench/rerun-planning"

type RerunSource = "latest" | "run"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`

  const inline = process.argv.find((value) => value.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }

  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function parseSource(runId: string | undefined): RerunSource {
  const input = parseArg("--source")
  if (!input) return runId ? "run" : "latest"
  if (input === "latest" || input === "run") return input
  throw new Error("Invalid --source value. Use one of: latest, run.")
}

function parseScope(): RerunScope {
  const input = parseArg("--scope")
  if (!input) return "from-first-failed"
  if (input === "from-first-failed" || input === "to-max-failed" || input === "all-levels" || input === "failed-only") return input
  throw new Error("Invalid --scope value. Use one of: from-first-failed, to-max-failed, all-levels, failed-only.")
}

function parseRunId(): string | undefined {
  const input = parseArg("--run-id")
  if (!input) return undefined
  return sanitizeRunId(input)
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

function parseChatFirstModelIds(input: string | undefined): string[] | undefined {
  if (!input) return undefined
  const requested = normalizeModelInputList(input)
  const invalid = requested.filter((id) => !isValidModelSpecifier(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown chat-first model id(s): ${invalid.join(", ")}`)
  }
  return Array.from(new Set(requested))
}

function parseModelIdSet(flag: string): Set<string> | undefined {
  const requested = normalizeModelInputList(parseArg(flag))
  if (requested.length === 0) return undefined
  const invalid = requested.filter((id) => !isValidModelSpecifier(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown ${flag} model id(s): ${invalid.join(", ")}`)
  }
  return new Set(requested)
}

function parseTransport(input: string | undefined): TransportPolicy | undefined {
  if (!input) return undefined
  if (input === "chat-first-fallback" || input === "chat-only") return input
  throw new Error("Invalid --transport value. Use one of: chat-first-fallback, chat-only.")
}

function parseProviderOrderOverrides(input: string | undefined): Map<string, OpenRouterProviderRoutingOverride> {
  const overrides = new Map<string, OpenRouterProviderRoutingOverride>()
  if (!input) return overrides

  for (const rawEntry of input.split(",")) {
    const entry = rawEntry.trim()
    if (!entry) continue

    const separatorIndex = entry.indexOf("=")
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error("Invalid --provider-order entry. Use model=Provider|Provider.")
    }

    const modelInput = entry.slice(0, separatorIndex).trim()
    const providerOrder = entry
      .slice(separatorIndex + 1)
      .split("|")
      .map((provider) => provider.trim())
      .filter(Boolean)

    if (providerOrder.length === 0) {
      throw new Error(`Invalid --provider-order entry for ${modelInput}: missing provider list.`)
    }

    const model = parseModelIdentifier(modelInput)
    if (model.backend !== "openrouter") {
      throw new Error(`Provider routing is only supported for OpenRouter models: ${modelInput}`)
    }

    overrides.set(model.modelString, {
      order: providerOrder as NonNullable<OpenRouterProviderRoutingOverride["order"]>,
      allowFallbacks: true,
    })
  }

  return overrides
}

function isRecoverableProviderProcessError(reason: unknown): boolean {
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
    "etimedout",
    "und_err_socket",
    "other side closed",
    "socket closed",
    "fetch failed",
    "econnreset",
  ].some((pattern) => normalized.includes(pattern))
}

function formatProcessError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function installRecoverableProviderErrorHandlers(): void {
  const handleUnhandledRejection = (reason: unknown) => {
    if (isRecoverableProviderProcessError(reason)) {
      console.warn(`\nBENCH Recovered async provider error ${formatProcessError(reason)}`)
      return
    }

    process.off("unhandledRejection", handleUnhandledRejection)
    throw reason instanceof Error ? reason : new Error(String(reason))
  }

  const handleUncaughtException = (reason: Error) => {
    if (isRecoverableProviderProcessError(reason)) {
      console.warn(`\nBENCH Recovered async provider exception ${formatProcessError(reason)}`)
      return
    }

    process.off("uncaughtException", handleUncaughtException)
    throw reason
  }

  process.on("unhandledRejection", handleUnhandledRejection)
  process.on("uncaughtException", handleUncaughtException)
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

function loadBaseManifest(source: RerunSource, requestedRunId: string | undefined): { manifest: RunManifestV2; sourcePath: string } {
  const dataDir = getDataDir()
  let sourcePath: string

  if (source === "latest") {
    sourcePath = resolveLatestPublishedManifestPath(dataDir)
  } else {
    if (!requestedRunId) {
      throw new Error("Missing --run-id when --source=run.")
    }
    sourcePath = join(dataDir, `benchmark-${requestedRunId}.json`)
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`Run file not found: ${sourcePath}`)
  }

  const raw = JSON.parse(readFileSync(sourcePath, "utf-8")) as unknown
  const parsed = runManifestV2Schema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Input file is not a valid benchmark run manifest: ${sourcePath}`)
  }

  return {
    manifest: parsed.data,
    sourcePath,
  }
}

function formatStatusCounts(counts: RunManifestV2["summary"]["statusCounts"]): string {
  return `ok=${counts.ok}, model_error=${counts.model_error}, judge_error=${counts.judge_error}, aborted=${counts.aborted}, invalid_response=${counts.invalid_response}, skipped=${counts.skipped ?? 0}`
}

function ensureUniqueResultKeys(results: BenchmarkResultV2[]): void {
  const seen = new Set<string>()
  for (const row of results) {
    const key = resultKey(row)
    if (seen.has(key)) {
      throw new Error(`Duplicate result key detected after merge: ${key}`)
    }
    seen.add(key)
  }
}

function formatFailureRow(row: BenchmarkResultV2): string {
  return [
    `${row.modelId} ${row.scenarioId} L${row.level}`,
    `status=${row.status}`,
    `errorCode=${row.errorCode ?? "n/a"}`,
    `scoreability=${row.scoreabilityReason ?? "n/a"}`,
    `endpoint=${row.endpointUsed ?? "n/a"}`,
    `attempts=${row.transportAttempts ?? 0}`,
    `message=${row.errorMessage ?? "n/a"}`,
  ].join(" | ")
}

function resolveConversationMode(
  mode: RunManifestV2["metadata"]["conversationMode"] | undefined,
): ConversationMode {
  return mode === "stateless" ? "stateless" : "stateful"
}

function resolveScheduler(manifest: RunManifestV2): SchedulerMode {
  const scheduler = manifest.metadata.scheduler ?? manifest.metadata.executionConfig?.scheduler
  return scheduler === "level-wave" || scheduler === "conversation" ? scheduler : "conversation"
}

function buildSelectionMetadataFromResults(results: BenchmarkResultV2[]) {
  return buildScenarioSelectionMetadata(
    Array.from(
      new Map(
        results.map((row) => [
          row.scenarioId,
          {
            id: row.scenarioId,
            module: toModuleId(row.module),
          },
        ])
      ).values()
    )
  )
}

function cloneManifest(manifest: RunManifestV2): RunManifestV2 {
  return {
    ...manifest,
    metadata: { ...manifest.metadata },
    summary: {
      ...manifest.summary,
      statusCounts: { ...manifest.summary.statusCounts },
    },
    results: manifest.results.map((row) => ({ ...row })),
  }
}

function createDerivedRerunManifest(
  baseManifest: RunManifestV2,
  scope: RerunScope,
  pairCount: number,
): RunManifestV2 {
  const derivedRunId = sanitizeRunId(`rerun-${makeRunId()}`)
  const cloned = cloneManifest(baseManifest)

  return {
    ...cloned,
    runId: derivedRunId,
    timestamp: Date.now(),
    date: new Date().toISOString(),
    metadata: {
      ...cloned.metadata,
      totalPrompts: cloned.results.length,
      derivedFromRunId: baseManifest.runId,
      derivationKind: "rerun_failures",
      rerunScope: scope,
      rerunPairCount: pairCount,
      replacedTupleCount: 0,
    },
    summary: summarizeResults(cloned.results),
  }
}

async function main() {
  const requestedRunId = parseRunId()
  const source = parseSource(requestedRunId)
  const scope = parseScope()
  const dryRun = hasFlag("--dry-run")
  const noPublish = hasFlag("--no-publish")
  const debug = hasFlag("--debug")
  const pairConcurrency = parsePositiveIntFlag("--pair-concurrency", parseArg("--pair-concurrency")) ?? 2
  const runtimeOverrides = parseRuntimeOverrides()
  const chatFirstModelIdsOverride = parseChatFirstModelIds(parseArg("--chat-first-models"))
  const transportOverride = parseTransport(parseArg("--transport"))
  const providerRoutingOverridesByModelString = parseProviderOrderOverrides(parseArg("--provider-order"))
  const filters: PlanFilters = {
    includeModelIds: parseModelIdSet("--models"),
    excludeModelIds: parseModelIdSet("--exclude-models"),
    maxPairs: parsePositiveIntFlag("--max-pairs", parseArg("--max-pairs")),
  }

  const { manifest: baseManifest, sourcePath } = loadBaseManifest(source, requestedRunId)
  const fallbackOnTimeout = hasFlag("--no-timeout-fallback")
    ? false
    : baseManifest.metadata.fallbackOnTimeout
      ?? baseManifest.metadata.executionConfig?.fallbackOnTimeout
      ?? baseManifest.metadata.generationConfig?.fallbackOnTimeout
      ?? true
  const { failedRows, plans, plannedPrompts } = buildPlan(baseManifest, scope, filters)
  const derivedRunId = sanitizeRunId(`rerun-${makeRunId()}`)

  console.log(`Loaded source: ${sourcePath}`)
  console.log(`Source run ID: ${baseManifest.runId}`)
  console.log(`Derived run ID: ${derivedRunId}`)
  console.log(`Scope: ${scope}`)
  console.log(`Failed tuples: ${failedRows.length}`)
  console.log(`Failed scenario-model pairs: ${plans.length}`)
  console.log(`Planned prompts to rerun: ${plannedPrompts}`)
  console.log(`Pair concurrency: ${pairConcurrency}`)
  console.log("Checkpoint mode: enabled (derived run file is updated after each scenario-model pair).")
  if (debug) console.log("Debug logging: enabled")
  if (filters.includeModelIds) console.log(`Model include filter: ${Array.from(filters.includeModelIds).join(", ")}`)
  if (filters.excludeModelIds) console.log(`Model exclude filter: ${Array.from(filters.excludeModelIds).join(", ")}`)
  if (filters.maxPairs !== undefined) console.log(`Max pairs: ${filters.maxPairs}`)

  if (runtimeOverrides.timeoutMs !== undefined) console.log(`Timeout override: ${runtimeOverrides.timeoutMs}ms`)
  if (runtimeOverrides.concurrency !== undefined) console.log(`Concurrency override: ${runtimeOverrides.concurrency}`)
  if (runtimeOverrides.perModelConcurrency !== undefined) console.log(`Per-model concurrency override: ${runtimeOverrides.perModelConcurrency}`)
  if (runtimeOverrides.maxRetries !== undefined) console.log(`Retry override: maxRetries=${runtimeOverrides.maxRetries}`)
  if (runtimeOverrides.retryBackoffBaseMs !== undefined) console.log(`Retry backoff base override: ${runtimeOverrides.retryBackoffBaseMs}ms`)
  if (runtimeOverrides.retryBackoffJitterMs !== undefined) console.log(`Retry backoff jitter override: ${runtimeOverrides.retryBackoffJitterMs}ms`)
  const chatFirstModelIds = chatFirstModelIdsOverride
    ?? baseManifest.metadata.chatFirstModelIds
    ?? baseManifest.metadata.executionConfig?.chatFirstModelIds
    ?? []
  const transportPolicy = transportOverride ?? ((baseManifest.metadata.transportPolicy ?? "chat-first-fallback") as TransportPolicy)
  if (chatFirstModelIds.length > 0) console.log(`Chat-first models: ${chatFirstModelIds.join(", ")}`)
  console.log(`Transport: ${transportPolicy}`)
  console.log(`Timeout fallback: ${fallbackOnTimeout ? "yes" : "no"}`)
  if (providerRoutingOverridesByModelString.size > 0) {
    console.log(
      `Provider order overrides: ${Array.from(providerRoutingOverridesByModelString.entries())
        .map(([modelString, override]) => `${modelString}=${override.order?.join("|")}`)
        .join(", ")}`
    )
  }

  for (const plan of plans) {
    console.log(
      `  - ${plan.modelId} | ${plan.scenarioId} | failed L${plan.failedLevels.join(",L")} | rerun L${plan.rerunLevels.join(",L")}`
        + ` | replicate ${plan.replicate}`
    )
  }

  if (plans.length === 0) {
    console.log("No failed rows found. Nothing to rerun.")
    return
  }

  if (dryRun) {
    console.log("Dry run only. No model calls or file writes were performed.")
    return
  }

  let workingManifest: RunManifestV2 = {
    ...createDerivedRerunManifest(baseManifest, scope, plans.length),
    runId: derivedRunId,
  }
  writeRunManifest(workingManifest)
  let replacedCount = 0
  let pairRunFailures = 0
  let completedPairs = 0
  const limit = pLimit(pairConcurrency)
  const mergeLimit = pLimit(1)
  const pairTasks = plans.map((plan, index) =>
    limit(async () => {
      const startedAt = Date.now()
      console.log(
        `[Rerun ${index + 1}/${plans.length}] ${plan.modelId} | ${plan.scenarioId} | r${plan.replicate} | levels=${plan.rerunLevels.join(",")}`
      )

      let rerun: RunManifestV2
      try {
        const statefulPrefixRows =
          resolveConversationMode(workingManifest.metadata.conversationMode) === "stateful"
            ? buildStatefulPrefixRows(workingManifest, plan)
            : []
        const levelsToExecute = Array.from(
          new Set([
            ...statefulPrefixRows.map((row) => row.level as EscalationLevel),
            ...plan.rerunLevels,
          ])
        ).sort((a, b) => a - b) as EscalationLevel[]

        rerun = await runBenchmark({
          runId: sanitizeRunId(`rerun-${Date.now()}-${index + 1}`),
          module: plan.module,
          scenarioIds: [plan.scenarioId],
          modelIds: [plan.modelId],
          levels: levelsToExecute,
          judgeModel: workingManifest.metadata.judgeModel,
          judgeModels: workingManifest.metadata.judgeModels ?? [workingManifest.metadata.judgeModel],
          judgeStrategy: workingManifest.metadata.judgeStrategy,
          transportPolicy,
          chatFirstModelIds,
          fallbackOnTimeout,
          conversationMode: resolveConversationMode(workingManifest.metadata.conversationMode),
          scheduler: resolveScheduler(workingManifest),
          providerPrecisionPolicy: workingManifest.metadata.providerPrecisionPolicy,
          providerRoutingOverridesByModelString,
          skipModelValidation: true,
          existingResults: statefulPrefixRows,
          concurrency: runtimeOverrides.concurrency ?? 1,
          perModelConcurrency: runtimeOverrides.perModelConcurrency ?? 1,
          timeoutMs: runtimeOverrides.timeoutMs,
          maxRetries: runtimeOverrides.maxRetries,
          retryBackoffBaseMs: runtimeOverrides.retryBackoffBaseMs,
          retryBackoffJitterMs: runtimeOverrides.retryBackoffJitterMs,
          replicates: plan.replicate,
          selectedReplicates: [plan.replicate],
        })
      } catch (error) {
        pairRunFailures += 1
        console.error(
          `  Pair rerun failed (${plan.modelId} | ${plan.scenarioId}): ${error instanceof Error ? error.message : error}`
        )
        return
      }

      const rerunRowsForReplicate = rerun.results.filter((row) => (row.replicate ?? 1) === plan.replicate)
      const rerunFailedRows = rerunRowsForReplicate.filter(isFailedRow)
      if (rerunFailedRows.length > 0) {
        console.warn(`  Pair still has ${rerunFailedRows.length} failed row(s) after rerun.`)
        for (const row of rerunFailedRows) {
          if (debug) console.warn(`    [debug] ${formatFailureRow(row)}`)
        }
      }

      await mergeLimit(async () => {
        const replacementByKey = new Map<string, BenchmarkResultV2>()
        for (const row of rerunRowsForReplicate) {
          replacementByKey.set(resultKey(row), row)
        }

        let replacedThisPair = 0
        const mergedResults = workingManifest.results.map((row) => {
          const key = resultKey(row)
          const replacement = replacementByKey.get(key)
          if (!replacement) return row
          replacedThisPair += 1
          return replacement
        })

        replacedCount += replacedThisPair
        ensureUniqueResultKeys(mergedResults)

        const nextSummary = summarizeResults(mergedResults)
        workingManifest = {
          ...workingManifest,
          timestamp: Date.now(),
          date: new Date().toISOString(),
          metadata: {
            ...workingManifest.metadata,
            totalPrompts: mergedResults.length,
            scenarioCatalogVersion:
              workingManifest.metadata.scenarioCatalogVersion ?? SCENARIO_CATALOG_VERSION,
            replacedTupleCount: replacedCount,
            ...buildSelectionMetadataFromResults(mergedResults),
          },
          summary: nextSummary,
          results: mergedResults,
        }

        writeRunManifest(workingManifest)
        completedPairs += 1

        const pairStillFailed = workingManifest.results.filter(
          (row) =>
            row.scenarioId === plan.scenarioId &&
            row.modelId === plan.modelId &&
            (row.replicate ?? 1) === plan.replicate &&
            isFailedRow(row)
        ).length
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
        console.log(
          `  Checkpoint saved [${completedPairs}/${plans.length}] in ${elapsedSec}s: replaced ${replacedThisPair}, remaining failed in pair=${pairStillFailed}`
        )
      })
    })
  )
  await Promise.all(pairTasks)

  if (!noPublish) {
    publishLatest(workingManifest)
    console.log(`Updated latest: ${resolveLatestPublishedManifestPath()}`)
  } else {
    console.log("Skipped latest publish due to --no-publish.")
  }

  const initialFailed = failedRows.length
  const finalFailed = workingManifest.results.filter(isFailedRow).length
  const beforeSummary = baseManifest.summary
  const afterSummary = workingManifest.summary

  console.log(`Derived run file: public/data/benchmark-${workingManifest.runId}.json`)
  console.log(
    `Replacement stats: attempted=${initialFailed}, replaced=${replacedCount}, remainingFailed=${finalFailed}, pairRunFailures=${pairRunFailures}`
  )
  console.log(
    `Summary delta: modelSuccess ${beforeSummary.modelSuccessRate}% -> ${afterSummary.modelSuccessRate}%, scorable ${beforeSummary.scorableRate}% -> ${afterSummary.scorableRate}%`
  )
  console.log(`Status counts before: ${formatStatusCounts(beforeSummary.statusCounts)}`)
  console.log(`Status counts after:  ${formatStatusCounts(afterSummary.statusCounts)}`)
  if (debug && finalFailed > 0) {
    console.log("Remaining failed rows (debug):")
    for (const row of workingManifest.results.filter(isFailedRow)) {
      console.log(`  - ${formatFailureRow(row)}`)
    }
  }
}

installRecoverableProviderErrorHandlers()

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
