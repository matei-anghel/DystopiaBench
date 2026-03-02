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
  type RunBenchmarkOptions,
  type TransportPolicy,
} from "../lib/dystopiabench/runner"
import { getDataDir, publishLatest, sanitizeRunId, writeRunManifest } from "../lib/dystopiabench/storage"

type RerunSource = "latest" | "run"
type RerunScope = "to-max-failed" | "all-levels" | "failed-only"
type EscalationLevel = 1 | 2 | 3 | 4 | 5

interface FailedPairPlan {
  scenarioId: string
  modelId: string
  module: "petrov" | "orwell"
  failedLevels: EscalationLevel[]
  rerunLevels: EscalationLevel[]
}

const ALL_LEVELS: EscalationLevel[] = [1, 2, 3, 4, 5]

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
  if (!input) return "to-max-failed"
  if (input === "to-max-failed" || input === "all-levels" || input === "failed-only") return input
  throw new Error("Invalid --scope value. Use one of: to-max-failed, all-levels, failed-only.")
}

function parseRunId(): string | undefined {
  const input = parseArg("--run-id")
  if (!input) return undefined
  return sanitizeRunId(input)
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

function resultKey(row: Pick<BenchmarkResultV2, "scenarioId" | "modelId" | "level">): string {
  return `${row.scenarioId}::${row.modelId}::${row.level}`
}

function pairKey(row: Pick<BenchmarkResultV2, "scenarioId" | "modelId">): string {
  return `${row.scenarioId}::${row.modelId}`
}

function isFailedRow(row: BenchmarkResultV2): boolean {
  return row.scorable !== true
}

function toSortedLevels(levels: Iterable<number>): EscalationLevel[] {
  const deduped = Array.from(new Set(levels))
    .filter((value): value is EscalationLevel => Number.isInteger(value) && value >= 1 && value <= 5)
    .sort((a, b) => a - b)
  return deduped
}

function buildRerunLevels(scope: RerunScope, failedLevels: EscalationLevel[]): EscalationLevel[] {
  if (scope === "all-levels") return [...ALL_LEVELS]
  if (scope === "failed-only") return [...failedLevels]
  const maxFailed = Math.max(...failedLevels)
  return ALL_LEVELS.filter((level) => level <= maxFailed)
}

function loadBaseManifest(source: RerunSource, requestedRunId: string | undefined): { manifest: RunManifestV2; sourcePath: string } {
  const dataDir = getDataDir()
  let sourcePath: string

  if (source === "latest") {
    sourcePath = join(dataDir, "benchmark-results.json")
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
    throw new Error(`Input file is not a valid v2 run manifest: ${sourcePath}`)
  }

  return {
    manifest: parsed.data,
    sourcePath,
  }
}

function buildPlan(manifest: RunManifestV2, scope: RerunScope): {
  failedRows: BenchmarkResultV2[]
  failedKeySet: Set<string>
  plans: FailedPairPlan[]
  plannedPrompts: number
} {
  const failedRows = manifest.results.filter(isFailedRow)
  const failedKeySet = new Set(failedRows.map(resultKey))

  const byPair = new Map<string, FailedPairPlan>()
  for (const row of failedRows) {
    const level = row.level as EscalationLevel
    const key = pairKey(row)
    const existing = byPair.get(key)
    if (!existing) {
      byPair.set(key, {
        scenarioId: row.scenarioId,
        modelId: row.modelId,
        module: row.module,
        failedLevels: [level],
        rerunLevels: [],
      })
      continue
    }
    existing.failedLevels.push(level)
  }

  const plans = Array.from(byPair.values())
    .map((entry) => {
      const failedLevels = toSortedLevels(entry.failedLevels)
      return {
        ...entry,
        failedLevels,
        rerunLevels: buildRerunLevels(scope, failedLevels),
      }
    })
    .sort((a, b) => {
      if (a.scenarioId === b.scenarioId) return a.modelId.localeCompare(b.modelId)
      return a.scenarioId.localeCompare(b.scenarioId)
    })

  const plannedPrompts = plans.reduce((sum, item) => sum + item.rerunLevels.length, 0)

  return { failedRows, failedKeySet, plans, plannedPrompts }
}

function formatStatusCounts(counts: RunManifestV2["summary"]["statusCounts"]): string {
  return `ok=${counts.ok}, model_error=${counts.model_error}, judge_error=${counts.judge_error}, aborted=${counts.aborted}, invalid_response=${counts.invalid_response}`
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
    `endpoint=${row.endpointUsed ?? "n/a"}`,
    `attempts=${row.transportAttempts ?? 0}`,
    `message=${row.errorMessage ?? "n/a"}`,
  ].join(" | ")
}

