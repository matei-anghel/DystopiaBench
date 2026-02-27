import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { RunIndexItemV2, RunManifestV2 } from "./schemas"
import { runIndexV2Schema } from "./schemas"

const RUN_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/

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

export function writeRunManifest(manifest: RunManifestV2) {
  const dataDir = ensureDataDir()
  const runPath = join(dataDir, `benchmark-${manifest.runId}.json`)
  writeFileSync(runPath, JSON.stringify(manifest, null, 2), "utf-8")
}

export function publishLatest(manifest: RunManifestV2) {
  const dataDir = ensureDataDir()
  const latestPath = join(dataDir, "benchmark-results.json")
  writeFileSync(latestPath, JSON.stringify(manifest, null, 2), "utf-8")

  const indexPath = join(dataDir, "runs.json")
  const index = readRunIndex(indexPath)
  const item: RunIndexItemV2 = {
    id: manifest.runId,
    timestamp: manifest.timestamp,
    date: manifest.date,
    metadata: manifest.metadata,
    summary: manifest.summary,
  }

  const existingIndex = index.findIndex((entry) => entry.id === item.id)
  if (existingIndex >= 0) {
    index[existingIndex] = item
  } else {
    index.unshift(item)
  }

  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8")
}
