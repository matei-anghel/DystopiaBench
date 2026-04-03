import assert from "node:assert/strict"
import test from "node:test"
import { applyScenarioLocalePack, createScenarioLocalePack, validateScenarioLocalePack } from "./locale-packs"
import { buildScenarioSummaries } from "./exports"
import { makeScenarioModule } from "./test-fixtures"

test("locale packs localize scenario content while preserving canonical ids", () => {
  const modules = [makeScenarioModule()]
  const pack = createScenarioLocalePack({
    targetLocale: "fr",
    modules,
    packId: "fixture-fr",
  })

  pack.modules[0].label = "Module de test"
  pack.modules[0].description = "Description du module"
  pack.modules[0].scenarios[0].title = "Scenario FR"
  pack.modules[0].scenarios[0].description = "Description FR"
  pack.modules[0].scenarios[0].escalationPrompts[0].label = "N1"
  pack.modules[0].scenarios[0].escalationPrompts[0].prompt = "Invite en francais."

  const localized = applyScenarioLocalePack(modules, validateScenarioLocalePack(pack, modules))

  assert.equal(localized[0].id, modules[0].id)
  assert.equal(localized[0].label, "Module de test")
  assert.equal(localized[0].scenarios[0].id, modules[0].scenarios[0].id)
  assert.equal(localized[0].scenarios[0].title, "Scenario FR")
  assert.equal(localized[0].scenarios[0].escalationPrompts[0].label, "N1")
  assert.equal(localized[0].scenarios[0].escalationPrompts[0].prompt, "Invite en francais.")
})

test("locale packs must cover every scenario when validated against modules", () => {
  const modules = [makeScenarioModule()]
  const pack = createScenarioLocalePack({
    targetLocale: "de",
    modules,
    packId: "fixture-de",
  })

  pack.modules[0].scenarios = []

  assert.throws(() => validateScenarioLocalePack(pack, modules), (error) => {
    const message = error instanceof Error ? error.message : String(error)
    return /Array must contain at least 1 element|missing scenario|too_small/.test(message)
  })
})

test("scenario summaries stay separated by locale", () => {
  const summaries = buildScenarioSummaries([
    {
      scenarioId: "fixture-001",
      canonicalScenarioId: "fixture-001",
      scenarioTitle: "Fixture Scenario",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "gpt-5.3-codex",
      modelLabel: "GPT 5.3 Codex",
      provider: "OpenAI",
      modelString: "openai/gpt-5.3-codex",
      level: 1,
      prompt: "Prompt EN",
      response: "Refusal",
      compliance: "refusal",
      score: 0,
      status: "ok",
      scorable: true,
      promptLocale: "en",
      sourceLocale: "en",
      timestamp: 1,
    },
    {
      scenarioId: "fixture-001",
      canonicalScenarioId: "fixture-001",
      scenarioTitle: "Scenario FR",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "gpt-5.3-codex",
      modelLabel: "GPT 5.3 Codex",
      provider: "OpenAI",
      modelString: "openai/gpt-5.3-codex",
      level: 1,
      prompt: "Prompt FR",
      response: "Hesitant",
      compliance: "hesitant",
      score: 33,
      status: "ok",
      scorable: true,
      promptLocale: "fr",
      sourceLocale: "en",
      timestamp: 2,
    },
  ])

  assert.equal(summaries.length, 2)
  assert.deepEqual(
    summaries.map((row) => row.promptLocale),
    ["en", "fr"],
  )
})
