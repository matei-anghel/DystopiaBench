import type { BenchmarkResult } from "./types"
import type { ComplianceRating } from "./types"
import { toModuleId } from "./types"
import { filterChartableManifestResults } from "./chart-results"
import { isDashboardDisplayCompatibleMetadata } from "./display-compat"
import { aggregateResultsByTuple } from "./repeat-aggregation"
import { getDashboardModelSelectionVersion } from "./dashboard-model-selection"
import {
  dashboardChartPayloadSchema,
  runIndexV2Schema,
  runManifestV2Schema,
  type DashboardChartPayload,
  type RunIndexItemV2,
  type RunManifestV2,
} from "./schemas"
import { getModelById } from "./models"

export type RunIndexItem = RunIndexItemV2
export type RunConversationMode = "stateful" | "stateless"

export function normalizeConversationMode(
  mode: RunManifestV2["metadata"]["conversationMode"] | undefined,
): RunConversationMode {
  return mode === "stateless" ? "stateless" : "stateful"
}

export function getRunConversationMode(run: RunIndexItemV2): RunConversationMode {
  return normalizeConversationMode(run.metadata.conversationMode)
}

export interface LoadedRunData {
  manifest: RunManifestV2 | null
  results: BenchmarkResult[]
  chartPayload?: DashboardChartPayload
}

export function toChartResults(manifest: RunManifestV2): BenchmarkResult[] {
  return aggregateResultsByTuple(filterChartableManifestResults(manifest))
    .filter((result): result is typeof result & { score: number } => typeof result.score === "number")
    .map((result) => {
      const model = getModelById(result.modelId)
      return {
        scenarioId: result.scenarioId,
        ...(result.canonicalScenarioId ? { canonicalScenarioId: result.canonicalScenarioId } : {}),
        scenarioTitle: result.scenarioTitle,
        scenarioCategory: result.scenarioCategory,
        module: toModuleId(result.module),
        modelId: result.modelId,
        modelLabel: model?.label ?? result.modelLabel,
        provider: model?.provider ?? result.provider,
        level: result.level as 1 | 2 | 3 | 4 | 5,
        compliance: result.compliance as ComplianceRating,
        score: Math.round(result.score),
        replicateCount: result.observedReplicates,
        scoreStdDev: result.scoreStdDev,
        ...(typeof result.refusalRate === "number" ? { refusalRate: result.refusalRate } : {}),
      }
    })
}

function normalizeManifestConversationMode(manifest: RunManifestV2): RunManifestV2 {
  if (manifest.metadata.conversationMode) return manifest
  return {
    ...manifest,
    metadata: {
      ...manifest.metadata,
      conversationMode: "stateful",
    },
  }
}

export async function loadRuns(): Promise<RunIndexItem[]> {
  try {
    const modelSelectionVersion = getDashboardModelSelectionVersion()
    const res = await fetch(`/data/runs.json?v=${encodeURIComponent(modelSelectionVersion)}`, { cache: "no-cache" })
    if (!res.ok) return []
    const parsed = runIndexV2Schema.safeParse(await res.json())
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export interface LoadSavedRunOptions {
  latestVersion?: number | string
  latestMode?: RunConversationMode
  expectedMode?: RunConversationMode
}

const savedRunCache = new Map<string, Promise<LoadedRunData | null>>()

async function readJsonResponse(res: Response): Promise<unknown> {
  if (!res.url.endsWith(".gz")) {
    return (await res.json()) as unknown
  }

  const stream = res.body
  if (!stream || typeof DecompressionStream === "undefined") {
    return JSON.parse(new TextDecoder().decode(await res.arrayBuffer())) as unknown
  }

  const decompressed = stream.pipeThrough(new DecompressionStream("gzip"))
  return JSON.parse(await new Response(decompressed).text()) as unknown
}

function getSavedRunCacheKey(runId?: string, options?: LoadSavedRunOptions): string {
  return JSON.stringify({
    runId: runId ?? "latest",
    latestVersion: options?.latestVersion ?? "",
    latestMode: options?.latestMode ?? "",
    expectedMode: options?.expectedMode ?? "",
  })
}

async function loadSavedRunUncached(
  runId?: string,
  options?: LoadSavedRunOptions,
): Promise<LoadedRunData | null> {
  try {
    const latestVersion = options?.latestVersion
    const latestMode = options?.latestMode
    const expectedMode = options?.expectedMode
    const decorateVersion = (path: string) =>
      latestVersion !== undefined && latestVersion !== "" ? `${path}?v=${encodeURIComponent(String(latestVersion))}` : path
    const urlCandidates = runId
      ? [
          decorateVersion(`/data/benchmark-${runId}.chart.json`),
          decorateVersion(`/data/benchmark-${runId}.json.gz`),
          decorateVersion(`/data/benchmark-${runId}.json`),
        ]
      : latestMode === "stateless"
        ? [
          decorateVersion("/data/benchmark-results-stateless.chart.json"),
          decorateVersion("/data/benchmark-results-stateless.json"),
        ]
        : latestMode === "stateful"
        ? [
          decorateVersion("/data/benchmark-results-stateful.chart.json"),
          decorateVersion("/data/benchmark-results-stateful.json"),
          decorateVersion("/data/benchmark-results-stateful.json.gz"),
          decorateVersion("/data/benchmark-results.json.gz"),
          decorateVersion("/data/benchmark-results.json"),
        ]
          : [decorateVersion("/data/benchmark-results.json.gz"), decorateVersion("/data/benchmark-results.json")]

    for (const url of urlCandidates) {
      const res = await fetch(url, { cache: "force-cache" })
      if (!res.ok) continue

      const json = await readJsonResponse(res)
      const chartPayload = dashboardChartPayloadSchema.safeParse(json)
      if (chartPayload.success) {
        if (expectedMode && chartPayload.data.conversationMode !== expectedMode) {
          continue
        }
        if (!isDashboardDisplayCompatibleMetadata(chartPayload.data.metadata)) {
          continue
        }
        if (chartPayload.data.results.length === 0) {
          continue
        }
        return {
          manifest: null,
          results: chartPayload.data.results.map((result) => ({
            ...result,
            module: toModuleId(result.module),
          })),
          chartPayload: chartPayload.data,
        }
      }

      const manifest = runManifestV2Schema.safeParse(json)
      if (manifest.success) {
        const normalizedManifest = normalizeManifestConversationMode(manifest.data)
        const normalizedMode = normalizeConversationMode(normalizedManifest.metadata.conversationMode)
        if (!runId && normalizedMode === "stateful" && !isDashboardDisplayCompatibleMetadata(normalizedManifest.metadata)) {
          continue
        }
        if (expectedMode && normalizedMode !== expectedMode) {
          continue
        }
        const results = toChartResults(normalizedManifest)
        if (!runId && results.length === 0) {
          continue
        }
        return {
          manifest: normalizedManifest,
          results,
        }
      }
    }

    return null
  } catch {
    return null
  }
}

export async function loadSavedRun(
  runId?: string,
  options?: LoadSavedRunOptions,
): Promise<LoadedRunData | null> {
  const cacheKey = getSavedRunCacheKey(runId, options)
  const cached = savedRunCache.get(cacheKey)
  if (cached) return cached

  const pending = loadSavedRunUncached(runId, options).then((loaded) => {
    if (!loaded) {
      savedRunCache.delete(cacheKey)
    }
    return loaded
  })
  savedRunCache.set(cacheKey, pending)
  return pending
}
