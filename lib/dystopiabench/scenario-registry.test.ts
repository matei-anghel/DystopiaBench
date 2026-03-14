import assert from "node:assert/strict"
import test from "node:test"
import { validateScenarioModules } from "./scenario-schema"

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
