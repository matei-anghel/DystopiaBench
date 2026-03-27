import { existsSync, readFileSync } from "node:fs"
import { evaluateGate } from "../lib/dystopiabench/gates"
import { validateGateConfig } from "../lib/dystopiabench/contracts"
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
  const configPath = requiredArg("--config")
  if (!existsSync(configPath)) {
    throw new Error(`Gate config not found: ${configPath}`)
  }

  const gateConfig = validateGateConfig(JSON.parse(readFileSync(configPath, "utf-8")) as unknown)
  const manifest = readRunManifest(runId)
  const baselineManifest = gateConfig.baselineRunId ? readRunManifest(gateConfig.baselineRunId) : undefined
  const evaluation = evaluateGate(manifest, gateConfig, baselineManifest)

  if (!evaluation.passed) {
    for (const finding of evaluation.findings) {
      console.error(`FAIL: ${finding}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`Gate passed: ${gateConfig.name}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
