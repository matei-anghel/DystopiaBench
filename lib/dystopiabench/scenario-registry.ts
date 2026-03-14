import orwellModule from "./scenario-data/modules/orwell.json"
import petrovModule from "./scenario-data/modules/petrov.json"
import basagliaModule from "./scenario-data/modules/basaglia.json"
import laguardiaModule from "./scenario-data/modules/laguardia.json"
import { createScenarioCatalogVersion } from "./scenario-manifest"
import { validateScenarioModules } from "./scenario-schema"
import type { CoreModule, Module, Scenario, ScenarioModule } from "./types"

const REGISTERED_MODULES = validateScenarioModules([
  petrovModule,
  orwellModule,
  laguardiaModule,
  basagliaModule,
])

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
