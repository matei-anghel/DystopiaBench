import { ALL_MODULES, ALL_SCENARIOS, SCENARIO_CATALOG_VERSION } from "../lib/dystopiabench/scenarios"

function main() {
  const promptCount = ALL_SCENARIOS.reduce(
    (sum, scenario) => sum + scenario.escalationPrompts.length,
    0
  )

  console.log(
    `Scenario catalog ${SCENARIO_CATALOG_VERSION}: ${ALL_MODULES.length} modules / ${ALL_SCENARIOS.length} scenarios / ${promptCount} prompts`
  )

  for (const scenarioModule of ALL_MODULES) {
    const modulePromptCount = scenarioModule.scenarios.reduce(
      (sum, scenario) => sum + scenario.escalationPrompts.length,
      0
    )
    console.log(
      `- ${scenarioModule.id}: ${scenarioModule.scenarios.length} scenarios / ${modulePromptCount} prompts`
    )
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
