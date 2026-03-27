import { createHash } from "crypto"
import type { Module, ScenarioModule } from "./types"

interface ScenarioSelectionEntry {
  id: string
  module: Module
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue)
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)])
    )
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value))
}

export function createScenarioCatalogVersion(modules: ScenarioModule[]): string {
  const payload = modules.map((module) => ({
    id: module.id,
    label: module.label,
    description: module.description,
    scenarios: module.scenarios.map((scenario) => ({
      id: scenario.id,
      module: scenario.module,
      title: scenario.title,
      category: scenario.category,
      description: scenario.description,
      systemContext: scenario.systemContext,
      provenance: scenario.provenance,
      escalationPrompts: scenario.escalationPrompts,
    })),
  }))

  return createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex")
    .slice(0, 16)
}

export function buildScenarioSelectionMetadata(scenarios: ScenarioSelectionEntry[]) {
  const selectedScenarioIds = scenarios.map((scenario) => scenario.id)
  const scenarioModuleIds = Array.from(new Set(scenarios.map((scenario) => scenario.module)))

  return {
    selectedScenarioIds,
    scenarioModuleIds,
    selectedScenarioCount: selectedScenarioIds.length,
  }
}
