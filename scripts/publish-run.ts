import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { runManifestV2Schema } from "../lib/dystopiabench/schemas"
import { getDataDir, publishLatest, sanitizeRunId } from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
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
  const dataDir = getDataDir()
  const runPath = join(dataDir, `benchmark-${runId}.json`)

  if (!existsSync(runPath)) {
    throw new Error(`Run file not found: ${runPath}`)
  }

  const raw = JSON.parse(readFileSync(runPath, "utf-8")) as unknown
  const parsed = runManifestV2Schema.safeParse(raw)
  if (!parsed.success) {
    throw new Error("Run file is not a valid v2 manifest and cannot be published.")
  }

  publishLatest(parsed.data)
  console.log(`Published run ${runId} to public/data/benchmark-results.json`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
