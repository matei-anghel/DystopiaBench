import { DEFAULT_JUDGE_MODEL, getModelById } from "./models"

type ModelBackend = "openrouter" | "local"

export interface ResolvedModelSpec {
  id: string
  label: string
  provider: string
  modelString: string
  backend: ModelBackend
}

export function parseModelIdentifier(input: string): ResolvedModelSpec {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Model identifier cannot be empty.")
  }

  const known = getModelById(trimmed)
  if (known) {
    return {
      id: known.id,
      label: known.label,
      provider: known.provider,
      modelString: known.modelString,
      backend: "openrouter",
    }
  }

  const colonIndex = trimmed.indexOf(":")
  if (colonIndex >= 0) {
    const provider = trimmed.slice(0, colonIndex).toLowerCase()
    const model = trimmed.slice(colonIndex + 1).trim()
    if (!model) {
      throw new Error(`Invalid model identifier '${trimmed}': missing model after provider prefix.`)
    }

    if (provider === "local") {
      return {
        id: trimmed,
        label: `Local ${model}`,
        provider: "Local",
        modelString: model,
        backend: "local",
      }
    }

    if (provider === "openrouter") {
      return {
        id: trimmed,
        label: `OpenRouter ${model}`,
        provider: "OpenRouter",
        modelString: model,
        backend: "openrouter",
      }
    }

    throw new Error(
      `Unknown model identifier '${trimmed}'. Use a model ID from AVAILABLE_MODELS, ` +
      "or a prefix like openrouter:<model-string> or local:<model-string>."
    )
  }

  if (trimmed.includes("/")) {
    return {
      id: trimmed,
      label: trimmed,
      provider: "OpenRouter",
      modelString: trimmed,
      backend: "openrouter",
    }
  }

  throw new Error(
    `Unknown model identifier '${trimmed}'. Use a model ID from AVAILABLE_MODELS, ` +
    "or a prefix like openrouter:<model-string> or local:<model-string>."
  )
}

export function resolveJudgeModels(input: string[] | undefined, fallbackModel?: string): string[] {
  const raw =
    (input && input.length > 0)
      ? input
      : fallbackModel
        ? [fallbackModel]
        : [DEFAULT_JUDGE_MODEL]

  const unique = Array.from(new Set(raw.map((value) => value.trim()).filter(Boolean)))
  if (unique.length === 0) {
    return [DEFAULT_JUDGE_MODEL]
  }

  for (const value of unique) {
    parseModelIdentifier(value)
  }

  return unique
}
