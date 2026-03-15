import type { ModelConfig } from "./types"

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.3-codex",
    label: "GPT 5.3 Codex",
    provider: "OpenAI",
    modelString: "openai/gpt-5.3-codex",
    estimatedPricingUsdPer1M: { input: 2.50, output: 10.00 },
  },
  {
    id: "claude-opus-4.6",
    label: "Opus 4.6",
    provider: "Anthropic",
    modelString: "anthropic/claude-opus-4.6",
    estimatedPricingUsdPer1M: { input: 5.00, output: 25.00 },
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    provider: "Google",
    modelString: "google/gemini-3.1-pro-preview",
    estimatedPricingUsdPer1M: { input: 2.00, output: 12.00 },
  },
  {
    id: "grok-4",
    label: "Grok 4",
    provider: "xAI",
    modelString: "x-ai/grok-4",
    estimatedPricingUsdPer1M: { input: 3.00, output: 15.00 },
  },
  {
    id: "mistral-large-3",
    label: "Mistral Large 3",
    provider: "Mistral",
    modelString: "mistralai/mistral-large-2512",
    estimatedPricingUsdPer1M: { input: 0.50, output: 1.50 },
  },
  {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    provider: "Moonshot",
    modelString: "moonshotai/kimi-k2.5",
    estimatedPricingUsdPer1M: { input: 0.60, output: 3.00 },
  },
  {
    id: "glm-5",
    label: "GLM 5",
    provider: "Z.ai",
    modelString: "z-ai/glm-5",
    estimatedPricingUsdPer1M: { input: 1.00, output: 3.20 },
  },
  {
    id: "minimax-m2.5",
    label: "MiniMax M2.5",
    provider: "MiniMax",
    modelString: "minimax/minimax-m2.5",
    estimatedPricingUsdPer1M: { input: 0.30, output: 1.10 },
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v3.2",
    estimatedPricingUsdPer1M: { input: 0.27, output: 0.41 },
  },
  {
    id: "qwen3.5",
    label: "Qwen 3.5",
    provider: "Alibaba",
    modelString: "qwen/qwen3.5-397b-a17b",
    estimatedPricingUsdPer1M: { input: 0.40, output: 2.40 },
  },
]

export const DEFAULT_JUDGE_MODEL = "google/gemini-3-flash-preview"

const ESTIMATED_PRICING_BY_MODEL_KEY: Record<string, { input: number; output: number }> = {
  [DEFAULT_JUDGE_MODEL]: { input: 0.3, output: 1.2 },
  ...Object.fromEntries(
    AVAILABLE_MODELS.map((model) => [
      model.id,
      model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
    ])
  ),
  ...Object.fromEntries(
    AVAILABLE_MODELS.map((model) => [
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
  ...AVAILABLE_MODELS.map((model) => ({
    id: model.id,
    label: `${model.label} (${model.provider})`,
  })),
]

export const MODELS_BY_ID: Record<string, ModelConfig> = Object.fromEntries(
  AVAILABLE_MODELS.map((model) => [model.id, model])
)

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS_BY_ID[id]
}

export function getEstimatedPricingByModelKey(modelKey: string): { input: number; output: number } {
  return ESTIMATED_PRICING_BY_MODEL_KEY[modelKey] ?? { input: 2, output: 8 }
}
