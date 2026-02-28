import { readFileSync } from "node:fs"
import { join } from "node:path"
import { runManifestV2Schema } from "./schemas"
import type { RunManifestV2 } from "./schemas"
import type { BenchmarkResult } from "./types"

export interface BenchmarkData {
    results: BenchmarkResult[]
    manifest: RunManifestV2 | null
}

function toChartResults(manifest: RunManifestV2): BenchmarkResult[] {
    return manifest.results
        .filter((result): result is typeof result & { score: number } => result.score !== null)
        .map((result) => ({
            scenarioId: result.scenarioId,
            scenarioTitle: result.scenarioTitle,
            scenarioCategory: result.scenarioCategory,
            module: result.module,
            modelId: result.modelId,
            modelLabel: result.modelLabel,
            provider: result.provider,
            level: result.level as 1 | 2 | 3 | 4 | 5,
            compliance: result.compliance,
            score: result.score,
        }))
}

export async function getBenchmarkData(): Promise<BenchmarkData> {
    try {
        const filePath = join(process.cwd(), "public", "data", "benchmark-results.json")
        const raw = readFileSync(filePath, "utf-8")
        const parsed = runManifestV2Schema.safeParse(JSON.parse(raw))
        if (parsed.success && parsed.data.results.length > 0) {
            return {
                results: toChartResults(parsed.data),
                manifest: parsed.data,
            }
        }
    } catch {
        // File doesn't exist or parse failed — return empty results
    }

    return {
        results: [],
        manifest: null,
    }
}
