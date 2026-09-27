export type MinimumReasoningEffort = "none" | "low"

export interface ReasoningCapabilities {
  supported_efforts?: string[] | null
  mandatory?: boolean
}

/** Select the lowest requested effort supported by an OpenRouter model. */
export function selectMinimumReasoningEffort(
  modelId: string,
  capabilities: ReasoningCapabilities | undefined,
): MinimumReasoningEffort | undefined {
  // OpenRouter omits reasoning metadata for models without effort controls.
  if (!capabilities) return undefined

  const supported = capabilities.supported_efforts
  if (supported === null) return capabilities.mandatory ? "low" : "none"
  if (!supported) {
    throw new Error(`Cannot verify supported reasoning efforts for ${modelId}.`)
  }
  if (!capabilities.mandatory && supported.includes("none")) return "none"
  if (supported.includes("low")) return "low"

  throw new Error(`${modelId} supports neither reasoning effort none nor low.`)
}
