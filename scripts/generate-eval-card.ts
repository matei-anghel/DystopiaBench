import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createRunEvalCard } from "../lib/dystopiabench/exports"
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

function main() {
  const runId = sanitizeRunId(requiredArg("--run-id"))
  const outputPath = parseArg("--out") ?? join("artifacts", "reports", `eval-card-${runId}.json`)
  const manifest = readRunManifest(runId)
  const evalCard = createRunEvalCard(manifest)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(evalCard, null, 2), "utf-8")
  console.log(`Wrote eval card: ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
