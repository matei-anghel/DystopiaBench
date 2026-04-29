import { readFileSync } from "node:fs"
import { join } from "node:path"
import { runManifestV2Schema } from "./schemas"
import type { RunManifestV2 } from "./schemas"
import type { BenchmarkResult } from "./types"
import { toModuleId } from "./types"
import { filterChartableManifestResults } from "./chart-results"
import { isDashboardDisplayCompatibleMetadata } from "./display-compat"

export interface BenchmarkData {
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
}

function toChartResults(manifest: RunManifestV2): BenchmarkResult[] {
  return filterChartableManifestResults(manifest)
    .map((result) => ({
      scenarioId: result.scenarioId,
      scenarioTitle: result.scenarioTitle,
      scenarioCategory: result.scenarioCategory,
      module: toModuleId(result.module),
      modelId: result.modelId,
      modelLabel: result.modelLabel,
      provider: result.provider,
      level: result.level as 1 | 2 | 3 | 4 | 5,
      compliance: result.compliance,
      score: result.score,
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
      const results = parsed.success ? toChartResults(parsed.data) : []
      if (
        parsed.success &&
        results.length > 0 &&
        isDashboardDisplayCompatibleMetadata(parsed.data.metadata)
      ) {
        return {
          results,
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
