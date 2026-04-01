import assert from "node:assert/strict"
import test from "node:test"
import { parseModelIdentifier } from "./model-selectors"
import { getEstimatedPricingByModelKey, getModelById, getModelByModelString } from "./models"

test("getModelById resolves known curated models", () => {
  const model = getModelById("deepseek-v3.2")

  assert.ok(model)
  assert.equal(model.id, "deepseek-v3.2")
})

test("getModelById rejects prototype-property keys", () => {
  assert.equal(getModelById("__proto__"), undefined)
  assert.equal(getModelById("constructor"), undefined)
  assert.equal(getModelById("toString"), undefined)
})

test("getModelByModelString rejects unknown keys and prototype-property keys", () => {
  assert.equal(getModelByModelString("deepseek/deepseek-v3.2")?.id, "deepseek-v3.2")
  assert.equal(getModelByModelString("__proto__"), undefined)
})

test("parseModelIdentifier treats prototype-property keys as unknown model ids", () => {
  assert.throws(
    () => parseModelIdentifier("__proto__"),
    /Unknown model identifier '__proto__'/
  )
})

test("getEstimatedPricingByModelKey falls back for unknown keys", () => {
  assert.deepEqual(getEstimatedPricingByModelKey("__proto__"), { input: 2, output: 8 })
})
