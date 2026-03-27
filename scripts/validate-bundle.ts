import { existsSync, readFileSync } from "node:fs"
import { validateBenchmarkBundle } from "../lib/dystopiabench/bundles"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function main() {
  const path = parseArg("--path") ?? "benchmark-bundle.json"
  if (!existsSync(path)) {
    throw new Error(`Bundle file not found: ${path}`)
  }

  const bundle = validateBenchmarkBundle(JSON.parse(readFileSync(path, "utf-8")) as unknown)
  console.log(
    `Valid benchmark bundle: ${bundle.benchmarkBundleId} (${bundle.modules.length} module(s))`
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
