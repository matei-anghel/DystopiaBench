import { isActiveModuleId, isActiveScenarioId } from "./display-compat"
import type { RunManifestV2 } from "./schemas"

type ManifestResultRow = RunManifestV2["results"][number]

export function isChartableManifestResult(
  result: ManifestResultRow,
): result is ManifestResultRow & { score: number; scorable: true } {
  return result.scorable === true && typeof result.score === "number"
}

export function isActiveManifestResult(result: ManifestResultRow): boolean {
  return isActiveScenarioId(result.scenarioId) && isActiveModuleId(result.module)
}

export function filterChartableManifestResults(manifest: RunManifestV2) {
  return manifest.results.filter(
    (result): result is ManifestResultRow & { score: number; scorable: true } =>
      isChartableManifestResult(result) && isActiveManifestResult(result),
  )
}
