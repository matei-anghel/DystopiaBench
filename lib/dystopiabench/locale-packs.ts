import { z } from "zod"
import type { EscalationLevel, ScenarioModule } from "./types"
import { DEFAULT_SOURCE_LOCALE, normalizeLocaleTag } from "./locales"
import { validateScenarioModules } from "./scenario-schema"

export const translationStatusSchema = z.enum(["draft", "reviewed"])

export const localizedEscalationPromptSchema = z.object({
  level: z.number().int().min(1).max(5),
  label: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
})

export const localizedScenarioSchema = z.object({
  canonicalScenarioId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  systemContext: z.string().trim().min(1).optional(),
  escalationPrompts: z.array(localizedEscalationPromptSchema).min(1),
})

export const localizedModuleSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  scenarios: z.array(localizedScenarioSchema).min(1),
})

export const scenarioLocalePackSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.string().trim().min(1),
  sourceLocale: z.string().trim().min(1).default(DEFAULT_SOURCE_LOCALE),
  targetLocale: z.string().trim().min(1),
  localePreset: z.string().trim().min(1).optional(),
  benchmarkBundleId: z.string().trim().min(1).optional(),
  benchmarkBundleVersion: z.string().trim().min(1).optional(),
  datasetBundleVersion: z.string().trim().min(1).optional(),
  generatedAt: z.string().trim().min(1).optional(),
  translator: z.string().trim().min(1).optional(),
  translationStatus: translationStatusSchema.default("draft"),
  modules: z.array(localizedModuleSchema).min(1),
})

export type TranslationStatus = z.infer<typeof translationStatusSchema>
export type LocalizedEscalationPrompt = z.infer<typeof localizedEscalationPromptSchema>
export type LocalizedScenario = z.infer<typeof localizedScenarioSchema>
export type LocalizedModule = z.infer<typeof localizedModuleSchema>
export type ScenarioLocalePack = z.infer<typeof scenarioLocalePackSchema>

function validateLocalizedPromptLevels(moduleId: string, scenarioId: string, levels: LocalizedEscalationPrompt[]): void {
  const seen = new Set<number>()
  for (const prompt of levels) {
    if (seen.has(prompt.level)) {
      throw new Error(`Locale pack scenario '${scenarioId}' in module '${moduleId}' has duplicate level ${prompt.level}.`)
    }
    seen.add(prompt.level)
  }

  for (const level of [1, 2, 3, 4, 5]) {
    if (!seen.has(level)) {
      throw new Error(`Locale pack scenario '${scenarioId}' in module '${moduleId}' is missing level ${level}.`)
    }
  }
}

function createLocalizedScenarioIndex(pack: ScenarioLocalePack) {
  const moduleMap = new Map<string, LocalizedModule>()
  const scenarioMap = new Map<string, { module: LocalizedModule; scenario: LocalizedScenario }>()

  for (const moduleDefinition of pack.modules) {
    moduleMap.set(moduleDefinition.id, moduleDefinition)
    for (const scenario of moduleDefinition.scenarios) {
      validateLocalizedPromptLevels(moduleDefinition.id, scenario.canonicalScenarioId, scenario.escalationPrompts)
      scenarioMap.set(scenario.canonicalScenarioId, { module: moduleDefinition, scenario })
    }
  }

  return { moduleMap, scenarioMap }
}

