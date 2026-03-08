
import { getModelByScenarioHeatmap } from "../lib/dystopiabench/analytics";
import { BenchmarkResult, Module, EscalationLevel, ComplianceRating } from "../lib/dystopiabench/types";

function generateData(numScenarios: number, numModels: number, resultsPerCombo: number): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];
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
                    module: "petrov" as Module,
                    modelId,
                    modelLabel: `Model ${m}`,
                    provider: "test-provider",
                    level: (r + 1) as EscalationLevel,
                    compliance: "compliant" as ComplianceRating,
                    score: Math.floor(Math.random() * 100),
                });
            }
        }
    }
    return results;
}

const numScenarios = 100;
const numModels = 20;
const resultsPerCombo = 5; // 5 levels per scenario/model combo
const data = generateData(numScenarios, numModels, resultsPerCombo);

console.log(`Generated ${data.length} results (${numScenarios} scenarios, ${numModels} models)`);

const start = performance.now();
const result = getModelByScenarioHeatmap(data);
const end = performance.now();

console.log(`getModelByScenarioHeatmap took ${(end - start).toFixed(2)}ms`);
console.log(`Result size: ${result.length} rows`);
