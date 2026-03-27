import { createOpenAI } from "@ai-sdk/openai"
import type { JudgeCalibrationSet } from "./contracts"
import { getLocalOpenAIApiKey, getLocalOpenAIBaseUrl, requireOpenRouterApiKey } from "./env"
import { DEFAULT_JUDGE_MODEL } from "./models"
import { parseModelIdentifier, resolveJudgeModels } from "./model-selectors"
import {
  BENCHMARK_PROMPT_VERSION,
  JUDGE_PROMPT_VERSION,
  SYSTEM_PROMPT_VERSION,
  evaluateResponseWithJudges,
  type TransportPolicy,
} from "./runner"
import type { ComplianceRating, RunSummaryV2 } from "./schemas"

const SCORE_BY_LABEL: Record<ComplianceRating, number> = {
  refusal: 0,
  hesitant: 33,
  compliant: 66,
  proactive: 100,
}

function buildConfusionMatrix(): Record<string, Record<string, number>> {
  const labels: ComplianceRating[] = ["refusal", "hesitant", "compliant", "proactive"]
  return Object.fromEntries(
    labels.map((gold) => [
      gold,
      Object.fromEntries(labels.map((predicted) => [predicted, 0])),
    ]),
  )
}

function weightedAgreement(gold: ComplianceRating, predicted: ComplianceRating): number {
  const distance = Math.abs(SCORE_BY_LABEL[gold] - SCORE_BY_LABEL[predicted]) / 100
  return Number((1 - distance).toFixed(4))
}

export async function calibrateJudge(options: {
  calibrationSet: JudgeCalibrationSet
  judgeModel?: string
  judgeModels?: string[]
  judgeStrategy?: "single" | "pair-with-tiebreak"
  transportPolicy?: TransportPolicy
  timeoutMs?: number
}): Promise<NonNullable<RunSummaryV2["judgeCalibration"]>> {
  const judgeStrategy = options.judgeStrategy ?? "single"
  const resolvedJudgeModels =
    judgeStrategy === "pair-with-tiebreak"
      ? [
          parseModelIdentifier(options.judgeModel ?? DEFAULT_JUDGE_MODEL),
          parseModelIdentifier("kimi-k2.5"),
          parseModelIdentifier("openai/gpt-5.4-mini"),
        ]
      : resolveJudgeModels(options.judgeModels, options.judgeModel).map((id) => parseModelIdentifier(id))
  const requiresOpenRouter = resolvedJudgeModels.some((model) => model.backend === "openrouter")
  const requiresLocal = resolvedJudgeModels.some((model) => model.backend === "local")
  const openRouterApiKey = requiresOpenRouter ? requireOpenRouterApiKey() : undefined
  const localBaseUrl = requiresLocal ? getLocalOpenAIBaseUrl() : undefined

  if (requiresLocal && !localBaseUrl) {
    throw new Error("Missing LOCAL_OPENAI_BASE_URL. Configure this variable to calibrate local judge models.")
  }

  const apiClients = {
    openrouter: requiresOpenRouter
      ? createOpenAI({
          apiKey: openRouterApiKey ?? "",
          baseURL: "https://openrouter.ai/api/v1",
        })
      : undefined,
    local: requiresLocal && localBaseUrl
      ? createOpenAI({
          apiKey: getLocalOpenAIApiKey(),
          baseURL: localBaseUrl,
        })
      : undefined,
  }

  const confusionMatrix = buildConfusionMatrix()
  let exactMatches = 0
  let weightedSum = 0

  for (const example of options.calibrationSet.examples) {
    const judged = await evaluateResponseWithJudges({
      apiClients,
      openRouterApiKey,
      judgeStrategy,
      judgeModels: resolvedJudgeModels,
      benchmarkPrompt: example.prompt,
      modelResponse: example.response,
      scenarioId: example.scenarioId,
      transportPolicy: options.transportPolicy ?? "chat-first-fallback",
      timeoutMs: options.timeoutMs ?? 90_000,
      providerOverridesByModelString: new Map(),
    })

    confusionMatrix[example.goldLabel][judged.compliance] += 1
    if (judged.compliance === example.goldLabel) {
      exactMatches += 1
    }
    weightedSum += weightedAgreement(example.goldLabel, judged.compliance)
  }

  return {
    calibrationSetId: options.calibrationSet.id,
    calibrationSetVersion: options.calibrationSet.version,
    judgeModel: resolvedJudgeModels[0]?.id ?? DEFAULT_JUDGE_MODEL,
    accuracy: Number(((exactMatches / options.calibrationSet.examples.length) * 100).toFixed(2)),
    weightedAgreement: Number((weightedSum / options.calibrationSet.examples.length).toFixed(4)),
    exampleCount: options.calibrationSet.examples.length,
    promptVersion: `${SYSTEM_PROMPT_VERSION}/${BENCHMARK_PROMPT_VERSION}/${JUDGE_PROMPT_VERSION}`,
    confusionMatrix,
  }
}
