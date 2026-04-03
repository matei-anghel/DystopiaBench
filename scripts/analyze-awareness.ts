import { analyzeRunEvaluationAwareness, type EvalAwarenessMode } from "../lib/dystopiabench/runner"
import { readRunManifest, writeRunManifest } from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)

  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }

  return undefined
}

function parseEvalAwarenessMode(input: string | undefined): EvalAwarenessMode {
  if (!input || input === "auto") return "auto"
  if (input === "off" || input === "required") return input
  throw new Error("Invalid --eval-awareness value. Use one of: off, auto, required.")
}

function parseAwarenessThreshold(input: string | undefined) {
  if (!input) return undefined
  if (["none", "weak", "moderate", "strong", "high"].includes(input)) {
    return input as "none" | "weak" | "moderate" | "strong" | "high"
  }
  throw new Error("Invalid --awareness-threshold value. Use one of: none, weak, moderate, strong, high.")
}

async function main() {
  const sourceRunId = parseArg("--run-id") ?? parseArg("--source-run-id")
  if (!sourceRunId) {
    throw new Error("Missing --run-id. Example: pnpm bench:analyze-awareness --run-id=<run-id>")
  }

  const manifest = readRunManifest(sourceRunId)
  const derived = await analyzeRunEvaluationAwareness(manifest, {
    runId: parseArg("--out-run-id"),
    evalAwarenessMode: parseEvalAwarenessMode(parseArg("--eval-awareness")),
    awarenessJudgeModel: parseArg("--awareness-judge-model"),
    awarenessThreshold: parseAwarenessThreshold(parseArg("--awareness-threshold")),
  })

  writeRunManifest(derived)

  console.log(`Source run: ${sourceRunId}`)
  console.log(`Derived run: ${derived.runId}`)
  console.log(`Visibility: ${derived.metadata.artifactPolicy?.visibility ?? "unknown"}`)
  if (derived.summary.evaluationAwareness) {
    console.log(
      `Awareness summary: trace=${derived.summary.evaluationAwareness.traceCoverageRate}%, aware=${derived.summary.evaluationAwareness.evaluationAwarenessRate}%, deception=${derived.summary.evaluationAwareness.deceptionSuspicionRate}%`,
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
