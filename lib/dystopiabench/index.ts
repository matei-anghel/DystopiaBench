import { ALL_MODULES, ALL_SCENARIOS } from "./scenarios"
import {
  createBenchmarkBundle,
  createBenchmarkBundleFromSources,
  filterBundleModulesByReleaseTier,
  validateBenchmarkBundle,
} from "./bundles"
import {
  validateGateConfig,
  validateJudgeCalibrationSet,
  validateRunRequest,
  type RunRequestV1,
  type ScenarioCatalogV1,
} from "./contracts"
import { buildScenarioSummaries } from "./exports"
import { validateScenarioLocalePack } from "./locale-packs"
import { runBenchmark } from "./runner"
import { runManifestV2Schema } from "./schemas"
import { makeRunId } from "./storage"
import { loadScenarioModulesFromSources } from "./scenario-loader"
import { toModuleId } from "./types"

export * from "./bundles"
export * from "./calibration"
export * from "./eval-card"
export * from "./governance"
export {
  benchmarkPolicyConfigV1Schema,
  gateConfigSchema,
  judgeCalibrationSetSchema,
  runExportManifestSchema,
  runRequestV1Schema,
  scenarioCatalogV1Schema,
  scenarioResultSummaryV1Schema,
  validateGateConfig,
  validateJudgeCalibrationSet,
  validateRunRequest,
  type BenchmarkPolicyConfigV1,
  type GateConfig,
  type JudgeCalibrationSet,
  type RunExportManifest,
  type RunRequestV1,
  type ScenarioCatalogV1,
  type ScenarioResultSummaryV1,
} from "./contracts"
export * from "./exports"
export * from "./gates"
export * from "./locale-packs"
export * from "./locales"
export * from "./quality"
export * from "./repeat-aggregation"
export * from "./review-import"
export {
  AWARENESS_PROMPT_VERSION,
  BENCHMARK_PROMPT_VERSION,
  JUDGE_PROMPT_VERSION,
  SYSTEM_PROMPT_VERSION,
  aggregateJudgeVotes,
  analyzeRunEvaluationAwareness,
  buildProviderOverride,
  createOpenRouterFetchWithProviderOverrides,
  evaluateResponseWithJudges,
  extractTextFromModelResult,
  normalizeQuantization,
  parseArbiterOutput,
  runBenchmark,
  summarizeResults,
  type EvalAwarenessMode,
  type RunBenchmarkOptions,
} from "./runner"
export * from "./scenarios"
export * from "./storage"
export {
  loadScenarioModulesFromSources,
  type ScenarioSourceConfig,
} from "./scenario-loader"
export {
  COMPLIANCE_LABELS,
  COMPLIANCE_SCORES,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  isCoreModule,
  toModuleId,
  type BenchmarkModuleSelector,
  type BenchmarkResult,
  type CoreModule,
  type EscalationLevel,
  type ModelConfig,
  type Module,
  type Scenario,
  type ScenarioModule,
  type ScenarioProvenance,
} from "./types"
export {
  benchmarkStatusSchema,
  complianceRatingSchema,
  runManifestV2Schema,
  runSummaryV2Schema,
  type AuxiliaryOutcomeLabels,
  type BenchmarkResultV2,
  type ComplianceRating,
  type EvaluationAwarenessAnalysis,
  type RunManifestV2,
  type RunSummaryV2,
} from "./schemas"

export async function runBenchmarkRequest(input: RunRequestV1 | unknown) {
  const request = validateRunRequest(input)
  const scenarioModules = request.scenarioSources
    ? await loadScenarioModulesFromSources(request.scenarioSources)
    : undefined
  const benchmarkBundle =
    request.benchmarkBundle ??
    createBenchmarkBundle({
      datasetBundleVersion: request.datasetBundleVersion,
      modules: scenarioModules,
    })

  return runBenchmark({
    runId: request.runId ?? makeRunId(),
    module: request.module === "both" ? "both" : toModuleId(request.module),
    modelIds: request.modelIds,
    levels: request.levels as Array<1 | 2 | 3 | 4 | 5>,
    scenarioIds: request.scenarioIds,
    judgeModel: request.judgeModel,
    judgeModels: request.judgeModels,
    awarenessJudgeModel: request.awarenessJudgeModel,
    judgeStrategy: request.policyConfig?.judgeStrategy,
    evalAwarenessMode: request.policyConfig?.evalAwarenessMode,
    awarenessThreshold: request.policyConfig?.awarenessThreshold,
    transportPolicy: request.policyConfig?.transportPolicy,
    conversationMode: request.policyConfig?.conversationMode,
    providerPrecisionPolicy: request.policyConfig?.providerPrecisionPolicy,
    timeoutMs: request.timeoutMs,
    concurrency: request.concurrency,
    perModelConcurrency: request.perModelConcurrency,
    maxRetries: request.maxRetries,
    retryBackoffBaseMs: request.retryBackoffBaseMs,
    retryBackoffJitterMs: request.retryBackoffJitterMs,
    replicates: request.replicates,
    experimentId: request.experimentId,
    project: request.project,
    owner: request.owner,
    purpose: request.purpose,
    modelSnapshot: request.modelSnapshot,
    providerRegion: request.providerRegion,
    policyVersion: request.policyVersion,
    systemPromptOverrideUsed: request.systemPromptOverrideUsed,
    customPrepromptUsed: request.customPrepromptUsed,
    gitCommit: request.gitCommit,
    datasetBundleVersion: request.datasetBundleVersion,
    promptLocale: request.promptLocale,
    sourceLocale: request.sourceLocale,
    localePack: request.localePack ? validateScenarioLocalePack(request.localePack) : undefined,
    localePackId: request.localePackId,
    localePreset: request.localePreset,
    scenarioModules,
    benchmarkBundle,
  })
}

export function loadScenarioCatalog(options?: {
  allowedReleaseTiers?: Array<"core-public" | "holdout" | "partner-only" | "organization-local">
}): ScenarioCatalogV1 {
  const modules = options?.allowedReleaseTiers
    ? filterBundleModulesByReleaseTier(ALL_MODULES, new Set(options.allowedReleaseTiers))
    : ALL_MODULES
  const scenarios = modules.flatMap((module) => module.scenarios)
  const promptCount = ALL_SCENARIOS.reduce(
    (sum, scenario) => sum + scenario.escalationPrompts.length,
    0,
  )
  const bundle = createBenchmarkBundle()

  return {
    benchmarkBundleId: bundle.benchmarkBundleId,
    datasetBundleVersion: bundle.datasetBundleVersion,
    scenarioCatalogVersion: bundle.scenarioCatalogVersion,
    moduleCount: modules.length,
    scenarioCount: scenarios.length,
    promptCount: options?.allowedReleaseTiers
      ? scenarios.reduce((sum, scenario) => sum + scenario.escalationPrompts.length, 0)
      : promptCount,
    modules,
  }
}

export function validateRun(manifest: unknown) {
  return runManifestV2Schema.parse(manifest)
}

export async function createScenarioBundleFromSources(
  sources: Parameters<typeof createBenchmarkBundleFromSources>[0],
) {
  return createBenchmarkBundleFromSources(sources)
}

export function exportScenarioSummaries(manifestResults: Parameters<typeof buildScenarioSummaries>[0]) {
  return buildScenarioSummaries(manifestResults)
}

export const validators = {
  validateBenchmarkBundle,
  validateGateConfig,
  validateJudgeCalibrationSet,
  validateRunRequest,
}
