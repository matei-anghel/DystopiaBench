import { randomUUID } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { createDashboardChartPayload, createDashboardMetadata } from "./dashboard-chart-payload"
import { toChartResults } from "./load-results"
import type { RunIndexItemV2, RunManifestV2 } from "./schemas"
import { runIndexV2Schema, runManifestV2Schema } from "./schemas"

const RUN_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/
export const MODE_LATEST_FILE: Record<"stateful" | "stateless", string> = {
  stateful: "benchmark-results-stateful.json",
  stateless: "benchmark-results-stateless.json",
}
// Retired mode-agnostic alias. It always duplicated one of the per-mode files (a second
// ~100 MB copy in public/data), so publishing removes it instead of writing it.
const RETIRED_LATEST_ALIAS = "benchmark-results.json"
const MODE_CHART_FILE: Record<"stateful" | "stateless", string> = {
  stateful: "benchmark-results-stateful.chart.json",
  stateless: "benchmark-results-stateless.chart.json",
}

function resolveConversationMode(manifest: RunManifestV2): "stateful" | "stateless" {
  return manifest.metadata.conversationMode === "stateless" ? "stateless" : "stateful"
}

export function sanitizeRunId(input: string): string {
  const trimmed = input.trim()
  if (!RUN_ID_REGEX.test(trimmed)) {
    throw new Error(
      "Invalid runId. Use only letters, numbers, '_' or '-' (max 64 chars)."
    )
  }
  return trimmed
}

export function makeRunId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-")
  return sanitizeRunId(iso)
}

export function getDataDir(): string {
  return getPublicDataDir()
}

export function getPublicDataDir(): string {
  return join(process.cwd(), "public", "data")
}

export function getPrivateArtifactDir(): string {
  return join(process.cwd(), "artifacts", "private")
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function ensureDataDir() {
  return ensureDir(getPublicDataDir())
}

function ensurePrivateArtifactDir() {
  return ensureDir(getPrivateArtifactDir())
}

export function validatePrivateArtifactDir(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Invalid private artifact directory. Provide a non-empty relative folder name.")
  }
  if (
    trimmed.includes("..") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new Error("Invalid private artifact directory. Use a relative folder under artifacts/private.")
  }
  return trimmed
}

function writeJsonAtomic(filePath: string, value: unknown) {
  const dir = dirname(filePath)
  const tempPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  )
  writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf-8")
  chmodSync(tempPath, 0o644)
  renameSync(tempPath, filePath)
}

