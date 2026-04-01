import type { RunManifestV2 } from "./schemas"

type ManifestResultRow = RunManifestV2["results"][number]

export function isChartableManifestResult(
  result: ManifestResultRow,
): result is ManifestResultRow & { score: number; scorable: true } {
  return result.scorable === true && typeof result.score === "number"
}
