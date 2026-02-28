import { z } from "zod"
import type { BenchmarkResult } from "./types"
import type { ComplianceRating, Module } from "./types"
import {
  runIndexV2Schema,
  runManifestV2Schema,
  type RunIndexItemV2,
  type RunManifestV2,
} from "./schemas"

/** Map legacy 4-tier compliance values to the new 6-tier system. */
const LEGACY_COMPLIANCE_MAP: Record<string, ComplianceRating> = {
  principled_refusal: "principled_refusal",
  evasive_refusal: "qualified_refusal",
  partial_compliance: "uncritical_compliance",
  full_compliance: "full_compliance",
  // New values pass through
  qualified_refusal: "qualified_refusal",
  flagged_compliance: "flagged_compliance",
  uncritical_compliance: "uncritical_compliance",
  enthusiastic_compliance: "enthusiastic_compliance",
}

function migrateCompliance(raw: string): ComplianceRating {
  return LEGACY_COMPLIANCE_MAP[raw] ?? "qualified_refusal"
}

const legacyResultSchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  scenarioCategory: z.string(),
  module: z.enum(["petrov", "orwell"]),
  modelId: z.string(),
  modelLabel: z.string(),
  provider: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  compliance: z.string(),
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
  results: BenchmarkResult[]
}

function toChartResults(manifest: RunManifestV2): BenchmarkResult[] {
  return manifest.results
    .filter((result): result is typeof result & { score: number } => result.score !== null)
    .map((result) => ({
      scenarioId: result.scenarioId,
      scenarioTitle: result.scenarioTitle,
      scenarioCategory: result.scenarioCategory,
      module: result.module,
      modelId: result.modelId,
      modelLabel: result.modelLabel,
      provider: result.provider,
      level: result.level as 1 | 2 | 3 | 4 | 5,
      compliance: migrateCompliance(result.compliance),
      score: result.score,
    }))
}

function parseLegacyRun(raw: unknown): LoadedRunData | null {
  const parsed = legacyRunSchema.safeParse(raw)
  if (!parsed.success) return null

  return {
    manifest: null,
    results: parsed.data.results.map((r) => ({
      ...r,
      module: r.module as Module,
      compliance: migrateCompliance(r.compliance),
    })),
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

export interface LoadSavedRunOptions {
  latestVersion?: number
}

export async function loadSavedRun(
  runId?: string,
  options?: LoadSavedRunOptions,
): Promise<LoadedRunData | null> {
  try {
    const latestVersion = options?.latestVersion
    const latestUrl =
      latestVersion && latestVersion > 0
        ? `/data/benchmark-results.json?v=${latestVersion}`
        : "/data/benchmark-results.json"
    const url = runId ? `/data/benchmark-${runId}.json` : latestUrl
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

export async function loadSavedResults(runId?: string): Promise<BenchmarkResult[] | null> {
  const loaded = await loadSavedRun(runId)
  if (!loaded || loaded.results.length === 0) return null
  return loaded.results
}
