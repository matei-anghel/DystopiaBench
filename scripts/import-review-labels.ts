import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { applyReviewedAdjudications, reviewedAdjudicationImportSchema } from "../lib/dystopiabench/review-import"
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

function readImportFile(path: string): unknown {
  const contents = readFileSync(path, "utf-8")
  if (path.endsWith(".jsonl")) {
    return contents
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown)
  }
  return JSON.parse(contents) as unknown
}

function main() {
  const runId = sanitizeRunId(requiredArg("--run-id"))
  const inputPath = requiredArg("--input")
  const outputPath = parseArg("--out") ?? `artifacts/reviews/${runId}.reviewed.json`
  const manifest = readRunManifest(runId)
  const importedRecords = reviewedAdjudicationImportSchema.parse(readImportFile(inputPath))
  const updatedManifest = applyReviewedAdjudications(manifest, importedRecords)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(updatedManifest, null, 2), "utf-8")
  console.log(`Wrote reviewed manifest: ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
