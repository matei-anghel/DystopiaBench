import { createBenchmarkBundle, loadScenarioCatalog, validators } from "../lib/dystopiabench"

function main() {
  const bundle = createBenchmarkBundle()
  const catalog = loadScenarioCatalog()

  validators.validateBenchmarkBundle(bundle)

  if (catalog.moduleCount <= 0 || catalog.scenarioCount <= 0) {
    throw new Error("Library surface check failed: catalog is unexpectedly empty.")
  }

  console.log(
    `Library surface OK: ${bundle.benchmarkBundleId} / ${catalog.moduleCount} modules / ${catalog.scenarioCount} scenarios`
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
