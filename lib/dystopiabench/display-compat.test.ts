import assert from "node:assert/strict"
import test from "node:test"
import { isDashboardDisplayCompatibleMetadata } from "./display-compat"
import { ALL_SCENARIOS, SCENARIO_CATALOG_VERSION } from "./scenarios"

type DisplayMetadata = Parameters<typeof isDashboardDisplayCompatibleMetadata>[0]

function makeMetadata(overrides: Partial<DisplayMetadata> = {}): DisplayMetadata {
  return {
    scenarioCatalogVersion: SCENARIO_CATALOG_VERSION,
    selectedScenarioIds: ALL_SCENARIOS.map((scenario) => scenario.id),
    selectedScenarioCount: ALL_SCENARIOS.length,
    ...overrides,
  }
}

test("dashboard display accepts a run that matches the current full scenario set", () => {
  assert.equal(isDashboardDisplayCompatibleMetadata(makeMetadata()), true)
})

test("dashboard display rejects stale scenario catalog versions when only counts are available", () => {
  assert.equal(
    isDashboardDisplayCompatibleMetadata(
      makeMetadata({
        scenarioCatalogVersion: "stale-catalog",
        selectedScenarioIds: undefined,
      }),
    ),
    false,
  )
})

test("dashboard display accepts partial scenario selections when they are an active subset", () => {
  assert.equal(
    isDashboardDisplayCompatibleMetadata(
      makeMetadata({
        selectedScenarioIds: ALL_SCENARIOS.slice(0, Math.max(1, ALL_SCENARIOS.length - 1)).map((scenario) => scenario.id),
        selectedScenarioCount: Math.max(1, ALL_SCENARIOS.length - 1),
      }),
    ),
    true,
  )
})

test("dashboard display rejects scenario selections that reference unknown ids", () => {
  assert.equal(
    isDashboardDisplayCompatibleMetadata(
      makeMetadata({
        selectedScenarioIds: [...ALL_SCENARIOS.slice(0, 2).map((scenario) => scenario.id), "kafka-01"],
        selectedScenarioCount: 3,
      }),
    ),
    false,
  )
})

test("dashboard display falls back to benchmarkDefinition metadata when needed", () => {
  assert.equal(
    isDashboardDisplayCompatibleMetadata(
      makeMetadata({
        scenarioCatalogVersion: undefined,
        selectedScenarioIds: undefined,
        selectedScenarioCount: undefined,
        benchmarkDefinition: {
          benchmarkId: "dystopiabench-core",
          scenarioCatalogVersion: SCENARIO_CATALOG_VERSION,
          selectedScenarioIds: ALL_SCENARIOS.map((scenario) => scenario.id),
          selectedScenarioCount: ALL_SCENARIOS.length,
          systemPromptVersion: "v5",
          benchmarkPromptVersion: "v6",
          judgePromptVersion: "v6",
        },
      }),
    ),
    true,
  )
})
