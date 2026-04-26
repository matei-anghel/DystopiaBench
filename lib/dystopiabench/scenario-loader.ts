import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, extname, isAbsolute, join, resolve } from "node:path"
import {
  scenarioModuleDefinitionSchema,
  validateScenarioModules,
  type ScenarioModuleDefinition,
} from "./scenario-schema"
import { inferSplitFromReleaseTier, normalizeScenarioProvenance } from "./governance"
import { CORE_REGISTERED_MODULES } from "./scenario-registry"
import type { ScenarioModule } from "./types"

export interface ScenarioSourceConfig {
  source: string
  namespace?: string
  releaseTier?: "core-public" | "holdout" | "partner-only" | "organization-local"
  author?: string
}

function parseScenarioSourceConfig(input: string | ScenarioSourceConfig): ScenarioSourceConfig {
  if (typeof input === "string") {
    return { source: input }
  }
  return input
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

function isNpmSource(value: string): boolean {
  return value.startsWith("npm:")
}

function normalizeNamespace(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^\/+|\/+$/g, "")
}

function applyNamespace(moduleDefinition: ScenarioModuleDefinition, namespace: string | undefined): ScenarioModuleDefinition {
  const normalizedNamespace = normalizeNamespace(namespace)
  if (!normalizedNamespace) return moduleDefinition
  if (moduleDefinition.id.includes("/")) return moduleDefinition

  return {
    ...moduleDefinition,
    id: `${normalizedNamespace}/${moduleDefinition.id}`,
    scenarios: moduleDefinition.scenarios.map((scenario) => ({
      ...scenario,
      id: scenario.id.includes("/") ? scenario.id : `${normalizedNamespace}/${scenario.id}`,
    })),
  }
}

function inferSourceType(source: string): "core" | "local" | "bundle" | "url" | "npm" {
  if (source === "core") return "core"
  if (isNpmSource(source)) return "npm"
  if (isHttpUrl(source)) return "url"
  return source.endsWith(".json") ? "bundle" : "local"
}

function applyProvenanceDefaults(
  moduleDefinition: ScenarioModuleDefinition,
  sourceConfig: ScenarioSourceConfig,
): ScenarioModuleDefinition {
  const sourceType = inferSourceType(sourceConfig.source)
  const releaseTier = sourceConfig.releaseTier ?? (sourceType === "core" ? "core-public" : "organization-local")
  const author = sourceConfig.author ?? (sourceType === "core" ? "DystopiaBench" : "External")
  const timestamp = new Date().toISOString().slice(0, 10)
  const split = inferSplitFromReleaseTier(releaseTier)
  const reviewStatus = sourceType === "core" ? "approved" : "draft"
  const sensitivityTier = split === "public-core" ? "public" : "internal"

  const moduleProvenance = normalizeScenarioProvenance({
    sourceType,
    releaseTier,
    split,
    author,
    createdAt: moduleDefinition.provenance?.createdAt ?? timestamp,
    updatedAt: moduleDefinition.provenance?.updatedAt ?? timestamp,
    reviewStatus,
    annotationRubricVersion: moduleDefinition.provenance?.annotationRubricVersion,
    reviewers: moduleDefinition.provenance?.reviewers,
    adjudicatedBy: moduleDefinition.provenance?.adjudicatedBy,
    citations: moduleDefinition.provenance?.citations,
    knownLimitations: moduleDefinition.provenance?.knownLimitations,
    contaminationRisk: moduleDefinition.provenance?.contaminationRisk ?? "low",
    sensitivityTier: moduleDefinition.provenance?.sensitivityTier ?? sensitivityTier,
    canaryTokens: moduleDefinition.provenance?.canaryTokens,
  })

  return {
    ...moduleDefinition,
    provenance: normalizeScenarioProvenance(moduleDefinition.provenance, moduleProvenance),
    scenarios: moduleDefinition.scenarios.map((scenario) => ({
      ...scenario,
      provenance: normalizeScenarioProvenance(scenario.provenance, moduleProvenance),
    })),
  }
}

