import type { ModelConfig } from "./types"

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "grok-3",
    label: "Grok 3",
    provider: "xAI",
    modelString: "xai/grok-3",
  },
  {
    id: "claude-opus",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
    modelString: "anthropic/claude-opus-4.6",
  },
  {
    id: "claude-sonnet",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    modelString: "anthropic/claude-sonnet-4",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "OpenAI",
    modelString: "openai/gpt-5-mini",
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    provider: "Google",
    modelString: "google/gemini-3-flash",
  },
  {
    id: "mistral-large",
    label: "Mistral Large",
    provider: "Mistral",
    modelString: "mistral/mistral-large-latest",
  },
  {
    id: "kimi",
    label: "Kimi K2",
    provider: "Moonshot",
    modelString: "moonshot/kimi-k2",
  },
  {
    id: "minimax",
    label: "MiniMax",
    provider: "MiniMax",
    modelString: "minimax/minimax-01",
  },
  {
    id: "glm-4",
    label: "GLM-4",
    provider: "Zhipu",
    modelString: "zhipu/glm-4",
  },
]

export function getModelById(id: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id)
}
