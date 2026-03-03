import { z } from "zod"
import type { BenchmarkResult } from "./types"
import type { ComplianceRating, Module } from "./types"
import {
  runIndexV2Schema,
  runManifestV2Schema,
  type RunIndexItemV2,
  type RunManifestV2,
} from "./schemas"

/** Map legacy compliance values to the new 4-tier attitude scale. */
const LEGACY_COMPLIANCE_MAP: Record<string, ComplianceRating> = {
  // Legacy 4-tier keys
  principled_refusal: "refusal",
  evasive_refusal: "refusal",
  partial_compliance: "compliant",
  full_compliance: "proactive",
  // Previous 6-tier keys
  qualified_refusal: "hesitant",
  flagged_compliance: "hesitant",
  uncritical_compliance: "compliant",
  enthusiastic_compliance: "proactive",
  // New 4-tier keys pass through
  refusal: "refusal",
  hesitant: "hesitant",
  compliant: "compliant",
  proactive: "proactive",
}

function migrateCompliance(raw: string): ComplianceRating {
  return LEGACY_COMPLIANCE_MAP[raw] ?? "hesitant"
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
  latestMode?: RunConversationMode
}

export async function loadSavedRun(
  runId?: string,
  options?: LoadSavedRunOptions,
): Promise<LoadedRunData | null> {
  try {
    const latestVersion = options?.latestVersion
    const latestMode = options?.latestMode
    const decorateVersion = (path: string) =>
      latestVersion && latestVersion > 0 ? `${path}?v=${latestVersion}` : path
    const urlCandidates = runId
      ? [`/data/benchmark-${runId}.json`]
      : latestMode === "stateless"
        ? [decorateVersion("/data/benchmark-results-stateless.json")]
        : latestMode === "stateful"
          ? [
            decorateVersion("/data/benchmark-results-stateful.json"),
            decorateVersion("/data/benchmark-results.json"),
          ]
          : [decorateVersion("/data/benchmark-results.json")]

    for (const url of urlCandidates) {
      const res = await fetch(url, { cache: runId ? "force-cache" : "no-cache" })
      if (!res.ok) continue

      const json = (await res.json()) as unknown
      const v2 = runManifestV2Schema.safeParse(json)
      if (v2.success) {
        const normalizedManifest = normalizeManifestConversationMode(v2.data)
        return {
          manifest: normalizedManifest,
          results: toChartResults(normalizedManifest),
        }
      }

      const legacy = parseLegacyRun(json)
      if (legacy) {
        return legacy
      }
    }

    return null
  } catch {
    return null
  }
}

export async function loadSavedResults(runId?: string): Promise<BenchmarkResult[] | null> {
  const loaded = await loadSavedRun(runId)
  if (!loaded || loaded.results.length === 0) return null
  return loaded.results
}
