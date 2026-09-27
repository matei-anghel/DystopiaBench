import assert from "node:assert/strict"
import test from "node:test"
import { parseModelIdentifier } from "./model-selectors"
import {
  AVAILABLE_MODELS,
  DEFAULT_JUDGE_MODEL,
  JUDGE_MODEL_OPTIONS,
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
  PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
  getEstimatedPricingByModelKey,
  getModelById,
  getModelByModelString,
} from "./models"

test("upcoming roster contains exactly the requested model slugs", () => {
  assert.deepEqual(AVAILABLE_MODELS.map((model) => model.modelString), [
    "anthropic/claude-fable-5.1:batch",
    "anthropic/claude-opus-5.5:batch",
    "anthropic/claude-sonnet-5:batch",
    "openai/gpt-6-astra:batch",
    "openai/gpt-6-sol:batch",
    "openai/gpt-6-luna:batch",
    "x-ai/grok-4.7",
    "google/gemini-3.8-flash:batch",
    "meta/muse-spark-1.3",
    "moonshotai/kimi-k3",
    "deepseek/deepseek-v4.1-flash",
    "z-ai/glm-5.3",
    "qwen/qwen3.8-max-0902",
  ])
})

test("getModelById resolves known curated models", () => {
  const model = getModelById("deepseek-v3.2")

  assert.ok(model)
  assert.equal(model.id, "deepseek-v3.2")
})

test("getModelById resolves Grok 4.3 curated model", () => {
  const model = getModelById("grok-4.3")

  assert.ok(model)
  assert.equal(model.modelString, "x-ai/grok-4.3")
  assert.deepEqual(getEstimatedPricingByModelKey("grok-4.3"), { input: 1.25, output: 2.5 })
})

test("getModelById resolves Mistral Medium 3.5 curated model", () => {
  const mistral = getModelById("mistral-medium-3-5")

  assert.ok(mistral)
  assert.equal(mistral.modelString, "mistralai/mistral-medium-3-5")
  assert.equal(getModelByModelString("mistralai/mistral-medium-3-5")?.id, "mistral-medium-3-5")
  assert.deepEqual(getEstimatedPricingByModelKey("mistral-medium-3-5"), { input: 1.5, output: 7.5 })
  assert.deepEqual(getEstimatedPricingByModelKey("mistralai/mistral-medium-3-5"), { input: 1.5, output: 7.5 })
})

test("getModelById resolves newly added run-bank models", () => {
  const expectedModels = [
    ["claude-opus-4.8", "anthropic/claude-opus-4.8", { input: 5.0, output: 25.0 }],
    ["nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-ultra-550b-a55b", { input: 0.5, output: 2.5 }],
    ["qwen3.7-plus", "qwen/qwen3.7-plus", { input: 0.32, output: 1.28 }],
    ["qwen3.7-max", "qwen/qwen3.7-max", { input: 1.25, output: 3.75 }],
    ["minimax-m3", "minimax/minimax-m3", { input: 0.3, output: 1.2 }],
    ["kimi-k2.7-code", "moonshotai/kimi-k2.7-code", { input: 0.95, output: 4.0 }],
    ["grok-build-0.1", "x-ai/grok-build-0.1", { input: 1.0, output: 2.0 }],
    ["gemini-3.5-flash", "google/gemini-3.5-flash", { input: 1.5, output: 9.0 }],
  ] as const

  for (const [id, modelString, pricing] of expectedModels) {
    const model = getModelById(id)
    assert.ok(model, id)
    assert.equal(model.modelString, modelString)
    assert.equal(getModelByModelString(modelString)?.id, id)
    assert.deepEqual(getEstimatedPricingByModelKey(id), pricing)
    assert.deepEqual(getEstimatedPricingByModelKey(modelString), pricing)
  }
})

test("getModelById rejects prototype-property keys", () => {
  assert.equal(getModelById("__proto__"), undefined)
  assert.equal(getModelById("constructor"), undefined)
  assert.equal(getModelById("toString"), undefined)
})

test("getEstimatedPricingByModelKey resolves Claude Fable 5 LiteLLM pricing", () => {
  assert.deepEqual(getEstimatedPricingByModelKey("claude-fable-5"), { input: 10.0, output: 50.0 })
  assert.deepEqual(getEstimatedPricingByModelKey("litellm:claude-fable-5"), { input: 10.0, output: 50.0 })
  assert.deepEqual(getEstimatedPricingByModelKey("anthropic/claude-fable-5"), { input: 10.0, output: 50.0 })
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

test("parseModelIdentifier resolves curated ids and OpenRouter model strings", () => {
  assert.deepEqual(
    parseModelIdentifier("deepseek-v3.2"),
    {
      id: "deepseek-v3.2",
      label: "DeepSeek V3.2",
      provider: "DeepSeek",
      modelString: "deepseek/deepseek-v3.2",
      backend: "openrouter",
      weightClass: "open_weight",
    },
  )

  const byModelString = parseModelIdentifier("deepseek/deepseek-v3.2")
  assert.equal(byModelString.id, "deepseek-v3.2")
  assert.equal(byModelString.backend, "openrouter")
})

test("parseModelIdentifier handles explicit openrouter and local prefixes", () => {
  assert.deepEqual(parseModelIdentifier("openrouter:openai/gpt-4o"), {
    id: "openrouter:openai/gpt-4o",
    label: "OpenRouter openai/gpt-4o",
    provider: "OpenRouter",
    modelString: "openai/gpt-4o",
    backend: "openrouter",
    weightClass: "unknown",
  })

  assert.deepEqual(parseModelIdentifier("local:llama3"), {
    id: "local:llama3",
    label: "Local llama3",
    provider: "Local",
    modelString: "llama3",
    backend: "local",
    weightClass: "unknown",
  })
})

test("parseModelIdentifier rejects empty and unsupported provider-prefixed selectors", () => {
  assert.throws(
    () => parseModelIdentifier("   "),
    /cannot be empty/,
  )
  assert.throws(
    () => parseModelIdentifier("anthropic:claude-3"),
    /Unknown model identifier 'anthropic:claude-3'/,
  )
  assert.throws(
    () => parseModelIdentifier("openrouter:"),
    /missing model after provider prefix/,
  )
})

test("getEstimatedPricingByModelKey falls back for unknown keys", () => {
  assert.deepEqual(getEstimatedPricingByModelKey("__proto__"), { input: 2, output: 8 })
})

test("JUDGE_MODEL_OPTIONS exposes the supported curated judge set", () => {
  const ids = new Set(JUDGE_MODEL_OPTIONS.map((model) => model.id))

  for (const id of ["glm-5.1", "gemini-3.5-flash", "claude-opus-4.8", "claude-haiku-4.5"]) {
    assert.ok(ids.has(id), id)
  }
  for (const id of ["gemini-3-flash-preview", "claude-opus-4.7", "gpt-5.4"]) {
    assert.ok(!ids.has(id), id)
  }
})

test("pair-with-tiebreak judge defaults use GPT, Haiku, and Gemini Flash", () => {
  assert.equal(DEFAULT_JUDGE_MODEL, "gpt-5.4-mini")
  assert.equal(PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL, "claude-haiku-4.5")
  assert.equal(PAIR_WITH_TIEBREAK_ARBITER_MODEL, "gemini-3.5-flash")
})
