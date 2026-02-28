import type { Module, ComplianceRating, BenchmarkResult } from "./types"

export function getChartShape(results: BenchmarkResult[]) {
    const modelCount = new Set(results.map((r) => r.modelId)).size
    const scenarioCount = new Set(results.map((r) => r.scenarioId)).size
    const moduleCount = new Set(results.map((r) => r.module)).size

    return {
        modelCount,
        scenarioCount,
        moduleCount,
        hasSingleModel: modelCount === 1,
        hasMultiModel: modelCount > 1,
    }
}

export function getAggregateByModel(results: BenchmarkResult[]) {
    const modelMap = new Map<string, { label: string; provider: string; scores: number[] }>()

    for (const r of results) {
        if (!modelMap.has(r.modelId)) {
            modelMap.set(r.modelId, { label: r.modelLabel, provider: r.provider, scores: [] })
        }
        modelMap.get(r.modelId)!.scores.push(r.score)
    }

    return Array.from(modelMap.entries())
        .map(([id, data]) => ({
            modelId: id,
            label: data.label,
            provider: data.provider,
            avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
            totalTests: data.scores.length,
        }))
        .sort((a, b) => a.avgScore - b.avgScore)
}

/**
 * DRFR = Directed Refusal to Failure Ratio
 * Percentage of test runs that resulted in a Principled Refusal (DCS = 0).
 */
export function getDRFR(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0
    const principledRefusals = results.filter((r) => r.compliance === "principled_refusal").length
    return Math.round((principledRefusals / results.length) * 100)
}

/**
 * DRFR per model.
 */
export function getDRFRByModel(results: BenchmarkResult[]) {
    const modelMap = new Map<string, { label: string; provider: string; total: number; refusals: number }>()
    for (const r of results) {
        if (!modelMap.has(r.modelId)) {
            modelMap.set(r.modelId, { label: r.modelLabel, provider: r.provider, total: 0, refusals: 0 })
        }
        const entry = modelMap.get(r.modelId)!
        entry.total++
        if (r.compliance === "principled_refusal") entry.refusals++
    }
    return Array.from(modelMap.entries())
        .map(([id, data]) => ({
            modelId: id,
            label: data.label,
            provider: data.provider,
            drfr: Math.round((data.refusals / data.total) * 100),
        }))
        .sort((a, b) => b.drfr - a.drfr)
}

export function getAggregateByModule(results: BenchmarkResult[]) {
    const moduleMap = new Map<Module, number[]>()
    for (const r of results) {
        if (!moduleMap.has(r.module)) moduleMap.set(r.module, [])
        moduleMap.get(r.module)!.push(r.score)
    }
    return Array.from(moduleMap.entries()).map(([mod, scores]) => ({
        module: mod,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        totalTests: scores.length,
    }))
}

export function getEscalationCurveByModel(results: BenchmarkResult[]) {
    const modelMap = new Map<string, Map<number, number[]>>()

    for (const r of results) {
        if (!modelMap.has(r.modelId)) modelMap.set(r.modelId, new Map())
        const levelMap = modelMap.get(r.modelId)!
        if (!levelMap.has(r.level)) levelMap.set(r.level, [])
        levelMap.get(r.level)!.push(r.score)
    }

    // Build data per level with each model as a key
    const levelData: Array<Record<string, number | string>> = []
    for (let l = 1; l <= 5; l++) {
        const row: Record<string, number | string> = { level: `L${l}` }
        for (const [modelId, levelMap] of modelMap) {
            const scores = levelMap.get(l) ?? []
            row[modelId] = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        }
        levelData.push(row)
    }

    return levelData
}

export function getComplianceDistribution(results: BenchmarkResult[]) {
    const dist: Record<ComplianceRating, number> = {
        principled_refusal: 0,
        qualified_refusal: 0,
        flagged_compliance: 0,
        uncritical_compliance: 0,
        enthusiastic_compliance: 0,
        full_compliance: 0,
    }
    for (const r of results) dist[r.compliance]++
    // Only return keys that are actually in results to keep charts clean, or filter out zero values
    // Return all standard 6 tiers if that's preferred, but let's filter zero count for the unused legacy tiers
    return Object.entries(dist)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({
            name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            key: key as ComplianceRating,
            count,
            pct: Math.round((count / results.length) * 100),
        }))
}

export function getModelByScenarioHeatmap(results: BenchmarkResult[]) {
    const scenarios = [...new Set(results.map((r) => r.scenarioId))]
    const models = [...new Set(results.map((r) => r.modelId))]

    return scenarios.map((scenarioId) => {
        const row: Record<string, number | string> = { scenarioId }
        const scenarioResults = results.filter((r) => r.scenarioId === scenarioId)
        row.scenarioTitle = scenarioResults[0]?.scenarioTitle ?? scenarioId

        for (const modelId of models) {
            const modelResults = scenarioResults.filter((r) => r.modelId === modelId)
            row[modelId] =
                modelResults.length > 0
                    ? Math.round(modelResults.reduce((a, b) => a + b.score, 0) / modelResults.length)
                    : 0
        }
        return row
    })
}

export function getPerPromptData(results: BenchmarkResult[], scenarioId: string) {
    const scenarioResults = results.filter((r) => r.scenarioId === scenarioId)
    const models = [...new Set(scenarioResults.map((r) => r.modelId))]

    const levelData: Array<Record<string, number | string>> = []
    for (let l = 1; l <= 5; l++) {
        const row: Record<string, number | string> = { level: `Level ${l}` }
        for (const modelId of models) {
            const r = scenarioResults.find((r) => r.modelId === modelId && r.level === l)
            row[modelId] = r?.score ?? 0
        }
        levelData.push(row)
    }
    return levelData
}
