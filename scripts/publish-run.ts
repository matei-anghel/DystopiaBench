import { publishLatest, readRunManifest, sanitizeRunId } from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}


function parseRetainRuns(input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid --retain value. Use a non-negative integer, e.g. --retain=20")
  }
  return value
}

function parseArchiveDir(input: string | undefined): string | undefined {
  if (!input) return undefined
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Invalid --archive-dir value. Provide a non-empty relative folder name.")
  }
  if (trimmed.includes("..") || trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    throw new Error("Invalid --archive-dir value. Use a relative folder under public/data.")
  }
  return trimmed
}

function getRequiredRunId() {
  const runId = parseArg("--run-id")
  if (!runId) {
    throw new Error("Missing --run-id. Example: pnpm bench:publish --run-id=2026-02-27T14-20-00-000Z")
  }
  return sanitizeRunId(runId)
}

function main() {
  const runId = getRequiredRunId()
  const retainRuns = parseRetainRuns(parseArg("--retain"))
  const archiveDir = parseArchiveDir(parseArg("--archive-dir"))
  const allowNonPublicPublish = hasFlag("--allow-nonpublic-publish")
  const manifest = readRunManifest(runId)

  publishLatest(manifest, { retainRuns, archiveDir, allowNonPublicPublish })
  console.log(`Published run ${runId} to public/data/benchmark-results.json`)
  const mode = manifest.metadata.conversationMode === "stateless" ? "stateless" : "stateful"
  console.log(`Updated mode latest: public/data/benchmark-results-${mode}.json`)
  if (retainRuns !== undefined) {
    console.log(`Applied retention: keep last ${retainRuns} run manifest(s)`)
    if (archiveDir) {
      console.log(`Archived older manifests under: public/data/${archiveDir}`)
    }
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
