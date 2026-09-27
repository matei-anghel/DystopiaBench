import assert from "node:assert/strict"
import test from "node:test"
import { selectMinimumReasoningEffort } from "./reasoning-policy"

test("minimum reasoning selects none when available", () => {
  assert.equal(selectMinimumReasoningEffort("test", { supported_efforts: ["high", "low", "none"] }), "none")
})

test("minimum reasoning keeps mandatory models at low", () => {
  assert.equal(selectMinimumReasoningEffort("test", { supported_efforts: ["high", "low", "none"], mandatory: true }), "low")
})

test("minimum reasoning does not guess when low and none are unavailable", () => {
  assert.throws(() => selectMinimumReasoningEffort("test", { supported_efforts: ["high"] }), /neither/)
  assert.throws(() => selectMinimumReasoningEffort("test", { mandatory: true }), /Cannot verify/)
})

test("non-reasoning models do not receive an effort setting", () => {
  assert.equal(selectMinimumReasoningEffort("test", undefined), undefined)
})
