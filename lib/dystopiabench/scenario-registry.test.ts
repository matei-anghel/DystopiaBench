import assert from "node:assert/strict"
import test from "node:test"
import { validateScenarioModules } from "./scenario-schema"
import { ALL_MODULES, ALL_SCENARIOS, getModuleById, getScenarioById } from "./scenario-registry"

test("active registry excludes temporarily disabled core modules", () => {
  assert.equal(ALL_MODULES.length, 6)
  assert.equal(ALL_SCENARIOS.length, 36)
  assert.equal(getModuleById("kafka"), undefined)
  assert.equal(getModuleById("pkd"), undefined)
  assert.equal(getScenarioById("kafka-01"), undefined)
  assert.equal(getScenarioById("pkd-01"), undefined)
})

test("validateScenarioModules injects the parent module onto flattened scenarios", () => {
  const [module] = validateScenarioModules([
    {
      id: "test-module",
      label: "Test Module",
      description: "Test description",
      scenarios: [
        {
          id: "test-001",
          title: "Scenario",
          category: "Category",
          description: "Description",
          escalationPrompts: [
            { level: 1, label: "L1", prompt: "one" },
            { level: 2, label: "L2", prompt: "two" },
            { level: 3, label: "L3", prompt: "three" },
            { level: 4, label: "L4", prompt: "four" },
            { level: 5, label: "L5", prompt: "five" },
          ],
        },
      ],
    },
  ])

  assert.equal(module.id, "test-module")
  assert.equal(module.scenarios[0].module, module.id)
})

test("validateScenarioModules rejects duplicate scenario ids across modules", () => {
  assert.throws(
    () =>
      validateScenarioModules([
        {
          id: "left",
          label: "Left",
          description: "Left description",
          scenarios: [
            {
              id: "duplicate-001",
              title: "A",
              category: "Cat",
              description: "Desc",
              escalationPrompts: [
                { level: 1, label: "L1", prompt: "one" },
                { level: 2, label: "L2", prompt: "two" },
                { level: 3, label: "L3", prompt: "three" },
                { level: 4, label: "L4", prompt: "four" },
                { level: 5, label: "L5", prompt: "five" },
              ],
            },
          ],
        },
        {
          id: "right",
          label: "Right",
          description: "Right description",
          scenarios: [
            {
              id: "duplicate-001",
              title: "B",
              category: "Cat",
              description: "Desc",
              escalationPrompts: [
                { level: 1, label: "L1", prompt: "one" },
                { level: 2, label: "L2", prompt: "two" },
                { level: 3, label: "L3", prompt: "three" },
                { level: 4, label: "L4", prompt: "four" },
                { level: 5, label: "L5", prompt: "five" },
              ],
            },
          ],
        },
      ]),
    /Duplicate scenario id/
  )
})

test("validateScenarioModules rejects duplicate escalation levels within a scenario", () => {
  assert.throws(
    () =>
      validateScenarioModules([
        {
          id: "dup-levels",
          label: "Duplicate Levels",
          description: "Desc",
          scenarios: [
            {
              id: "dup-levels-001",
              title: "Scenario",
              category: "Cat",
              description: "Desc",
              escalationPrompts: [
                { level: 1, label: "L1", prompt: "one" },
                { level: 1, label: "L1b", prompt: "duplicate" },
                { level: 3, label: "L3", prompt: "three" },
                { level: 4, label: "L4", prompt: "four" },
                { level: 5, label: "L5", prompt: "five" },
              ],
            },
          ],
        },
      ]),
    /duplicate escalation level/i
  )
})

test("mechanism taxonomy refactor preserves moved scenario ids with compatibility metadata", () => {
  const movedScenarios = [
    { id: "orwell-03", originalModule: "petrov", currentModule: "orwell" },
    { id: "basaglia-03", originalModule: "orwell", currentModule: "basaglia" },
  ]

  for (const expected of movedScenarios) {
    const scenario = getScenarioById(expected.id)
    assert.ok(scenario)
    assert.ok(scenario.compatibility)
    assert.equal(scenario.module, expected.currentModule)
    assert.equal(scenario.primaryMechanism, scenario.module === "orwell" ? "population-surveillance-control" : "coercive-care-compliance")
    assert.deepEqual(scenario.compatibility, {
      originalModule: expected.originalModule,
      currentModule: expected.currentModule,
      taxonomyVersion: "mechanism-v2",
      refactorReason: scenario.compatibility.refactorReason,
    })
    assert.ok(scenario.compatibility.refactorReason)
  }
})
