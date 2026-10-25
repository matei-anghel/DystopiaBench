import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createOpenAI } from "@ai-sdk/openai"
import { OpenRouter } from "@openrouter/sdk"
import pLimit from "p-limit"
import { GENERATION_CONFIG, runManifestV2Schema, type BenchmarkResultV2, type RunManifestV2, type TokenUsageSummary } from "../lib/dystopiabench/schemas"
import {
  JUDGE_PROMPT_VERSION,
  buildJudgePanelRecord,
  evaluateResponseWithJudges,
  summarizeResults,
  type JudgeStrategy,
  type TransportPolicy,
} from "../lib/dystopiabench/runner"
import { parseModelIdentifier } from "../lib/dystopiabench/model-selectors"
import {
  getDataDir,
  getPrivateArtifactDir,
  makeRunId,
  publishLatest,
  resolveLatestPublishedManifestPath,
  sanitizeRunId,
  validatePrivateArtifactDir,
  writeRunManifest,
} from "../lib/dystopiabench/storage"
import {
  getLiteLLMBaseUrl,
  getLocalOpenAIApiKey,
  getLocalOpenAIBaseUrl,
  getOpenRouterAppTitle,
  getOpenRouterHttpReferer,
  requireLiteLLMApiKey,
  requireOpenRouterApiKey,
} from "../lib/dystopiabench/env"

