import type { ModelConfig } from "./types"

export const PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL = "kimi-k2.5"
export const PAIR_WITH_TIEBREAK_ARBITER_MODEL = "openai/gpt-5.4-mini"

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.3-codex",
    label: "GPT 5.3 Codex",
    provider: "OpenAI",
    modelString: "openai/gpt-5.3-codex",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.50, output: 10.00 },
  },
  {
    id: "claude-opus-4.6",
    label: "Opus 4.6",
    provider: "Anthropic",
    modelString: "anthropic/claude-opus-4.6",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 5.00, output: 25.00 },
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    provider: "Google",
    modelString: "google/gemini-3.1-pro-preview",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.00, output: 12.00 },
  },
  {
    id: "grok-4",
    label: "Grok 4",
    provider: "xAI",
    modelString: "x-ai/grok-4",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 3.00, output: 15.00 },
  },
  {
    id: "mistral-large-3",
    label: "Mistral Large 3",
    provider: "Mistral",
    modelString: "mistralai/mistral-large-2512",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.50, output: 1.50 },
  },
  {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    provider: "Moonshot",
    modelString: "moonshotai/kimi-k2.5",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.60, output: 3.00 },
  },
  {
    id: "glm-5",
    label: "GLM 5",
    provider: "Z.ai",
    modelString: "z-ai/glm-5",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 1.00, output: 3.20 },
  },
  {
    id: "minimax-m2.5",
    label: "MiniMax M2.5",
    provider: "MiniMax",
    modelString: "minimax/minimax-m2.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.30, output: 1.10 },
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v3.2",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.27, output: 0.41 },
  },
  {
    id: "qwen3.5",
    label: "Qwen 3.5",
    provider: "Alibaba",
    modelString: "qwen/qwen3.5-397b-a17b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.40, output: 2.40 },
  },
]

const EXTRA_CURATED_MODELS: ModelConfig[] = [
  {
    id: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
    label: "GPT 5.4 Mini",
    provider: "OpenAI",
    modelString: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.75, output: 4.50 },
  },
]

export const MODELS_BY_ID: Record<string, ModelConfig> = Object.fromEntries(
  [...AVAILABLE_MODELS, ...EXTRA_CURATED_MODELS].map((model) => [model.id, model])
)
export const MODELS_BY_MODEL_STRING: Record<string, ModelConfig> = Object.fromEntries(
  [...AVAILABLE_MODELS, ...EXTRA_CURATED_MODELS].map((model) => [model.modelString, model])
)

export const DEFAULT_JUDGE_MODEL = "google/gemini-3-flash-preview"

const ESTIMATED_PRICING_BY_MODEL_KEY: Record<string, { input: number; output: number }> = {
  [DEFAULT_JUDGE_MODEL]: { input: 0.3, output: 1.2 },
  ...Object.fromEntries(
    [...AVAILABLE_MODELS, ...EXTRA_CURATED_MODELS].map((model) => [
      model.id,
      model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
    ])
  ),
  ...Object.fromEntries(
    [...AVAILABLE_MODELS, ...EXTRA_CURATED_MODELS].map((model) => [
      model.modelString,
      model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
    ])
  ),
}

export const JUDGE_MODEL_OPTIONS = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview (default)",
  },
  {
    id: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
    label: "GPT 5.4 Mini (OpenAI)",
  },
  ...AVAILABLE_MODELS.map((model) => ({
    id: model.id,
    label: `${model.label} (${model.provider})`,
  })),
]

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS_BY_ID[id]
}

export function getModelByModelString(modelString: string): ModelConfig | undefined {
  return MODELS_BY_MODEL_STRING[modelString]
}

export function getEstimatedPricingByModelKey(modelKey: string): { input: number; output: number } {
  return ESTIMATED_PRICING_BY_MODEL_KEY[modelKey] ?? { input: 2, output: 8 }
}
