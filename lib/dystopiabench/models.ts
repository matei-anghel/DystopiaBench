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
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    provider: "OpenAI",
    modelString: "openai/gpt-5.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.5, output: 10.0 },
  },
  {
    id: "gpt-5.4",
    label: "GPT 5.4",
    provider: "OpenAI",
    modelString: "openai/gpt-5.4",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 2.0, output: 8.0 },
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
    id: "gpt-oss-safeguard-20b",
    label: "GPT-OSS Safeguard 20B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-safeguard-20b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.1, output: 0.4 },
  },
  {
    id: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-120b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.6 },
  },
  {
    id: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    provider: "OpenAI",
    modelString: "openai/gpt-oss-20b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.1, output: 0.4 },
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    provider: "Google",
    modelString: "google/gemini-3-flash-preview",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.3, output: 1.2 },
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite Preview",
    provider: "Google",
    modelString: "google/gemini-3.1-flash-lite-preview",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.8 },
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v4-pro",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.4, output: 0.6 },
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    modelString: "deepseek/deepseek-v4-flash",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.4 },
  },
  {
    id: "kimi-k2.6",
    label: "Kimi K2.6",
    provider: "Moonshot",
    modelString: "moonshotai/kimi-k2.6",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.6, output: 3.0 },
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
    id: "claude-sonnet-4.6",
    label: "Sonnet 4.6",
    provider: "Anthropic",
    modelString: "anthropic/claude-sonnet-4.6",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 1.0, output: 5.0 },
  },
  {
    id: "claude-haiku-4.5",
    label: "Haiku 4.5",
    provider: "Anthropic",
    modelString: "anthropic/claude-haiku-4.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.3, output: 1.5 },
  },
  {
    id: "qwen3.6-plus",
    label: "Qwen 3.6 Plus",
    provider: "Alibaba",
    modelString: "qwen/qwen3.6-plus",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.4, output: 2.4 },
  },
  {
    id: "grok-4.20-multi-agent",
    label: "Grok 4.20 Multi-Agent",
    provider: "xAI",
    modelString: "x-ai/grok-4.20-multi-agent",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 3.0, output: 15.0 },
  },
  {
    id: "grok-4.20",
    label: "Grok 4.20",
    provider: "xAI",
    modelString: "x-ai/grok-4.20",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 3.0, output: 15.0 },
  },
  {
    id: "minimax-m2.7",
    label: "MiniMax M2.7",
    provider: "MiniMax",
    modelString: "minimax/minimax-m2.7",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.3, output: 1.1 },
  },
  {
    id: "seed-2.0-lite",
    label: "Seed 2.0 Lite",
    provider: "ByteDance",
    modelString: "bytedance-seed/seed-2.0-lite",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.8 },
  },
  {
    id: "seed-2.0-mini",
    label: "Seed 2.0 Mini",
    provider: "ByteDance",
    modelString: "bytedance-seed/seed-2.0-mini",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.15, output: 0.6 },
  },
  {
    id: "mistral-small-2603",
    label: "Mistral Small 2603",
    provider: "Mistral",
    modelString: "mistralai/mistral-small-2603",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.1, output: 0.3 },
  },
  {
    id: "trinity-large-thinking",
    label: "Trinity Large Thinking",
    provider: "Arcee",
    modelString: "arcee-ai/trinity-large-thinking",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.8 },
  },
  {
    id: "nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super 120B A12B",
    provider: "NVIDIA",
    modelString: "nvidia/nemotron-3-super-120b-a12b",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.6 },
  },
  {
    id: "tencent-hy3-preview-free",
    label: "HY3 Preview (free)",
    provider: "Tencent",
    modelString: "tencent/hy3-preview:free",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0, output: 0 },
  },
  {
    id: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    provider: "Xiaomi",
    modelString: "xiaomi/mimo-v2.5-pro",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.5, output: 2.0 },
  },
  {
    id: "mimo-v2.5",
    label: "MiMo V2.5",
    provider: "Xiaomi",
    modelString: "xiaomi/mimo-v2.5",
    weightClass: "closed",
    estimatedPricingUsdPer1M: { input: 0.3, output: 1.2 },
  },
  {
    id: "glm-5.1",
    label: "GLM 5.1",
    provider: "Z.ai",
    modelString: "z-ai/glm-5.1",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 1.0, output: 3.2 },
  },
  {
    id: "llama-4-maverick",
    label: "Llama 4 Maverick",
    provider: "Meta",
    modelString: "meta-llama/llama-4-maverick",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.2, output: 0.6 },
  },
  {
    id: "llama-4-scout",
    label: "Llama 4 Scout",
    provider: "Meta",
    modelString: "meta-llama/llama-4-scout",
    weightClass: "open_weight",
    estimatedPricingUsdPer1M: { input: 0.1, output: 0.3 },
  },
]

const ALL_CURATED_MODELS = [...AVAILABLE_MODELS]
const MODELS_BY_ID = new Map(ALL_CURATED_MODELS.map((model) => [model.id, model]))
const MODELS_BY_MODEL_STRING = new Map(ALL_CURATED_MODELS.map((model) => [model.modelString, model]))

export const DEFAULT_JUDGE_MODEL = "google/gemini-3-flash-preview"

const JUDGE_QUICK_PICK_MODEL_STRINGS = new Set<string>([
  DEFAULT_JUDGE_MODEL,
  "openai/gpt-5.4",
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
])

const ESTIMATED_PRICING_BY_MODEL_KEY = new Map<string, { input: number; output: number }>([
  [DEFAULT_JUDGE_MODEL, { input: 0.3, output: 1.2 }],
  ...ALL_CURATED_MODELS.map((model) => [
    model.id,
    model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
  ] as const),
  ...ALL_CURATED_MODELS.map((model) => [
    model.modelString,
    model.estimatedPricingUsdPer1M ?? { input: 2, output: 8 },
  ] as const),
])

export const JUDGE_MODEL_OPTIONS = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview (default)",
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT 5.4 (OpenAI)",
  },
  {
    id: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
    label: "GPT 5.4 Mini (OpenAI)",
  },
  ...AVAILABLE_MODELS.filter((model) => !JUDGE_QUICK_PICK_MODEL_STRINGS.has(model.modelString)).map((model) => ({
    id: model.id,
    label: `${model.label} (${model.provider})`,
  })),
]

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS_BY_ID.get(id)
}

export function getModelByModelString(modelString: string): ModelConfig | undefined {
  return MODELS_BY_MODEL_STRING.get(modelString)
}

export function getEstimatedPricingByModelKey(modelKey: string): { input: number; output: number } {
  return ESTIMATED_PRICING_BY_MODEL_KEY.get(modelKey) ?? { input: 2, output: 8 }
}
