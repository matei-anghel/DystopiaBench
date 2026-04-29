import { ALL_MODULES, ALL_SCENARIOS, SCENARIO_CATALOG_VERSION } from "./scenarios"
import type { RunMetadataV2 } from "./schemas"

type DisplayMetadata = Pick<
  RunMetadataV2,
  "benchmarkDefinition" | "scenarioCatalogVersion" | "selectedScenarioIds" | "selectedScenarioCount"
>

const CURRENT_SCENARIO_IDS = ALL_SCENARIOS.map((scenario) => scenario.id)
const CURRENT_SCENARIO_ID_SET = new Set(CURRENT_SCENARIO_IDS)
const CURRENT_MODULE_ID_SET = new Set(ALL_MODULES.map((module) => String(module.id)))

function getScenarioCatalogVersion(metadata: DisplayMetadata): string | undefined {
  return metadata.scenarioCatalogVersion ?? metadata.benchmarkDefinition?.scenarioCatalogVersion
}

function getSelectedScenarioIds(metadata: DisplayMetadata): string[] | undefined {
  return metadata.selectedScenarioIds ?? metadata.benchmarkDefinition?.selectedScenarioIds
}

function getSelectedScenarioCount(metadata: DisplayMetadata): number | undefined {
  return metadata.selectedScenarioCount ?? metadata.benchmarkDefinition?.selectedScenarioCount
}

function isActiveScenarioSubset(selectedScenarioIds: string[]): boolean {
  if (selectedScenarioIds.length === 0) return false
  const selectedSet = new Set(selectedScenarioIds)
  if (selectedSet.size !== selectedScenarioIds.length) return false

  for (const scenarioId of selectedSet) {
    if (!CURRENT_SCENARIO_ID_SET.has(scenarioId)) return false
  }

  return true
}

export function isActiveScenarioId(scenarioId: string): boolean {
  return CURRENT_SCENARIO_ID_SET.has(scenarioId)
}

export function isActiveModuleId(moduleId: string): boolean {
  return CURRENT_MODULE_ID_SET.has(moduleId)
}

export function isDashboardDisplayCompatibleMetadata(metadata: DisplayMetadata): boolean {
  const selectedScenarioIds = getSelectedScenarioIds(metadata)
  if (selectedScenarioIds && selectedScenarioIds.length > 0) {
    return isActiveScenarioSubset(selectedScenarioIds)
  }

  if (getScenarioCatalogVersion(metadata) !== SCENARIO_CATALOG_VERSION) {
    return false
  }

  return getSelectedScenarioCount(metadata) === CURRENT_SCENARIO_IDS.length
}