function readRunIndex(indexPath: string): RunIndexItemV2[] {
  if (!existsSync(indexPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf-8")) as unknown
    const validated = runIndexV2Schema.safeParse(parsed)
    if (validated.success) return validated.data
  } catch {
    // Ignore invalid legacy index files.
  }
  return []
}

export interface RetentionOptions {
  retainRuns?: number
  archiveDir?: string
}

export interface WriteRunManifestOptions {
  privateArtifactDir?: string
}

export interface WrittenRunManifest {
  runPath: string
  relativeRunPath: string
}

export function isPublicBenchmarkRun(manifest: RunManifestV2): boolean {
  return resolveArtifactVisibility(manifest) === "public"
}

function resolveArtifactVisibility(manifest: RunManifestV2): "public" | "private" {
  return manifest.metadata.artifactPolicy?.visibility ?? "public"
}

function sortNewestFirst(runs: RunIndexItemV2[]): RunIndexItemV2[] {
  return [...runs].sort((a, b) => b.timestamp - a.timestamp)
}

function pruneRunFiles(index: RunIndexItemV2[], dataDir: string, options: RetentionOptions) {
  if (options.retainRuns === undefined) return index

  const retainRuns = Math.max(0, Math.floor(options.retainRuns))
  const sorted = sortNewestFirst(index)
  const kept = sorted.slice(0, retainRuns)
  const removed = sorted.slice(retainRuns)

  const archivePath = options.archiveDir
    ? join(dataDir, options.archiveDir)
    : undefined
  if (archivePath && !existsSync(archivePath)) {
    mkdirSync(archivePath, { recursive: true })
  }

  for (const staleRun of removed) {
    const runFilename = `benchmark-${staleRun.id}.json`
    const runPath = join(dataDir, runFilename)
    if (!existsSync(runPath)) continue

    if (archivePath) {
      renameSync(runPath, join(archivePath, runFilename))
    } else {
      rmSync(runPath)
    }
  }

  return kept
}

export function writeRunManifest(
  manifest: RunManifestV2,
  options: WriteRunManifestOptions = {},
): WrittenRunManifest {
  const visibility = resolveArtifactVisibility(manifest)
  const privateArtifactDir = options.privateArtifactDir
    ? validatePrivateArtifactDir(options.privateArtifactDir)
    : undefined
  const dataDir = privateArtifactDir
    ? join(ensurePrivateArtifactDir(), privateArtifactDir)
    : visibility === "public"
      ? ensureDataDir()
      : join(ensurePrivateArtifactDir(), "runs")
  ensureDir(dataDir)
  manifest.metadata.artifactPolicy ??= {
    visibility: privateArtifactDir ? "private" : visibility,
    publishTargets: visibility === "public" ? ["public-dashboard", "exports"] : ["private-artifacts", "exports"],
  }
  if (privateArtifactDir) {
    manifest.metadata.artifactPolicy = {
      visibility: "private",
      publishTargets: ["private-artifacts", "exports"],
    }
  }
  const runPath = join(dataDir, `benchmark-${manifest.runId}.json`)
  writeJsonAtomic(runPath, manifest)
  return {
    runPath,
    relativeRunPath: relative(process.cwd(), runPath),
  }
}

export function resolveRunManifestPath(runId: string): string {
  const sanitized = sanitizeRunId(runId)
  const publicPath = join(getPublicDataDir(), `benchmark-${sanitized}.json`)
  if (existsSync(publicPath)) {
    return publicPath
  }

  const privatePath = join(getPrivateArtifactDir(), "runs", `benchmark-${sanitized}.json`)
  return privatePath
}

export function readRunManifest(runId: string): RunManifestV2 {
  const runPath = resolveRunManifestPath(runId)
  if (!existsSync(runPath)) {
    throw new Error(`Run file not found: ${runPath}`)
  }

  const raw = JSON.parse(readFileSync(runPath, "utf-8")) as unknown
  return runManifestV2Schema.parse(raw)
}

export function publishLatest(manifest: RunManifestV2, options: RetentionOptions = {}) {
  if (!isPublicBenchmarkRun(manifest)) {
    throw new Error(
      "Refusing to publish private artifact. Only public runs can update dashboard aliases."
    )
  }

  const dataDir = ensureDataDir()
  rmSync(join(dataDir, RETIRED_LATEST_ALIAS), { force: true })
  const mode = resolveConversationMode(manifest)
  const modeLatestPath = join(dataDir, MODE_LATEST_FILE[mode])
  writeJsonAtomic(modeLatestPath, manifest)
  writeJsonAtomic(join(dataDir, MODE_CHART_FILE[mode]), createDashboardChartPayload(manifest, toChartResults(manifest)))

  const indexPath = join(dataDir, "runs.json")
  const index = readRunIndex(indexPath)
  const item: RunIndexItemV2 = {
    id: manifest.runId,
    timestamp: manifest.timestamp,
    date: manifest.date,
    metadata: createDashboardMetadata(manifest.metadata),
    summary: manifest.summary,
  }

  const nextIndex = [...index]
  const existingIndex = nextIndex.findIndex((entry) => entry.id === item.id)
  if (existingIndex >= 0) {
    nextIndex[existingIndex] = item
  } else {
    nextIndex.unshift(item)
  }

  const prunedIndex = pruneRunFiles(nextIndex, dataDir, options)
  writeJsonAtomic(indexPath, prunedIndex)
}
