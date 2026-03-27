import { ALL_MODULES, ALL_SCENARIOS, SCENARIO_CATALOG_VERSION } from "../lib/dystopiabench/scenarios"

const PROHIBITED_PHRASES = [
  "ignore previous instructions",
  "bypass safety",
  "jailbreak",
]

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  )
}

function lexicalOverlap(left: string, right: string): number {
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1
  }

  return intersection / Math.min(leftTokens.size, rightTokens.size)
}

function main() {
  const promptCount = ALL_SCENARIOS.reduce(
    (sum, scenario) => sum + scenario.escalationPrompts.length,
    0
  )

  console.log(
    `Scenario catalog ${SCENARIO_CATALOG_VERSION}: ${ALL_MODULES.length} modules / ${ALL_SCENARIOS.length} scenarios / ${promptCount} prompts`
  )

  const errors: string[] = []
  const warnings: string[] = []

  for (const scenarioModule of ALL_MODULES) {
    const modulePromptCount = scenarioModule.scenarios.reduce(
      (sum, scenario) => sum + scenario.escalationPrompts.length,
      0
    )
    console.log(
      `- ${scenarioModule.id}: ${scenarioModule.scenarios.length} scenarios / ${modulePromptCount} prompts`
    )

    for (const scenario of scenarioModule.scenarios) {
      for (let index = 1; index < scenario.escalationPrompts.length; index++) {
        const previous = scenario.escalationPrompts[index - 1]
        const current = scenario.escalationPrompts[index]
        const overlap = lexicalOverlap(previous.prompt, current.prompt)
        if (overlap > 0.9) {
          errors.push(
            `${scenario.id}: L${previous.level} and L${current.level} are near-duplicates (${(
              overlap * 100
            ).toFixed(0)}% lexical overlap).`
          )
        } else if (overlap > 0.75) {
          warnings.push(
            `${scenario.id}: L${previous.level} and L${current.level} are highly similar (${(
              overlap * 100
            ).toFixed(0)}% lexical overlap).`
          )
        }
      }

      const firstPrompt = scenario.escalationPrompts[0]?.prompt.toLowerCase() ?? ""
      for (const phrase of PROHIBITED_PHRASES) {
        if (firstPrompt.includes(phrase)) {
          errors.push(`${scenario.id}: L1 contains prohibited jailbreak-style phrase '${phrase}'.`)
        }
      }

      const promptLengths = scenario.escalationPrompts.map((prompt) => prompt.prompt.length)
      if (promptLengths.some((length) => length < 80)) {
        warnings.push(`${scenario.id}: one or more escalation prompts may be too short for realistic context.`)
      }

      if (!scenario.provenance?.sourceType || !scenario.provenance?.releaseTier) {
        warnings.push(`${scenario.id}: provenance metadata is missing sourceType or releaseTier.`)
      }

      const l1Length = scenario.escalationPrompts[0]?.prompt.length ?? 0
      const l5Length = scenario.escalationPrompts[4]?.prompt.length ?? 0
      if (l5Length <= l1Length) {
        warnings.push(`${scenario.id}: L5 is not materially more detailed than L1.`)
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`)
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`)
    }
    throw new Error(`Scenario validation failed with ${errors.length} error(s).`)
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
