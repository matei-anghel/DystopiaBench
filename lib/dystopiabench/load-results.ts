import { z } from "zod"
import type { MockResult } from "./mock-data"
import {
  runIndexV2Schema,
  runManifestV2Schema,
  type RunIndexItemV2,
  type RunManifestV2,
} from "./schemas"

const legacyResultSchema: z.ZodType<MockResult> = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  scenarioCategory: z.string(),
  module: z.enum(["petrov", "orwell"]),
  modelId: z.string(),
  modelLabel: z.string(),
  provider: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  compliance: z.enum([
    "principled_refusal",
    "evasive_refusal",
    "partial_compliance",
    "full_compliance",
  ]),
  score: z.number().int().min(0).max(100),
})

const legacyRunSchema = z.object({
  runId: z.string().optional(),
  timestamp: z.number().int().optional(),
  date: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  results: z.array(legacyResultSchema),
})

export type RunIndexItem = RunIndexItemV2

export interface LoadedRunData {
  manifest: RunManifestV2 | null
  results: MockResult[]
}

let lastRequestedRunKey: string | null = null
let runSelectionVersion = 0

function toChartResults(manifest: RunManifestV2): MockResult[] {
  return manifest.results.map((result) => ({
    scenarioId: result.scenarioId,
    scenarioTitle: result.scenarioTitle,
    scenarioCategory: result.scenarioCategory,
    module: result.module,
    modelId: result.modelId,
    modelLabel: result.modelLabel,
    provider: result.provider,
    level: result.level as 1 | 2 | 3 | 4 | 5,
    compliance: result.compliance,
    score: result.score,
  }))
}

function parseLegacyRun(raw: unknown): LoadedRunData | null {
  const parsed = legacyRunSchema.safeParse(raw)
  if (!parsed.success) return null

  return {
    manifest: null,
    results: parsed.data.results,
  }
}

export async function loadRuns(): Promise<RunIndexItem[]> {
  try {
    const res = await fetch("/data/runs.json", { cache: "no-cache" })
    if (!res.ok) return []
    const parsed = runIndexV2Schema.safeParse(await res.json())
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export async function loadSavedRun(runId?: string): Promise<LoadedRunData | null> {
  try {
    const runKey = runId ?? "latest"
    if (runKey !== lastRequestedRunKey) {
      runSelectionVersion += 1
      lastRequestedRunKey = runKey
    }

    const url = runId
      ? `/data/benchmark-${runId}.json`
      : `/data/benchmark-results.json?v=${runSelectionVersion}`
    const res = await fetch(url, { cache: runId ? "force-cache" : "no-cache" })
    if (!res.ok) return null

    const json = (await res.json()) as unknown
    const v2 = runManifestV2Schema.safeParse(json)
    if (v2.success) {
      return {
        manifest: v2.data,
        results: toChartResults(v2.data),
      }
    }

    return parseLegacyRun(json)
  } catch {
    return null
  }
}

export async function loadSavedResults(runId?: string): Promise<MockResult[] | null> {
  const loaded = await loadSavedRun(runId)
  if (!loaded || loaded.results.length === 0) return null
  return loaded.results
}
