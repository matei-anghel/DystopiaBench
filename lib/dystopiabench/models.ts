import type { ModelConfig } from "./types"

export const DEFAULT_JUDGE_MODEL = "gpt-5.4-mini"
export const PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL = "deepseek-v4-pro"
export const PAIR_WITH_TIEBREAK_ARBITER_MODEL = "kimi-k2.6"
export const ESTIMATED_PRICING_SOURCE_LABEL = "OpenRouter Models API"
export const ESTIMATED_PRICING_LAST_SYNC_DATE = "2026-04-26"

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    provider: "OpenAI",
    modelString: "openai/gpt-5.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 5.0, output: 30.0 },
  },
  {
    id: "gpt-5.4",
    label: "GPT 5.4",
    provider: "OpenAI",
    modelString: "openai/gpt-5.4",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.5, output: 15.0 },
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT 5.4 Mini",
    provider: "OpenAI",
    modelString: "openai/gpt-5.4-mini",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.75, output: 4.50 },
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT 5.3 Codex",
    provider: "OpenAI",
    modelString: "openai/gpt-5.3-codex",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 1.75, output: 14.0 },
  },
  {
    id: "gpt-oss-safeguard-20b",
    label: "GPT-OSS Safeguard 20B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-safeguard-20b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.075, output: 0.3 },
  },
  {
    id: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-120b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.039, output: 0.19 },
  },
  {
    id: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-20b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.03, output: 0.14 },
  },
  {
    id: "claude-opus-4.7",
    label: "Opus 4.7",
    provider: "Anthropic",
    modelString: "anthropic/claude-opus-4.7",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 5.0, output: 25.0 },
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
    id: "claude-sonnet-4.6",
    label: "Sonnet 4.6",
    provider: "Anthropic",
    modelString: "anthropic/claude-sonnet-4.6",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 3.0, output: 15.0 },
  },
  {
    id: "claude-haiku-4.5",
    label: "Haiku 4.5",
    provider: "Anthropic",
    modelString: "anthropic/claude-haiku-4.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 1.0, output: 5.0 },
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
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite Preview",
    provider: "Google",
    modelString: "google/gemini-3.1-flash-lite-preview",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.25, output: 1.5 },
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    provider: "Google",
    modelString: "google/gemini-3-flash-preview",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.5, output: 3.0 },
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v4-pro",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.435, output: 0.87 },
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v4-flash",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.14, output: 0.28 },
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v3.2",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.252, output: 0.378 },
  },
  {
    id: "grok-4.20-multi-agent",
    label: "Grok 4.20 Multi-Agent",
    provider: "xAI",
    modelString: "x-ai/grok-4.20-multi-agent",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.0, output: 6.0 },
  },
  {
    id: "grok-4.20",
    label: "Grok 4.20",
    provider: "xAI",
    modelString: "x-ai/grok-4.20",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.0, output: 6.0 },
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
    id: "llama-4-maverick",
    label: "Llama 4 Maverick",
    provider: "Meta",
    modelString: "meta-llama/llama-4-maverick",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.15, output: 0.6 },
  },
  {
    id: "llama-4-scout",
    label: "Llama 4 Scout",
    provider: "Meta",
    modelString: "meta-llama/llama-4-scout",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.08, output: 0.3 },
  },
  {
    id: "nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super 120B A12B",
    provider: "NVIDIA",
    modelString: "nvidia/nemotron-3-super-120b-a12b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.09, output: 0.45 },
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
    id: "mistral-small-2603",
    label: "Mistral Small 2603",
    provider: "Mistral",
    modelString: "mistralai/mistral-small-2603",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.15, output: 0.6 },
  },
  {
    id: "kimi-k2.6",
    label: "Kimi K2.6",
    provider: "Moonshot",
    modelString: "moonshotai/kimi-k2.6",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.7448, output: 4.655 },
  },
  {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    provider: "Moonshot",
    modelString: "moonshotai/kimi-k2.5",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.44, output: 2.0 },
  },
  {
    id: "glm-5.1",
    label: "GLM 5.1",
    provider: "Z.ai",
    modelString: "z-ai/glm-5.1",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 1.05, output: 3.5 },
  },
  {
    id: "glm-5",
    label: "GLM 5",
    provider: "Z.ai",
    modelString: "z-ai/glm-5",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.6, output: 2.08 },
  },
  {
    id: "minimax-m2.7",
    label: "MiniMax M2.7",
    provider: "MiniMax",
    modelString: "minimax/minimax-m2.7",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.3, output: 1.2 },
  },
  {
    id: "minimax-m2.5",
    label: "MiniMax M2.5",
    provider: "MiniMax",
    modelString: "minimax/minimax-m2.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.15, output: 1.15 },
  },
  {
    id: "qwen3.6-plus",
    label: "Qwen 3.6 Plus",
    provider: "Alibaba",
    modelString: "qwen/qwen3.6-plus",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.325, output: 1.95 },
  },
  {
    id: "qwen3.5",
    label: "Qwen 3.5",
    provider: "Alibaba",
    modelString: "qwen/qwen3.5-397b-a17b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.39, output: 2.34 },
  },
  {
    id: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    provider: "Xiaomi",
    modelString: "xiaomi/mimo-v2.5-pro",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 1.0, output: 3.0 },
  },
  {
    id: "mimo-v2.5",
    label: "MiMo V2.5",
    provider: "Xiaomi",
    modelString: "xiaomi/mimo-v2.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.4, output: 2.0 },
  },
  {
    id: "seed-2.0-lite",
    label: "Seed 2.0 Lite",
    provider: "ByteDance",
    modelString: "bytedance-seed/seed-2.0-lite",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.25, output: 2.0 },
  },
  {
    id: "seed-2.0-mini",
    label: "Seed 2.0 Mini",
    provider: "ByteDance",
    modelString: "bytedance-seed/seed-2.0-mini",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.1, output: 0.4 },
  },
  {
    id: "trinity-large-thinking",
    label: "Trinity Large Thinking",
    provider: "Arcee",
    modelString: "arcee-ai/trinity-large-thinking",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.22, output: 0.85 },
  },
  {
    id: "tencent-hy3-preview-free",
    label: "HY3 Preview (free)",
    provider: "Tencent",
    modelString: "tencent/hy3-preview:free",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0, output: 0 },
  },
]

