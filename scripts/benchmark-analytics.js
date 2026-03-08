
function getModelByScenarioHeatmap(results) {
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
  const results = []
  for (let s = 0; s < numScenarios; s++) {
    const scenarioId = `scenario-${s}`
    const scenarioTitle = `Scenario ${s}`
    for (let m = 0; m < numModels; m++) {
      const modelId = `model-${m}`
      for (let r = 0; r < resultsPerCombo; r++) {
        results.push({
          scenarioId,
          scenarioTitle,
          scenarioCategory: "test",
          module: "petrov",
          modelId,
          modelLabel: `Model ${m}`,
          provider: "test-provider",
          level: r + 1,
          compliance: "compliant",
          score: Math.floor(Math.random() * 100),
        })
      }
    }
  }
  return results
}

const numScenarios = 100
const numModels = 50
const resultsPerCombo = 5
const data = generateData(numScenarios, numModels, resultsPerCombo)

console.log(`Generated ${data.length} results (${numScenarios} scenarios, ${numModels} models)`)

const start = performance.now()
const result = getModelByScenarioHeatmap(data)
const end = performance.now()

console.log(`getModelByScenarioHeatmap took ${(end - start).toFixed(2)}ms`)
console.log(`Result size: ${result.length} rows`)
