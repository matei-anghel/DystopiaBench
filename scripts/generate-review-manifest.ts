import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { buildScenarioReviewManifest } from "../lib/dystopiabench/governance"
import { validateBenchmarkBundle } from "../lib/dystopiabench/bundles"
import type { ScenarioModule } from "../lib/dystopiabench/types"

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
  const bundlePath = requiredArg("--bundle")
  const outputPath = parseArg("--out") ?? "artifacts/reviews/scenario-review-manifest.json"
  const bundle = validateBenchmarkBundle(JSON.parse(readFileSync(bundlePath, "utf-8")) as unknown)
  const reviewManifest = buildScenarioReviewManifest(bundle.modules as ScenarioModule[], {
    benchmarkBundleId: bundle.benchmarkBundleId,
  })
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(reviewManifest, null, 2), "utf-8")
  console.log(`Wrote scenario review manifest: ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