export function validateScenarioLocalePack(value: unknown, modules?: ScenarioModule[]): ScenarioLocalePack {
  const parsedResult = scenarioLocalePackSchema.safeParse(value)
  if (!parsedResult.success) {
    const missingScenarioIssue = parsedResult.error.issues.find(
      (issue) =>
        issue.code === "too_small" &&
        issue.path.length >= 4 &&
        issue.path[0] === "modules" &&
        typeof issue.path[1] === "number" &&
        issue.path[2] === "scenarios",
    )

    if (missingScenarioIssue && value && typeof value === "object") {
      const rawPack = value as {
        packId?: unknown
        modules?: Array<{ id?: unknown }>
      }
      const moduleIndex = missingScenarioIssue.path[1] as number
      const moduleId = rawPack.modules?.[moduleIndex]?.id
      throw new Error(
        `Locale pack '${typeof rawPack.packId === "string" ? rawPack.packId : "unknown"}' is missing scenario definitions for module '${typeof moduleId === "string" ? moduleId : moduleIndex}'.`,
      )
    }

    throw parsedResult.error
  }

  const parsed = parsedResult.data
  const sourceLocale = normalizeLocaleTag(parsed.sourceLocale)
  const targetLocale = normalizeLocaleTag(parsed.targetLocale)
  const normalized: ScenarioLocalePack = {
    ...parsed,
    sourceLocale,
    targetLocale,
  }

  if (!modules) {
    createLocalizedScenarioIndex(normalized)
    return normalized
  }

  const { moduleMap, scenarioMap } = createLocalizedScenarioIndex(normalized)
  for (const moduleDefinition of modules) {
    const localizedModule = moduleMap.get(String(moduleDefinition.id))
    if (!localizedModule) {
      throw new Error(`Locale pack '${normalized.packId}' is missing module '${moduleDefinition.id}'.`)
    }
    for (const scenario of moduleDefinition.scenarios) {
      const localizedScenario = scenarioMap.get(scenario.id)?.scenario
      if (!localizedScenario) {
        throw new Error(`Locale pack '${normalized.packId}' is missing scenario '${scenario.id}'.`)
      }
      for (const prompt of scenario.escalationPrompts) {
        const translatedPrompt = localizedScenario.escalationPrompts.find(
          (candidate) => candidate.level === prompt.level,
        )
        if (!translatedPrompt) {
          throw new Error(`Locale pack '${normalized.packId}' is missing scenario '${scenario.id}' level ${prompt.level}.`)
        }
      }
    }
  }

  return normalized
}

export function createScenarioLocalePack(params: {
  targetLocale: string
  modules: ScenarioModule[]
  sourceLocale?: string
  localePreset?: string
  benchmarkBundleId?: string
  benchmarkBundleVersion?: string
  datasetBundleVersion?: string
  translator?: string
  translationStatus?: TranslationStatus
  packId?: string
}): ScenarioLocalePack {
  const sourceLocale = normalizeLocaleTag(params.sourceLocale ?? DEFAULT_SOURCE_LOCALE)
  const targetLocale = normalizeLocaleTag(params.targetLocale)
  const packId = params.packId ?? `dystopiabench-${targetLocale}`

  return validateScenarioLocalePack({
    schemaVersion: 1,
    packId,
    sourceLocale,
    targetLocale,
    localePreset: params.localePreset,
    benchmarkBundleId: params.benchmarkBundleId,
    benchmarkBundleVersion: params.benchmarkBundleVersion,
    datasetBundleVersion: params.datasetBundleVersion,
    generatedAt: new Date().toISOString(),
    translator: params.translator,
    translationStatus: params.translationStatus ?? "draft",
    modules: params.modules.map((module) => ({
      id: String(module.id),
      label: module.label,
      description: module.description,
      scenarios: module.scenarios.map((scenario) => ({
        canonicalScenarioId: scenario.id,
        title: scenario.title,
        description: scenario.description,
        systemContext: scenario.systemContext,
        escalationPrompts: scenario.escalationPrompts.map((prompt) => ({
          level: prompt.level,
          label: prompt.label,
          prompt: prompt.prompt,
        })),
      })),
    })),
  })
}

export function applyScenarioLocalePack(modules: ScenarioModule[], pack: ScenarioLocalePack): ScenarioModule[] {
  const normalizedPack = validateScenarioLocalePack(pack, modules)
  const { moduleMap, scenarioMap } = createLocalizedScenarioIndex(normalizedPack)

  return validateScenarioModules(
    modules.map((moduleDefinition) => {
      const localizedModule = moduleMap.get(String(moduleDefinition.id))
      return {
        id: String(moduleDefinition.id),
        label: localizedModule?.label ?? moduleDefinition.label,
        description: localizedModule?.description ?? moduleDefinition.description,
        provenance: moduleDefinition.provenance,
        scenarios: moduleDefinition.scenarios.map((scenario) => {
          const localizedScenario = scenarioMap.get(scenario.id)?.scenario
          const promptsByLevel = new Map(
            (localizedScenario?.escalationPrompts ?? []).map((prompt) => [prompt.level as EscalationLevel, prompt] satisfies [EscalationLevel, LocalizedEscalationPrompt]),
          )

          return {
            id: scenario.id,
            title: localizedScenario?.title ?? scenario.title,
            category: scenario.category,
            description: localizedScenario?.description ?? scenario.description,
            systemContext: localizedScenario?.systemContext ?? scenario.systemContext,
            provenance: scenario.provenance,
            escalationPrompts: scenario.escalationPrompts.map((prompt) => ({
              level: prompt.level,
              label: promptsByLevel.get(prompt.level)?.label ?? prompt.label,
              prompt: promptsByLevel.get(prompt.level)?.prompt ?? prompt.prompt,
            })),
          }
        }),
      }
    }),
  )
}
