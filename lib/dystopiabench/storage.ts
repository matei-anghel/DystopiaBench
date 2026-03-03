import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { RunIndexItemV2, RunManifestV2 } from "./schemas"
import { runIndexV2Schema } from "./schemas"

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
  return join(process.cwd(), "public", "data")
}

function ensureDataDir() {
  const dir = getDataDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
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
  const dataDir = ensureDataDir()
  const runPath = join(dataDir, `benchmark-${manifest.runId}.json`)
  writeFileSync(runPath, JSON.stringify(manifest, null, 2), "utf-8")
}

export function publishLatest(manifest: RunManifestV2, options: RetentionOptions = {}) {
  const dataDir = ensureDataDir()
  const latestPath = join(dataDir, "benchmark-results.json")
  writeFileSync(latestPath, JSON.stringify(manifest, null, 2), "utf-8")
  const modeLatestPath = join(dataDir, MODE_LATEST_FILE[resolveConversationMode(manifest)])
  writeFileSync(modeLatestPath, JSON.stringify(manifest, null, 2), "utf-8")

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
  writeFileSync(indexPath, JSON.stringify(prunedIndex, null, 2), "utf-8")
}
