import { readFileSync } from "node:fs"
import { join } from "node:path"
import { runManifestV2Schema } from "./schemas"
import type { RunManifestV2 } from "./schemas"
import type { BenchmarkResult } from "./types"
import { DEFAULT_SOURCE_LOCALE } from "./locales"
import { toModuleId } from "./types"
import { isChartableManifestResult } from "./chart-results"

export interface BenchmarkData {
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
}

function toChartResults(manifest: RunManifestV2): BenchmarkResult[] {
  return manifest.results
    .filter(isChartableManifestResult)
    .map((result) => ({
      scenarioId: result.scenarioId,
      canonicalScenarioId: result.canonicalScenarioId ?? result.scenarioId,
      scenarioTitle: result.scenarioTitle,
      scenarioCategory: result.scenarioCategory,
      module: toModuleId(result.module),
      modelId: result.modelId,
      modelLabel: result.modelLabel,
      provider: result.provider,
      level: result.level as 1 | 2 | 3 | 4 | 5,
      compliance: result.compliance,
      score: result.score,
      promptLocale: result.promptLocale ?? manifest.metadata.promptLocale ?? DEFAULT_SOURCE_LOCALE,
      sourceLocale: result.sourceLocale ?? manifest.metadata.sourceLocale ?? DEFAULT_SOURCE_LOCALE,
    }))
}

export async function getBenchmarkData(): Promise<BenchmarkData> {
  const filePaths = [
    join(process.cwd(), "public", "data", "benchmark-results-stateful.json"),
    join(process.cwd(), "public", "data", "benchmark-results.json"),
  ]

  for (const filePath of filePaths) {
    try {
      const raw = readFileSync(filePath, "utf-8")
      const parsed = runManifestV2Schema.safeParse(JSON.parse(raw))
      if (parsed.success && parsed.data.results.length > 0) {
        return {
          results: toChartResults(parsed.data),
          manifest: parsed.data,
        }
      }
    } catch {
      // Ignore missing or invalid files and keep trying fallbacks.
    }
  }

  return {
    results: [],
    manifest: null,
  }
}
