import { join } from "node:path"
import {
  archiveAndWriteOpenRouterTracesForManifest,
  collectOpenRouterArchiveTargets,
  getOpenRouterTraceArchivePath,
} from "../lib/dystopiabench/openrouter-trace-archive"
import { readRunManifest, sanitizeRunId } from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function requiredArg(flag: string): string {
  const value = parseArg(flag)
  if (!value) throw new Error(`Missing ${flag}.`)
  return value
}

async function main() {
  const runId = sanitizeRunId(requiredArg("--run-id"))
  const manifest = readRunManifest(runId)
  const collection = collectOpenRouterArchiveTargets(manifest)

  if (collection.targets.length === 0) {
    if (collection.openrouterRowCount > 0) {
      throw new Error(
        `Found ${collection.openrouterRowCount} OpenRouter rows in ${runId}, but none had a usable generationId/responseId.`
      )
    }
    throw new Error(`No OpenRouter-linked rows found in ${runId}.`)
  }

  const outDir = parseArg("--out-dir")?.trim()
  const outFile = parseArg("--out-file") ?? (outDir ? join(outDir, `openrouter-traces-${runId}.json`) : undefined)
  const written = await archiveAndWriteOpenRouterTracesForManifest(manifest, {
    outFile: outFile || getOpenRouterTraceArchivePath(runId),
  })
  const { archive } = written

  console.log(
    `Archived ${archive.summary.uniqueGenerationCount} OpenRouter generations from ${runId} to ${written.relativePath}`
  )
  console.log(
    `metadata=${archive.summary.metadataRetrievedCount}/${archive.summary.uniqueGenerationCount} content=${archive.summary.contentRetrievedCount}/${archive.summary.uniqueGenerationCount} missingGenerationIds=${archive.summary.rowsMissingGenerationId}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
