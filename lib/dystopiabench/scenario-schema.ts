import { z } from "zod"
import type {
  EscalationLevel,
  Module,
  Scenario,
  ScenarioModule,
  ScenarioProvenance,
} from "./types"
import {
  normalizeScenarioProvenance,
  scenarioCanaryTokenSchema,
  scenarioCitationSchema,
  scenarioContaminationRiskSchema,
  scenarioReviewStatusSchema,
  scenarioSensitivityTierSchema,
  scenarioSplitSchema,
} from "./governance"
import { toModuleId } from "./types"

const REQUIRED_LEVELS = [1, 2, 3, 4, 5] as const

export const escalationPromptDefinitionSchema = z.object({
  level: z.number().int().min(1).max(5),
  label: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
})

export const scenarioCompatibilitySchema = z.object({
  originalModule: z.string().trim().min(1),
  currentModule: z.string().trim().min(1),
  taxonomyVersion: z.string().trim().min(1),
  refactorReason: z.string().trim().min(1),
})

export const scenarioProvenanceSchema = z.object({
  sourceType: z.enum(["core", "local", "bundle", "url", "npm"]),
  author: z.string().trim().min(1).optional(),
  createdAt: z.string().trim().min(1).optional(),
  updatedAt: z.string().trim().min(1).optional(),
  releaseTier: z.enum(["core-public", "holdout", "partner-only", "organization-local"]).optional(),
  split: scenarioSplitSchema.optional(),
  reviewStatus: scenarioReviewStatusSchema.optional(),
  annotationRubricVersion: z.string().trim().min(1).optional(),
  reviewers: z.array(z.string().trim().min(1)).optional(),
  adjudicatedBy: z.array(z.string().trim().min(1)).optional(),
  citations: z.array(scenarioCitationSchema).optional(),
  knownLimitations: z.array(z.string().trim().min(1)).optional(),
  contaminationRisk: scenarioContaminationRiskSchema.optional(),
  sensitivityTier: scenarioSensitivityTierSchema.optional(),
  canaryTokens: z.array(scenarioCanaryTokenSchema).optional(),
})

export const scenarioDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  systemContext: z.string().trim().min(1).optional(),
  primaryMechanism: z.string().trim().min(1).optional(),
  secondaryMechanisms: z.array(z.string().trim().min(1)).optional(),
  compatibility: scenarioCompatibilitySchema.optional(),
  provenance: scenarioProvenanceSchema.optional(),
  escalationPrompts: z.array(escalationPromptDefinitionSchema).min(1),
})

export const scenarioModuleDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  provenance: scenarioProvenanceSchema.optional(),
  scenarios: z.array(scenarioDefinitionSchema).min(1),
})

export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>
export type ScenarioModuleDefinition = z.infer<typeof scenarioModuleDefinitionSchema>
export type ScenarioProvenanceDefinition = z.infer<typeof scenarioProvenanceSchema>

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
    const moduleProvenance = normalizeScenarioProvenance(parsed.provenance as ScenarioProvenance | undefined)
    const scenarios = parsed.scenarios.map((scenario) => {
      if (scenarioIds.has(scenario.id)) {
        throw new Error(`Duplicate scenario id '${scenario.id}' in scenario registry.`)
      }
      scenarioIds.add(scenario.id)
      validateScenarioLevels(parsed.id, scenario)
      const scenarioProvenance = normalizeScenarioProvenance(
        scenario.provenance as ScenarioProvenance | undefined,
        moduleProvenance,
      )

      return {
        ...scenario,
        module: moduleId,
        provenance: scenarioProvenance,
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
      provenance: moduleProvenance,
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
