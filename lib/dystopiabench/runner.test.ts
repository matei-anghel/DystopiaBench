import assert from "node:assert/strict"
import test from "node:test"
import { DEFAULT_JUDGE_MODEL } from "./models"
import { resolveJudgeModels } from "./model-selectors"

test("resolveJudgeModels returns the default judge model when input is undefined", () => {
  const result = resolveJudgeModels(undefined)
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels returns the default judge model when input is empty", () => {
  const result = resolveJudgeModels([])
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels returns the fallback model when input is undefined", () => {
  const fallback = "openrouter:gpt-4"
  const result = resolveJudgeModels(undefined, fallback)
  assert.deepEqual(result, [fallback])
})

test("resolveJudgeModels returns input models when provided", () => {
  const input = ["openrouter:gpt-4", "local:claude-3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, input)
})

test("resolveJudgeModels trims whitespace and filters empty strings", () => {
  const input = [" openrouter:gpt-4 ", " ", ""]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:gpt-4"])
})

test("resolveJudgeModels falls back to the default model when inputs are blank", () => {
  const input = [" ", ""]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels deduplicates models", () => {
  const input = ["openrouter:gpt-4", " openrouter:gpt-4 ", "local:claude-3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:gpt-4", "local:claude-3"])
})

test("resolveJudgeModels throws for invalid model identifiers", () => {
  assert.throws(
    () => resolveJudgeModels(["invalid:"]),
    /missing model after provider prefix/
  )
})

test("resolveJudgeModels handles local selectors", () => {
  const input = ["local:llama3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["local:llama3"])
})

test("resolveJudgeModels handles openrouter selectors", () => {
  const input = ["openrouter:openai/gpt-4o"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:openai/gpt-4o"])
})
