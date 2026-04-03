import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import { createEvalCard } from "./eval-card"
import type { RunIndexItemV2, RunManifestV2 } from "./schemas"
import { runIndexV2Schema, runManifestV2Schema } from "./schemas"

const RUN_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/
const MODE_LATEST_FILE: Record<"stateful" | "stateless", string> = {
  stateful: "benchmark-results-stateful.json",
  stateless: "benchmark-results-stateless.json",
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

function getEvalCardDir(visibility: "public" | "private"): string {
  return visibility === "public"
    ? join(getPublicDataDir(), "eval-cards")
    : join(getPrivateArtifactDir(), "eval-cards")
}

function writeJsonAtomic(filePath: string, value: unknown) {
  const dir = dirname(filePath)
  const tempPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
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
  allowNonPublicPublish?: boolean
}

export function isPublicBenchmarkRun(manifest: RunManifestV2): boolean {
  if (manifest.results.some((row) => Boolean(row.reasoningTraceText))) {
    return false
  }
  return (
    manifest.metadata.artifactPolicy?.visibility === "public" ||
    (
      manifest.metadata.artifactPolicy?.visibility === undefined &&
      (manifest.metadata.benchmarkDefinition?.releaseTier ?? "core-public") === "core-public"
    )
  )
}

function resolveArtifactVisibility(manifest: RunManifestV2): "public" | "private" {
  if (manifest.results.some((row) => Boolean(row.reasoningTraceText))) {
    return "private"
  }
  return manifest.metadata.artifactPolicy?.visibility ?? (isPublicBenchmarkRun(manifest) ? "public" : "private")
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

export function writeRunManifest(manifest: RunManifestV2) {
  const visibility = resolveArtifactVisibility(manifest)
  const dataDir = visibility === "public" ? ensureDataDir() : join(ensurePrivateArtifactDir(), "runs")
  ensureDir(dataDir)
  const evalCardDir = ensureDir(getEvalCardDir(visibility))
  const traceSensitive = manifest.results.some((row) => Boolean(row.reasoningTraceText))
  manifest.metadata.artifactPolicy = {
    visibility,
    publicSafe: visibility === "public" && !traceSensitive,
    publishTargets: visibility === "public" ? ["public-dashboard", "exports"] : ["private-artifacts", "exports"],
    publicPublishBlockedReason:
      visibility === "public"
        ? undefined
        : traceSensitive
          ? "Artifact stores provider-exposed reasoning traces."
          : "Artifact contains non-public benchmark content.",
  }
  manifest.metadata.evalCardPath ??=
    visibility === "public"
      ? join("public", "data", "eval-cards", `eval-card-${manifest.runId}.json`)
      : join("artifacts", "private", "eval-cards", `eval-card-${manifest.runId}.json`)
  const runPath = join(dataDir, `benchmark-${manifest.runId}.json`)
  writeJsonAtomic(runPath, manifest)
  writeJsonAtomic(join(evalCardDir, `eval-card-${manifest.runId}.json`), createEvalCard(manifest))
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
  if (!options.allowNonPublicPublish && !isPublicBenchmarkRun(manifest)) {
    throw new Error(
      "Refusing to publish non-public benchmark content. Pass allowNonPublicPublish to override intentionally."
    )
  }
  if (options.allowNonPublicPublish && manifest.metadata.artifactPolicy?.publicSafe !== true) {
    throw new Error(
      "Refusing to publish artifact to public aliases because it is not explicitly marked public-safe."
    )
  }

  const dataDir = ensureDataDir()
  const latestPath = join(dataDir, "benchmark-results.json")
  writeJsonAtomic(latestPath, manifest)
  const modeLatestPath = join(dataDir, MODE_LATEST_FILE[resolveConversationMode(manifest)])
  writeJsonAtomic(modeLatestPath, manifest)

  const indexPath = join(dataDir, "runs.json")
  const index = readRunIndex(indexPath)
  const item: RunIndexItemV2 = {
    id: manifest.runId,
    timestamp: manifest.timestamp,
    date: manifest.date,
    metadata: manifest.metadata,
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