type Source = "latest" | "run"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const inline = process.argv.find((value) => value.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function parsePositiveInt(flag: string, fallback: number): number {
  const input = parseArg(flag)
  if (!input) return fallback
  const value = Number(input)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${flag}; use a positive integer.`)
  return value
}

function parseTransport(input: string | undefined): TransportPolicy | undefined {
  if (!input) return undefined
  if (input === "chat-first-fallback" || input === "chat-only") return input
  throw new Error("Invalid --transport value. Use one of: chat-first-fallback, chat-only.")
}

function parseSource(runId: string | undefined): Source {
  const input = parseArg("--source")
  if (!input) return runId ? "run" : "latest"
  if (input === "latest" || input === "run") return input
  throw new Error("Invalid --source value. Use one of: latest, run.")
}

function parseModelSet(flag: string): Set<string> | undefined {
  const input = parseArg(flag)
  if (!input) return undefined
  const values = input.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
  return values.length > 0 ? new Set(values) : undefined
}

function loadManifest(
  source: Source,
  runId: string | undefined,
  privateArtifactDir: string | undefined,
): { manifest: RunManifestV2; sourcePath: string } {
  if (privateArtifactDir && source === "latest") {
    throw new Error("--private-artifact-dir requires --run-id; private runs have no latest alias.")
  }
  const dataDir = privateArtifactDir
    ? join(getPrivateArtifactDir(), privateArtifactDir)
    : getDataDir()
  const sourcePath =
    source === "latest"
      ? resolveLatestPublishedManifestPath(dataDir)
      : join(dataDir, `benchmark-${sanitizeRunId(runId ?? "")}.json`)

  if (!existsSync(sourcePath)) throw new Error(`Run file not found: ${sourcePath}`)
  const parsed = runManifestV2Schema.safeParse(JSON.parse(readFileSync(sourcePath, "utf8")) as unknown)
  if (!parsed.success) throw new Error(`Input file is not a valid benchmark run manifest: ${sourcePath}`)
  return { manifest: parsed.data, sourcePath }
}

function addUsage(left: TokenUsageSummary | undefined, right: TokenUsageSummary): TokenUsageSummary {
  return {
    inputTokens: (left?.inputTokens ?? 0) + right.inputTokens,
    cachedInputTokens: (left?.cachedInputTokens ?? 0) + right.cachedInputTokens,
    uncachedInputTokens: (left?.uncachedInputTokens ?? 0) + right.uncachedInputTokens,
    outputTokens: (left?.outputTokens ?? 0) + right.outputTokens,
    textOutputTokens: (left?.textOutputTokens ?? 0) + right.textOutputTokens,
    reasoningTokens: (left?.reasoningTokens ?? 0) + right.reasoningTokens,
    totalTokens: (left?.totalTokens ?? 0) + right.totalTokens,
  }
}

function isJudgeFailed(row: BenchmarkResultV2): boolean {
  return row.status === "judge_error" || row.errorCode === "JUDGE_FAILED"
}

async function main() {
  const requestedRunId = parseArg("--run-id")
  const source = parseSource(requestedRunId)
  const noPublish = hasFlag("--no-publish")
  const dryRun = hasFlag("--dry-run")
  const concurrency = parsePositiveInt("--concurrency", 6)
  const timeoutMs = parsePositiveInt("--timeout-ms", GENERATION_CONFIG.timeoutMs)
  const includeModels = parseModelSet("--models")
  const excludeModels = parseModelSet("--exclude-models")
  const transportPolicy = parseTransport(parseArg("--transport")) ?? "chat-first-fallback"
  const fallbackOnTimeout = !hasFlag("--no-timeout-fallback")
  const privateArtifactDirArg = parseArg("--private-artifact-dir")
  const privateArtifactDir = privateArtifactDirArg ? validatePrivateArtifactDir(privateArtifactDirArg) : undefined

  const { manifest: sourceManifest, sourcePath } = loadManifest(source, requestedRunId, privateArtifactDir)
  const judgeStrategy = (sourceManifest.metadata.judgeStrategy ?? "pair-with-tiebreak") as JudgeStrategy
  const judgeModelIds = sourceManifest.metadata.judgeModels ?? [sourceManifest.metadata.judgeModel]
  const judgeModels = judgeModelIds.map((id) => parseModelIdentifier(id))
  const judgeTieBreakerModel = judgeStrategy === "pair-with-tiebreak" ? judgeModels[2]?.id : undefined

  let workingManifest: RunManifestV2 = {
    ...sourceManifest,
    runId: sanitizeRunId(`rerun-${makeRunId()}`),
    timestamp: Date.now(),
    date: new Date().toISOString(),
    metadata: {
      ...sourceManifest.metadata,
      derivedFromRunId: sourceManifest.runId,
      derivationKind: "rerun_failures",
      judgeStrategy,
      judgeModels: judgeModelIds,
      judgeModel: judgeModelIds[0],
    },
    results: sourceManifest.results.map((row) => ({ ...row })),
  }

  const targets = workingManifest.results.filter((row) => {
    if (!isJudgeFailed(row)) return false
    if (!row.response || row.response.trim().length === 0) return false
    if (includeModels && !includeModels.has(row.modelId)) return false
    if (excludeModels?.has(row.modelId)) return false
    return true
  })

  console.log(`Loaded source: ${sourcePath}`)
  console.log(`Source run ID: ${sourceManifest.runId}`)
  console.log(`Derived run ID: ${workingManifest.runId}`)
  console.log(`Judge strategy: ${judgeStrategy}`)
  console.log(`Judge models: ${judgeModelIds.join(", ")}`)
  console.log(`Judge-failed rows to rescore: ${targets.length}`)
  console.log(`Concurrency: ${concurrency}`)
  console.log(`Transport: ${transportPolicy}`)
  console.log(`Timeout: ${timeoutMs}ms`)

  if (targets.length === 0 || dryRun) {
    if (dryRun) console.log("Dry run only. No judge calls or file writes were performed.")
    return
  }

  const requiresOpenRouter = judgeModels.some((model) => model.backend === "openrouter")
  const requiresLocal = judgeModels.some((model) => model.backend === "local")
  const requiresLiteLLM = judgeModels.some((model) => model.backend === "litellm")
  const openRouterApiKey = requiresOpenRouter ? requireOpenRouterApiKey() : undefined
  const localBaseUrl = requiresLocal ? getLocalOpenAIBaseUrl() : undefined
  const liteLLMApiKey = requiresLiteLLM ? requireLiteLLMApiKey() : undefined
  const liteLLMBaseUrl = requiresLiteLLM ? getLiteLLMBaseUrl() : undefined

  if (requiresLocal && !localBaseUrl) {
    throw new Error("Missing LOCAL_OPENAI_BASE_URL. Configure this variable to rescore local judge models.")
  }
  if (requiresLiteLLM && !liteLLMBaseUrl) {
    throw new Error("Missing LITELLM_BASE_URL. Configure this variable to rescore LiteLLM judge models.")
  }

  const apiClients = {
    openrouter: requiresOpenRouter
      ? new OpenRouter({
        apiKey: openRouterApiKey ?? "",
        httpReferer: getOpenRouterHttpReferer(),
        appTitle: getOpenRouterAppTitle(),
        retryConfig: { strategy: "none" },
      })
      : undefined,
    local: requiresLocal && localBaseUrl
      ? createOpenAI({
        apiKey: getLocalOpenAIApiKey(),
        baseURL: localBaseUrl,
      })
      : undefined,
    litellm: requiresLiteLLM && liteLLMBaseUrl
      ? {
        apiKey: liteLLMApiKey ?? "",
        baseURL: liteLLMBaseUrl,
      }
      : undefined,
  }

  let writtenManifest = writeRunManifest(workingManifest, { privateArtifactDir })
  const limit = pLimit(concurrency)
  const mergeLimit = pLimit(1)
  let rescored = 0
  let failed = 0

  await Promise.all(targets.map((target, index) =>
    limit(async () => {
      try {
        const judged = await evaluateResponseWithJudges({
          apiClients,
          openRouterApiKey,
          judgeStrategy,
          judgeModels,
          benchmarkPrompt: target.prompt,
          modelResponse: target.response,
          scenarioId: target.scenarioId,
          transportPolicy,
          timeoutMs,
          fallbackOnTimeout,
          providerOverridesByModelString: new Map(),
        })

        await mergeLimit(async () => {
          workingManifest = {
            ...workingManifest,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            results: workingManifest.results.map((row) => {
              if (row.sampleId !== target.sampleId) return row
              const judgeEstimatedCostUsd = judged.cost
              const modelEstimatedCostUsd = row.modelEstimatedCostUsd ?? { inputUsd: 0, outputUsd: 0, totalUsd: 0 }
              const modelUsage = row.modelUsage
              const modelLatencyMs = row.timing?.modelLatencyMs ?? 0
              return {
                ...row,
                compliance: judged.compliance,
                primaryComplianceLabel: judged.compliance,
                score: judged.score,
                status: "ok",
                judgeReasoning: judged.reasoning,
                judgeVotes: judged.judgeVotes,
                judgePanel: buildJudgePanelRecord({
                  judgeStrategy,
                  judgeModelIds,
                  judgeTieBreakerModel,
                  judgePromptVersion: JUDGE_PROMPT_VERSION,
                  judgeVotes: judged.judgeVotes,
                  finalCompliance: judged.compliance,
                  finalScore: judged.score,
                  finalReasoning: judged.reasoning,
                }),
                confidence:
                  judged.judgeVotes.length <= 1
                    ? 0.8
                    : judged.judgeVotes.every((vote) => vote.compliance === judged.compliance)
                      ? 1
                      : 0.66,
                adjudicationSource: judged.judgeVotes.length <= 1 ? "single-judge" : "judge-panel",
                scorable: true,
                errorCode: undefined,
                errorMessage: undefined,
                errorName: undefined,
                judgeUsage: judged.usage,
                totalUsage: addUsage(modelUsage, judged.usage),
                judgeEstimatedCostUsd,
                estimatedCostUsd: {
                  modelUsd: modelEstimatedCostUsd.totalUsd,
                  judgeUsd: judgeEstimatedCostUsd.totalUsd,
                  totalUsd: Number((modelEstimatedCostUsd.totalUsd + judgeEstimatedCostUsd.totalUsd).toFixed(6)),
                },
                timing: {
                  ...row.timing,
                  modelLatencyMs,
                  judgeLatencyMs: judged.latencyMs,
                  totalLatencyMs: modelLatencyMs + judged.latencyMs,
                },
              } satisfies BenchmarkResultV2
            }),
          }
          workingManifest = {
            ...workingManifest,
            summary: summarizeResults(workingManifest.results),
          }
          rescored += 1
          writtenManifest = writeRunManifest(workingManifest, { privateArtifactDir })
          console.log(
            `[Rescore ${rescored}/${targets.length}] ${target.modelId} ${target.scenarioId} L${target.level} r${target.replicate}: ${judged.compliance} ${judged.score}`
          )
        })
      } catch (error) {
        failed += 1
        console.warn(
          `[Rescore failed ${index + 1}/${targets.length}] ${target.modelId} ${target.scenarioId} L${target.level} r${target.replicate}: ` +
          `${error instanceof Error ? error.message : error}`
        )
      }
    })
  ))

  if (!noPublish && !privateArtifactDir) {
    publishLatest(workingManifest)
    console.log(`Updated latest: ${resolveLatestPublishedManifestPath()}`)
  } else if (privateArtifactDir) {
    console.log("Private artifact run: latest aliases not updated.")
  }

  console.log(`Derived run file: ${writtenManifest.relativeRunPath}`)
  console.log(`Judge rescore stats: attempted=${targets.length}, rescored=${rescored}, failed=${failed}`)
  console.log(`Remaining failed rows: ${workingManifest.results.filter((row) => row.scorable !== true).length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
