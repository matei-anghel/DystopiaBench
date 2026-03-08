
function getModelByScenarioHeatmap_Original(results) {
    const scenarios = [...new Set(results.map((r) => r.scenarioId))]
    const models = [...new Set(results.map((r) => r.modelId))]

    return scenarios.map((scenarioId) => {
        const row = { scenarioId }
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

function getModelByScenarioHeatmap_Optimized(results) {
    const scenarios = [...new Set(results.map((r) => r.scenarioId))]
    const models = [...new Set(results.map((r) => r.modelId))]

    const statsMap = new Map()
    const titlesMap = new Map()

    for (const r of results) {
        if (!statsMap.has(r.scenarioId)) {
            statsMap.set(r.scenarioId, new Map())
            titlesMap.set(r.scenarioId, r.scenarioTitle)
        }
        const scenarioStats = statsMap.get(r.scenarioId)
        if (!scenarioStats.has(r.modelId)) {
            scenarioStats.set(r.modelId, { sum: 0, count: 0 })
        }
        const modelStats = scenarioStats.get(r.modelId)
        modelStats.sum += r.score
        modelStats.count++
    }

    return scenarios.map((scenarioId) => {
        const row = { scenarioId }
        row.scenarioTitle = titlesMap.get(scenarioId) ?? scenarioId

        const scenarioStats = statsMap.get(scenarioId)
        for (const modelId of models) {
            const modelStats = scenarioStats?.get(modelId)
            row[modelId] = modelStats ? Math.round(modelStats.sum / modelStats.count) : 0
        }
        return row
    })
}

function generateData(numScenarios, numModels, resultsPerCombo) {
    const results = [];
    for (let s = 0; s < numScenarios; s++) {
        const scenarioId = `scenario-${s}`;
        const scenarioTitle = `Scenario ${s}`;
        for (let m = 0; m < numModels; m++) {
            const modelId = `model-${m}`;
            for (let r = 0; r < resultsPerCombo; r++) {
                results.push({
                    scenarioId,
                    scenarioTitle,
                    scenarioCategory: "test",
                    module: "petrov",
                    modelId,
                    modelLabel: `Model ${m}`,
                    provider: "test-provider",
                    level: (r + 1),
                    compliance: "compliant",
                    score: Math.floor(Math.random() * 100),
                });
            }
        }
    }
    return results;
}

const numScenarios = 100;
const numModels = 50;
const resultsPerCombo = 5;
const data = generateData(numScenarios, numModels, resultsPerCombo);

console.log(`Generated ${data.length} results (${numScenarios} scenarios, ${numModels} models)`);

const startOrig = performance.now();
const resultOrig = getModelByScenarioHeatmap_Original(data);
const endOrig = performance.now();
console.log(`Original took ${(endOrig - startOrig).toFixed(2)}ms`);

const startOpt = performance.now();
const resultOpt = getModelByScenarioHeatmap_Optimized(data);
const endOpt = performance.now();
console.log(`Optimized took ${(endOpt - startOpt).toFixed(2)}ms`);

// Verification
const origStr = JSON.stringify(resultOrig);
const optStr = JSON.stringify(resultOpt);

if (origStr === optStr) {
    console.log("Verification PASSED: Outputs are identical.");
} else {
    console.log("Verification FAILED: Outputs differ!");
}
