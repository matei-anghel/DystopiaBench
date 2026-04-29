import orwellModule from "./scenario-data/modules/orwell.json"
import petrovModule from "./scenario-data/modules/petrov.json"
import basagliaModule from "./scenario-data/modules/basaglia.json"
import laguardiaModule from "./scenario-data/modules/laguardia.json"
import huxleyModule from "./scenario-data/modules/huxley.json"
import kafkaModule from "./scenario-data/modules/kafka.json"
import pkdModule from "./scenario-data/modules/pkd.json"
import baudrillardModule from "./scenario-data/modules/baudrillard.json"
import { createScenarioCatalogVersion } from "./scenario-manifest"
import { validateScenarioModules } from "./scenario-schema"
import type { CoreModule, Module, Scenario, ScenarioModule } from "./types"

export const TEMP_DISABLED_CORE_MODULE_IDS = new Set<CoreModule>(["kafka", "pkd"])

function withCoreProvenance(rawModule: unknown): unknown {
  if (!rawModule || typeof rawModule !== "object") return rawModule
  const moduleDefinition = rawModule as {
    scenarios?: unknown[]
    provenance?: unknown
  } & Record<string, unknown>

  return {
    ...moduleDefinition,
    provenance: {
      sourceType: "core",
      author: "DystopiaBench",
      createdAt: "2026-03-27",
      updatedAt: "2026-03-27",
      releaseTier: "core-public",
      split: "public-core",
      reviewStatus: "approved",
      annotationRubricVersion: "dcs-4tier-v2",
      reviewers: ["core-team"],
      adjudicatedBy: ["core-team"],
      citations: [{ title: "DystopiaBench core registry", source: "internal" }],
      knownLimitations: ["Public core scenarios may be exposed to training contamination over time."],
      contaminationRisk: "medium",
      sensitivityTier: "public",
      ...(moduleDefinition.provenance && typeof moduleDefinition.provenance === "object" ? moduleDefinition.provenance : {}),
    },
    scenarios: Array.isArray(moduleDefinition.scenarios)
      ? moduleDefinition.scenarios.map((scenario) => ({
          ...(typeof scenario === "object" && scenario ? scenario : {}),
          provenance: {
            sourceType: "core",
            author: "DystopiaBench",
            createdAt: "2026-03-27",
            updatedAt: "2026-03-27",
            releaseTier: "core-public",
            split: "public-core",
            reviewStatus: "approved",
            annotationRubricVersion: "dcs-4tier-v2",
            reviewers: ["core-team"],
            adjudicatedBy: ["core-team"],
            citations: [{ title: "DystopiaBench core registry", source: "internal" }],
            knownLimitations: ["Public core scenarios may be exposed to training contamination over time."],
            contaminationRisk: "medium",
            sensitivityTier: "public",
            ...(
              typeof scenario === "object" &&
              scenario &&
              "provenance" in scenario &&
              typeof (scenario as { provenance?: unknown }).provenance === "object"
                ? (scenario as { provenance?: Record<string, unknown> }).provenance
                : {}
            ),
          },
        }))
      : [],
  }
}

const FULL_CORE_REGISTERED_MODULES = validateScenarioModules([
  withCoreProvenance(petrovModule),
  withCoreProvenance(orwellModule),
  withCoreProvenance(laguardiaModule),
  withCoreProvenance(basagliaModule),
  withCoreProvenance(huxleyModule),
  withCoreProvenance(kafkaModule),
  withCoreProvenance(pkdModule),
  withCoreProvenance(baudrillardModule),
])

export const CORE_REGISTERED_MODULES = FULL_CORE_REGISTERED_MODULES.filter(
  (module) => !TEMP_DISABLED_CORE_MODULE_IDS.has(module.id as CoreModule),
)

const REGISTERED_MODULES = CORE_REGISTERED_MODULES

export const ALL_MODULES: ScenarioModule[] = REGISTERED_MODULES
export const ALL_SCENARIOS: Scenario[] = ALL_MODULES.flatMap((module) => module.scenarios)
export const MODULES_BY_ID = new Map<Module, ScenarioModule>(
  ALL_MODULES.map((module) => [module.id, module])
)
export const SCENARIOS_BY_ID = new Map<string, Scenario>(
  ALL_SCENARIOS.map((scenario) => [scenario.id, scenario])
)
export const SCENARIOS_BY_MODULE = new Map<Module, Scenario[]>(
  ALL_MODULES.map((module) => [module.id, module.scenarios])
)

export const PETROV_SCENARIOS = getRequiredCoreModule("petrov").scenarios
export const ORWELL_SCENARIOS = getRequiredCoreModule("orwell").scenarios
export const SCENARIO_CATALOG_VERSION = createScenarioCatalogVersion(ALL_MODULES)

function getRequiredCoreModule(moduleId: CoreModule): ScenarioModule {
  const scenarioModule = MODULES_BY_ID.get(moduleId)
  if (!scenarioModule) {
    throw new Error(`Missing required core module '${moduleId}' in scenario registry.`)
  }
  return scenarioModule
}

export function getModuleById(moduleId: Module | string): ScenarioModule | undefined {
  return MODULES_BY_ID.get(moduleId as Module)
}

export function getScenariosByModule(module: Module | string): Scenario[] {
  return SCENARIOS_BY_MODULE.get(module as Module) ?? []
}

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS_BY_ID.get(id)
}

export function getRegisteredModuleIds(): Module[] {
  return ALL_MODULES.map((module) => module.id)
}

export function createScenarioRegistry(modules: ScenarioModule[]) {
  const allScenarios = modules.flatMap((module) => module.scenarios)
  const modulesById = new Map<Module, ScenarioModule>(
    modules.map((module) => [module.id, module])
  )
  const scenariosById = new Map<string, Scenario>(
    allScenarios.map((scenario) => [scenario.id, scenario])
  )
  const scenariosByModule = new Map<Module, Scenario[]>(
    modules.map((module) => [module.id, module.scenarios])
  )

  return {
    modules,
    scenarios: allScenarios,
    modulesById,
    scenariosById,
    scenariosByModule,
    scenarioCatalogVersion: createScenarioCatalogVersion(modules),
  }
}
