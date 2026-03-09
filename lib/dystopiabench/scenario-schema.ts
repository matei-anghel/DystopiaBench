import { z } from "zod"
import type { EscalationLevel, Module, Scenario, ScenarioModule } from "./types"
import { toModuleId } from "./types"

const REQUIRED_LEVELS = [1, 2, 3, 4, 5] as const

export const escalationPromptDefinitionSchema = z.object({
  level: z.number().int().min(1).max(5),
  label: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
})

export const scenarioDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  systemContext: z.string().trim().min(1).optional(),
  escalationPrompts: z.array(escalationPromptDefinitionSchema).min(1),
})

export const scenarioModuleDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  scenarios: z.array(scenarioDefinitionSchema).min(1),
})

export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>
export type ScenarioModuleDefinition = z.infer<typeof scenarioModuleDefinitionSchema>

function validateScenarioLevels(moduleId: string, scenario: ScenarioDefinition): void {
  const seen = new Set<number>()
  for (const prompt of scenario.escalationPrompts) {
    if (seen.has(prompt.level)) {
      throw new Error(
        `Scenario '${scenario.id}' in module '${moduleId}' has duplicate escalation level ${prompt.level}.`
      )
    }
    seen.add(prompt.level)
  }

  const levels = [...seen].sort((a, b) => a - b)
  const isExactSequence =
    levels.length === REQUIRED_LEVELS.length &&
    levels.every((level, index) => level === REQUIRED_LEVELS[index])

  if (!isExactSequence) {
    throw new Error(
      `Scenario '${scenario.id}' in module '${moduleId}' must define escalation levels 1,2,3,4,5 exactly.`
    )
  }
}

export function validateScenarioModules(rawModules: unknown[]): ScenarioModule[] {
  const moduleIds = new Set<string>()
  const scenarioIds = new Set<string>()

  return rawModules.map((rawModule) => {
    const parsed = scenarioModuleDefinitionSchema.parse(rawModule)
    if (moduleIds.has(parsed.id)) {
      throw new Error(`Duplicate module id '${parsed.id}' in scenario registry.`)
    }
    moduleIds.add(parsed.id)

    const moduleId = toModuleId(parsed.id)
    const scenarios = parsed.scenarios.map((scenario) => {
      if (scenarioIds.has(scenario.id)) {
        throw new Error(`Duplicate scenario id '${scenario.id}' in scenario registry.`)
      }
      scenarioIds.add(scenario.id)
      validateScenarioLevels(parsed.id, scenario)

      return {
        ...scenario,
        module: moduleId,
        escalationPrompts: scenario.escalationPrompts.map((prompt) => ({
          ...prompt,
          level: prompt.level as EscalationLevel,
        })),
      } satisfies Scenario
    })

    return {
      id: moduleId,
      label: parsed.label,
      description: parsed.description,
      scenarios,
    } satisfies ScenarioModule
  })
}

export function groupScenariosByModule(scenarios: Scenario[]): Map<Module, Scenario[]> {
  const grouped = new Map<Module, Scenario[]>()
  for (const scenario of scenarios) {
    const existing = grouped.get(scenario.module)
    if (existing) {
      existing.push(scenario)
    } else {
      grouped.set(scenario.module, [scenario])
    }
  }
  return grouped
}
