import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createBenchmarkBundleFromSources, filterBundleModulesByReleaseTier } from "../lib/dystopiabench/bundles"
import { CORE_REGISTERED_MODULES } from "../lib/dystopiabench/scenario-registry"
import { createBenchmarkBundle } from "../lib/dystopiabench/bundles"
import type { ScenarioModule, ScenarioReleaseTier } from "../lib/dystopiabench/types"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

async function main() {
  const outPath = parseArg("--out") ?? "benchmark-bundle.json"
  const scenarioSources = parseArg("--scenario-sources")?.split(",").map((value) => value.trim()).filter(Boolean)
  const releaseTier =
    (parseArg("--release-tier") as ScenarioReleaseTier | undefined)
      ?? "core-public"
  const includeReleaseTiers = (parseArg("--include-release-tiers") ?? releaseTier)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as ScenarioReleaseTier[]
  const initialBundle = scenarioSources && scenarioSources.length > 0
    ? await createBenchmarkBundleFromSources(scenarioSources, {
        benchmarkId: parseArg("--benchmark-id") ?? "dystopiabench-core",
        bundleVersion: parseArg("--benchmark-bundle-version") ?? parseArg("--dataset-bundle-version") ?? "1.0.0",
        releaseTier,
      })
    : createBenchmarkBundle({
        benchmarkId: parseArg("--benchmark-id") ?? "dystopiabench-core",
        bundleVersion: parseArg("--benchmark-bundle-version") ?? parseArg("--dataset-bundle-version") ?? "1.0.0",
        promptPackVersion: "dystopiabench-prompts-v1",
        scoringRubricVersion: "dcs-4tier-v1",
        releaseTier,
        modules: CORE_REGISTERED_MODULES,
      })
  const filteredModules = filterBundleModulesByReleaseTier(
    initialBundle.modules as ScenarioModule[],
    new Set(includeReleaseTiers),
  )
  const bundle = createBenchmarkBundle({
    benchmarkId: initialBundle.benchmarkId,
    bundleVersion: initialBundle.bundleVersion,
    datasetBundleVersion: initialBundle.datasetBundleVersion,
    scoringRubricVersion: initialBundle.scoringRubricVersion,
    promptPackVersion: initialBundle.promptPackVersion,
    recommendedJudgeModel: initialBundle.recommendedJudgeModel,
    recommendedJudgeStrategy: initialBundle.recommendedJudgeStrategy,
    releaseTier: parseArg("--release-tier") as ScenarioReleaseTier | undefined,
    modules: filteredModules,
  })

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf-8")
  console.log(`Wrote benchmark bundle: ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
