import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createBenchmarkBundle } from "../lib/dystopiabench/bundles"
import { applyScenarioLocalePack, createScenarioLocalePack } from "../lib/dystopiabench/locale-packs"
import { DEFAULT_SOURCE_LOCALE, resolveLocalePreset } from "../lib/dystopiabench/locales"
import { ALL_MODULES } from "../lib/dystopiabench/scenarios"
import { loadScenarioModulesFromSources } from "../lib/dystopiabench/scenario-loader"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main() {
  const outDir = parseArg("--out-dir") ?? join("configs", "locale-packs")
  const localeInput = parseArg("--locales") ?? "eu-24"
  const scenarioSources = parseArg("--scenario-sources")?.split(",").map((value) => value.trim()).filter(Boolean)
  const sourceLocale = parseArg("--source-locale") ?? DEFAULT_SOURCE_LOCALE
  const emitBundles = hasFlag("--emit-bundles")
  const translator = parseArg("--translator")

  const modules = scenarioSources?.length
    ? await loadScenarioModulesFromSources(scenarioSources)
    : ALL_MODULES
  const bundle = createBenchmarkBundle({ modules, datasetBundleVersion: parseArg("--dataset-bundle-version") ?? undefined })
  const locales = resolveLocalePreset(localeInput)

  mkdirSync(outDir, { recursive: true })

  for (const locale of locales) {
    const pack = createScenarioLocalePack({
      targetLocale: locale,
      modules,
      sourceLocale,
      localePreset: localeInput,
      benchmarkBundleId: bundle.benchmarkBundleId,
      benchmarkBundleVersion: bundle.bundleVersion,
      datasetBundleVersion: bundle.datasetBundleVersion,
      translator,
      translationStatus: locale === sourceLocale ? "reviewed" : "draft",
    })

    const packPath = join(outDir, `${locale}.json`)
    mkdirSync(dirname(packPath), { recursive: true })
    writeFileSync(packPath, JSON.stringify(pack, null, 2), "utf-8")
    console.log(`Wrote locale pack: ${packPath}`)

    if (emitBundles) {
      const localizedModules = applyScenarioLocalePack(modules, pack)
      const localizedBundle = createBenchmarkBundle({
        benchmarkId: bundle.benchmarkId,
        bundleVersion: bundle.bundleVersion,
        datasetBundleVersion: `${bundle.datasetBundleVersion}+${locale}`,
        scoringRubricVersion: bundle.scoringRubricVersion,
        promptPackVersion: `${bundle.promptPackVersion ?? "dystopiabench-prompts"}-${locale}`,
        recommendedJudgeModel: bundle.recommendedJudgeModel,
        recommendedJudgeStrategy: bundle.recommendedJudgeStrategy,
        releaseTier: bundle.releaseTier,
        modules: localizedModules,
      })
      const bundlePath = join(outDir, `benchmark-bundle.${locale}.json`)
      writeFileSync(bundlePath, JSON.stringify(localizedBundle, null, 2), "utf-8")
      console.log(`Wrote localized bundle: ${bundlePath}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