function coerceEmptyToRefusal(row: BenchmarkResultV2): BenchmarkResultV2 {
  if (row.status !== "invalid_response" || row.errorCode !== "EMPTY_MODEL_RESPONSE") {
    return row
  }

  return {
    ...row,
    response: row.response.trim()
      ? row.response
      : "Unable to provide the requested content.",
    compliance: "refusal",
    score: 0,
    status: "ok",
    scorable: true,
    judgeReasoning:
      "Provider returned empty response after all retries; treated as implicit refusal for scoring continuity.",
    errorCode: "EMPTY_MODEL_RESPONSE_TREATED_AS_REFUSAL",
    timestamp: Date.now(),
  }
}

async function main() {
  const requestedRunId = parseRunId()
  const source = parseSource(requestedRunId)
  const scope = parseScope()
  const dryRun = hasFlag("--dry-run")
  const noPublish = hasFlag("--no-publish")
  const debug = hasFlag("--debug")
  const emptyAsRefusal = hasFlag("--empty-as-refusal")
  const pairConcurrency = parsePositiveIntFlag("--pair-concurrency", parseArg("--pair-concurrency")) ?? 2
  const runtimeOverrides = parseRuntimeOverrides()

  const { manifest: baseManifest, sourcePath } = loadBaseManifest(source, requestedRunId)
  const { failedRows, plans, plannedPrompts } = buildPlan(baseManifest, scope)

  console.log(`Loaded source: ${sourcePath}`)
  console.log(`Run ID: ${baseManifest.runId}`)
  console.log(`Scope: ${scope}`)
  console.log(`Failed tuples: ${failedRows.length}`)
  console.log(`Failed scenario-model pairs: ${plans.length}`)
  console.log(`Planned prompts to rerun: ${plannedPrompts}`)
  console.log(`Pair concurrency: ${pairConcurrency}`)
  console.log("Checkpoint mode: enabled (run file is updated after each scenario-model pair).")
  if (debug) console.log("Debug logging: enabled")
  if (emptyAsRefusal) console.log("Policy: empty responses will be coerced to refusal.")

  if (runtimeOverrides.timeoutMs !== undefined) console.log(`Timeout override: ${runtimeOverrides.timeoutMs}ms`)
  if (runtimeOverrides.concurrency !== undefined) console.log(`Concurrency override: ${runtimeOverrides.concurrency}`)
  if (runtimeOverrides.perModelConcurrency !== undefined) console.log(`Per-model concurrency override: ${runtimeOverrides.perModelConcurrency}`)
  if (runtimeOverrides.maxRetries !== undefined) console.log(`Retry override: maxRetries=${runtimeOverrides.maxRetries}`)
  if (runtimeOverrides.retryBackoffBaseMs !== undefined) console.log(`Retry backoff base override: ${runtimeOverrides.retryBackoffBaseMs}ms`)
  if (runtimeOverrides.retryBackoffJitterMs !== undefined) console.log(`Retry backoff jitter override: ${runtimeOverrides.retryBackoffJitterMs}ms`)

  for (const plan of plans) {
    console.log(
      `  - ${plan.modelId} | ${plan.scenarioId} | failed L${plan.failedLevels.join(",L")} | rerun L${plan.rerunLevels.join(",L")}`
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

  let workingManifest: RunManifestV2 = baseManifest
  let replacedCount = 0
  let pairRunFailures = 0
  let completedPairs = 0
  const limit = pLimit(pairConcurrency)
  const mergeLimit = pLimit(1)
  const pairTasks = plans.map((plan, index) =>
    limit(async () => {
      const startedAt = Date.now()
      console.log(
        `[Rerun ${index + 1}/${plans.length}] ${plan.modelId} | ${plan.scenarioId} | levels=${plan.rerunLevels.join(",")}`
      )

      let rerun: RunManifestV2
      try {
        rerun = await runBenchmark({
          runId: sanitizeRunId(`rerun-${Date.now()}-${index + 1}`),
          module: plan.module,
          scenarioIds: [plan.scenarioId],
          modelIds: [plan.modelId],
          levels: plan.rerunLevels,
          judgeModel: workingManifest.metadata.judgeModel,
          transportPolicy: (workingManifest.metadata.transportPolicy ?? "chat-first-fallback") as TransportPolicy,
          conversationMode: (workingManifest.metadata.conversationMode ?? "stateful") as ConversationMode,
          skipModelValidation: true,
          concurrency: runtimeOverrides.concurrency ?? 1,
          perModelConcurrency: runtimeOverrides.perModelConcurrency ?? 1,
          timeoutMs: runtimeOverrides.timeoutMs,
          maxRetries: runtimeOverrides.maxRetries,
          retryBackoffBaseMs: runtimeOverrides.retryBackoffBaseMs,
          retryBackoffJitterMs: runtimeOverrides.retryBackoffJitterMs,
        })
      } catch (error) {
        pairRunFailures += 1
        console.error(
          `  Pair rerun failed (${plan.modelId} | ${plan.scenarioId}): ${error instanceof Error ? error.message : error}`
        )
        return
      }

      const normalizedRerunResults = emptyAsRefusal
        ? rerun.results.map(coerceEmptyToRefusal)
        : rerun.results

      const rerunFailedRows = normalizedRerunResults.filter(isFailedRow)
      if (rerunFailedRows.length > 0) {
        console.warn(`  Pair still has ${rerunFailedRows.length} failed row(s) after rerun.`)
        for (const row of rerunFailedRows) {
          if (debug) console.warn(`    [debug] ${formatFailureRow(row)}`)
        }
      }

      await mergeLimit(async () => {
        const replacementByKey = new Map<string, BenchmarkResultV2>()
        for (const row of normalizedRerunResults) {
          replacementByKey.set(resultKey(row), row)
        }

        const pairFailedKeys = new Set(
          workingManifest.results
            .filter((row) => row.scenarioId === plan.scenarioId && row.modelId === plan.modelId && isFailedRow(row))
            .map(resultKey)
        )

        let replacedThisPair = 0
        const mergedResults = workingManifest.results.map((row) => {
          const key = resultKey(row)
          if (!pairFailedKeys.has(key)) return row
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
          },
          summary: nextSummary,
          results: mergedResults,
        }

        writeRunManifest(workingManifest)
        completedPairs += 1

        const pairStillFailed = workingManifest.results.filter(
          (row) => row.scenarioId === plan.scenarioId && row.modelId === plan.modelId && isFailedRow(row)
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
    console.log("Updated latest: public/data/benchmark-results.json")
  } else {
    console.log("Skipped latest publish due to --no-publish.")
  }

  const initialFailed = failedRows.length
  const finalFailed = workingManifest.results.filter(isFailedRow).length
  const beforeSummary = baseManifest.summary
  const afterSummary = workingManifest.summary

  console.log(`Updated run file: public/data/benchmark-${workingManifest.runId}.json`)
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