function resolveSourcePath(source: string, cwd = process.cwd()): string {
  if (isNpmSource(source)) {
    const packageSpecifier = source.slice(4)
    if (!packageSpecifier) {
      throw new Error("Invalid npm scenario source. Use the form npm:<package-or-subpath>.")
    }

    const requireFromCwd = createRequire(join(resolve(cwd), "__dystopiabench_loader__.cjs"))
    try {
      return requireFromCwd.resolve(packageSpecifier)
    } catch {
      const packageJsonPath = requireFromCwd.resolve(`${packageSpecifier}/package.json`)
      return dirname(packageJsonPath)
    }
  }

  if (isAbsolute(source)) return source
  return resolve(cwd, source)
}

function loadModuleDefinitionFile(filePath: string): ScenarioModuleDefinition[] {
  const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
  if (Array.isArray(parsed)) {
    return parsed.map((value) => scenarioModuleDefinitionSchema.parse(value))
  }
  return [scenarioModuleDefinitionSchema.parse(parsed)]
}

function loadModuleDefinitionsFromPath(filePath: string): ScenarioModuleDefinition[] {
  if (!existsSync(filePath)) {
    throw new Error(`Scenario source not found: ${filePath}`)
  }

  const stat = statSync(filePath)
  if (!stat.isDirectory() && !stat.isFile()) {
    throw new Error(`Unsupported scenario source path: ${filePath}`)
  }

  const extension = extname(filePath).toLowerCase()
  if (extension === ".json") {
    return loadModuleDefinitionFile(filePath)
  }

  if (stat.isFile()) {
    throw new Error(
      `Scenario source file must be a JSON module or directory of JSON files: ${filePath}`
    )
  }

  const jsonFiles = readdirSync(filePath)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => join(filePath, entry))

  if (jsonFiles.length === 0) {
    throw new Error(`Scenario source directory has no JSON files: ${filePath}`)
  }

  return jsonFiles.flatMap((jsonFile) => loadModuleDefinitionFile(jsonFile))
}

async function loadModuleDefinitionsFromUrl(url: string): Promise<ScenarioModuleDefinition[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load scenario source from ${url}: HTTP ${response.status}`)
  }
  const parsed = (await response.json()) as unknown
  if (Array.isArray(parsed)) {
    return parsed.map((value) => scenarioModuleDefinitionSchema.parse(value))
  }
  return [scenarioModuleDefinitionSchema.parse(parsed)]
}

export async function loadScenarioModulesFromSources(
  sources: Array<string | ScenarioSourceConfig>,
  cwd = process.cwd(),
): Promise<ScenarioModule[]> {
  const collected: ScenarioModuleDefinition[] = []

  for (const rawSource of sources) {
    const sourceConfig = parseScenarioSourceConfig(rawSource)
    if (sourceConfig.source === "core") {
      collected.push(
        ...CORE_REGISTERED_MODULES.map((module) => ({
          id: String(module.id),
          label: module.label,
          description: module.description,
          scenarios: module.scenarios.map((scenario) => ({
            id: scenario.id,
            title: scenario.title,
            category: scenario.category,
            description: scenario.description,
            systemContext: scenario.systemContext,
            primaryMechanism: scenario.primaryMechanism,
            secondaryMechanisms: scenario.secondaryMechanisms,
            compatibility: scenario.compatibility,
            provenance: scenario.provenance,
            escalationPrompts: scenario.escalationPrompts,
          })),
        })),
      )
      continue
    }

    const loadedDefinitions = isHttpUrl(sourceConfig.source)
      ? await loadModuleDefinitionsFromUrl(sourceConfig.source)
      : loadModuleDefinitionsFromPath(resolveSourcePath(sourceConfig.source, cwd))

    for (const moduleDefinition of loadedDefinitions) {
      collected.push(applyProvenanceDefaults(applyNamespace(moduleDefinition, sourceConfig.namespace), sourceConfig))
    }
  }

  return validateScenarioModules(collected)
}

export async function loadScenarioCatalog(
  sources: Array<string | ScenarioSourceConfig> = ["core"],
  cwd = process.cwd(),
) {
  const modules = await loadScenarioModulesFromSources(sources, cwd)
  return {
    modules,
  }
}
