import { DEFAULT_JUDGE_MODEL, getModelById, getModelByModelString } from "./models"
import type { WeightClass } from "./types"

type ModelBackend = "openrouter" | "local"

export interface ResolvedModelSpec {
  id: string
  label: string
  provider: string
  modelString: string
  backend: ModelBackend
  weightClass: WeightClass | "unknown"
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
      weightClass: known.weightClass,
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
        weightClass: "unknown",
      }
    }

    if (provider === "openrouter") {
      const knownOpenRouterModel = getModelByModelString(model)
      return {
        id: trimmed,
        label: knownOpenRouterModel?.label ?? `OpenRouter ${model}`,
        provider: knownOpenRouterModel?.provider ?? "OpenRouter",
        modelString: model,
        backend: "openrouter",
        weightClass: knownOpenRouterModel?.weightClass ?? "unknown",
      }
    }

    throw new Error(
      `Unknown model identifier '${trimmed}'. Use a model ID from AVAILABLE_MODELS, ` +
      "or a prefix like openrouter:<model-string> or local:<model-string>."
    )
  }

  if (trimmed.includes("/")) {
    const knownOpenRouterModel = getModelByModelString(trimmed)
    return {
      id: trimmed,
      label: knownOpenRouterModel?.label ?? trimmed,
      provider: knownOpenRouterModel?.provider ?? "OpenRouter",
      modelString: trimmed,
      backend: "openrouter",
      weightClass: knownOpenRouterModel?.weightClass ?? "unknown",
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