const ALL_CURATED_MODELS = [...AVAILABLE_MODELS]
const MODELS_BY_ID = new Map(ALL_CURATED_MODELS.map((model) => [model.id, model]))
const MODELS_BY_MODEL_STRING = new Map(ALL_CURATED_MODELS.map((model) => [model.modelString, model]))

const ESTIMATED_PRICING_BY_MODEL_KEY = new Map<string, { input: number; output: number }>([
  ...ALL_CURATED_MODELS.map((model) => [
    model.id,
    model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
  ] as const),
  ...ALL_CURATED_MODELS.map((model) => [
    model.modelString,
    model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
  ] as const),
])

const CURATED_JUDGE_MODEL_IDS = [
  "gpt-5.5",
  "gpt-5.4",
  DEFAULT_JUDGE_MODEL,
  "claude-opus-4.7",
  "claude-sonnet-4.6",
  "gemini-3.1-pro",
  "gemini-3-flash-preview",
  "glm-5.1",
  PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
] as const

export const JUDGE_MODEL_OPTIONS = CURATED_JUDGE_MODEL_IDS.map((id) => {
  const model = getModelById(id)
  if (!model) {
    throw new Error(`Missing curated judge model '${id}' in AVAILABLE_MODELS.`)
  }

  return {
    id: model.id,
    label: model.label.replace(/\s*\([^)]*\)\s*$/i, ""),
    provider: model.provider,
  }
})

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS_BY_ID.get(id)
}

export function getModelByModelString(modelString: string): ModelConfig | undefined {
  return MODELS_BY_MODEL_STRING.get(modelString)
}

export function getEstimatedPricingByModelKey(modelKey: string): { input: number; output: number } {
  return ESTIMATED_PRICING_BY_MODEL_KEY.get(modelKey) ?? { input: 2, output: 8 }
}
