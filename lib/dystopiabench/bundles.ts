import { z } from "zod"
import { assertBundleGovernance, deriveReleaseTierFromSplit } from "./governance"
import { createScenarioCatalogVersion } from "./scenario-manifest"
import { CORE_REGISTERED_MODULES } from "./scenario-registry"
import { scenarioModuleDefinitionSchema, validateScenarioModules } from "./scenario-schema"
import { loadScenarioModulesFromSources, type ScenarioSourceConfig } from "./scenario-loader"
import type { ScenarioModule, ScenarioReleaseTier } from "./types"

export const benchmarkBundleSchema = z.object({
  benchmarkId: z.string().min(1),
  bundleVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  datasetBundleVersion: z.string().min(1),
  benchmarkBundleId: z.string().min(1),
  scenarioCatalogVersion: z.string().min(1),
  scoringRubricVersion: z.string().min(1),
  promptPackVersion: z.string().min(1),
  recommendedJudgeModel: z.string().min(1),
  recommendedJudgeStrategy: z.enum(["single", "pair-with-tiebreak"]).default("single"),
  releaseTier: z.enum(["core-public", "holdout", "partner-only", "organization-local"]).default("core-public"),
  splitPolicyVersion: z.string().min(1).default("v1"),
  publicSafe: z.boolean().default(true),
  createdAt: z.string(),
  modules: z.array(z.unknown()).default([]),
})

export type BenchmarkBundle = z.infer<typeof benchmarkBundleSchema>

export interface CreateBenchmarkBundleOptions {
  benchmarkId?: string
  bundleVersion?: string
  datasetBundleVersion?: string
  scoringRubricVersion?: string
  promptPackVersion?: string
  recommendedJudgeModel?: string
  recommendedJudgeStrategy?: "single" | "pair-with-tiebreak"
  releaseTier?: "core-public" | "holdout" | "partner-only" | "organization-local"
  modules?: ScenarioModule[]
}

const RELEASE_TIER_ORDER: Record<ScenarioReleaseTier, number> = {
  "core-public": 0,
  "partner-only": 1,
  holdout: 2,
  "organization-local": 3,
}

function deriveBundleReleaseTier(modules: ScenarioModule[]): ScenarioReleaseTier {
  let highestTier: ScenarioReleaseTier = "core-public"

  for (const moduleDefinition of modules) {
    const moduleTier = moduleDefinition.provenance?.releaseTier ?? "core-public"
    if (RELEASE_TIER_ORDER[moduleTier] > RELEASE_TIER_ORDER[highestTier]) {
      highestTier = moduleTier
    }

    for (const scenario of moduleDefinition.scenarios) {
      const scenarioTier = scenario.provenance?.releaseTier ?? moduleTier
      if (RELEASE_TIER_ORDER[scenarioTier] > RELEASE_TIER_ORDER[highestTier]) {
        highestTier = scenarioTier
      }
    }
  }

  return highestTier
}

function normalizeBundleModules(rawModules: unknown[]): ScenarioModule[] {
  const definitions = scenarioModuleDefinitionSchema.array().parse(rawModules)
  return validateScenarioModules(definitions)
}

function assertBundleReleaseTierCompatibility(bundle: BenchmarkBundle, modules: ScenarioModule[]) {
  const nonPublicTiers = new Set<ScenarioReleaseTier>()

  for (const moduleDefinition of modules) {
    const moduleTier = moduleDefinition.provenance?.releaseTier ?? "core-public"
    if (moduleTier !== "core-public") nonPublicTiers.add(moduleTier)

    for (const scenario of moduleDefinition.scenarios) {
      const scenarioTier = scenario.provenance?.releaseTier ?? moduleTier
      if (scenarioTier !== "core-public") nonPublicTiers.add(scenarioTier)
    }
  }

  if (bundle.releaseTier === "core-public" && nonPublicTiers.size > 0) {
    throw new Error(
      `Bundle '${bundle.benchmarkBundleId}' is marked core-public but contains non-public content (${[
        ...nonPublicTiers,
      ].join(", ")}).`
    )
  }

  if (bundle.releaseTier !== "organization-local") {
    const disallowedTiers = [...nonPublicTiers].filter((tier) => tier !== bundle.releaseTier)
    if (disallowedTiers.length > 0) {
      throw new Error(
        `Bundle '${bundle.benchmarkBundleId}' mixes release tiers incompatible with bundle tier '${bundle.releaseTier}': ${disallowedTiers.join(", ")}.`
      )
    }
  }
}

export function createBenchmarkBundle(options: CreateBenchmarkBundleOptions = {}): BenchmarkBundle {
  const benchmarkId = options.benchmarkId ?? "dystopiabench-core"
  const bundleVersion = options.bundleVersion ?? "1.0.0"
  const datasetBundleVersion = options.datasetBundleVersion ?? `${benchmarkId}@${bundleVersion}`
  const modules = options.modules ?? CORE_REGISTERED_MODULES
  const normalizedModules = normalizeBundleModules(JSON.parse(JSON.stringify(modules)) as unknown[])
  const scenarioCatalogVersion = createScenarioCatalogVersion(normalizedModules)
  const releaseTier = options.releaseTier ?? deriveBundleReleaseTier(normalizedModules)

  return {
    benchmarkId,
    bundleVersion,
    datasetBundleVersion,
    benchmarkBundleId: `${benchmarkId}@${bundleVersion}`,
    scenarioCatalogVersion,
    scoringRubricVersion: options.scoringRubricVersion ?? "dcs-4tier-v2",
    promptPackVersion: options.promptPackVersion ?? "dystopiabench-prompts-v2",
    recommendedJudgeModel: options.recommendedJudgeModel ?? "google/gemini-3-flash-preview",
    recommendedJudgeStrategy: options.recommendedJudgeStrategy ?? "single",
    releaseTier,
    splitPolicyVersion: "v1",
    publicSafe: releaseTier === "core-public",
    createdAt: new Date().toISOString(),
    modules: normalizedModules,
  }
}

export async function createBenchmarkBundleFromSources(
  sources: Array<string | ScenarioSourceConfig>,
  options: CreateBenchmarkBundleOptions = {},
): Promise<BenchmarkBundle> {
  const modules = await loadScenarioModulesFromSources(sources)
  return createBenchmarkBundle({ ...options, modules })
}

export function validateBenchmarkBundle(bundle: unknown): BenchmarkBundle {
  const parsed = benchmarkBundleSchema.parse(bundle)
  const modules = normalizeBundleModules(parsed.modules)
  const expectedBundleId = `${parsed.benchmarkId}@${parsed.bundleVersion}`
  if (parsed.benchmarkBundleId !== expectedBundleId) {
    throw new Error(
      `Bundle id mismatch: expected '${expectedBundleId}' but found '${parsed.benchmarkBundleId}'.`
    )
  }

  const expectedCatalogVersion = createScenarioCatalogVersion(modules)
  if (parsed.scenarioCatalogVersion !== expectedCatalogVersion) {
    throw new Error(
      `Scenario catalog version mismatch: expected '${expectedCatalogVersion}' but found '${parsed.scenarioCatalogVersion}'.`
    )
  }

  assertBundleReleaseTierCompatibility(parsed, modules)
  assertBundleGovernance(modules, parsed.releaseTier)
  return {
    ...parsed,
    modules,
  }
}

export function isPublicReleaseTier(releaseTier: BenchmarkBundle["releaseTier"]): boolean {
  return releaseTier === "core-public"
}

export function filterBundleModulesByReleaseTier(
  modules: ScenarioModule[],
  allowedTiers: ReadonlySet<NonNullable<ScenarioModule["provenance"]>["releaseTier"]>,
): ScenarioModule[] {
  return modules
    .filter((module) => allowedTiers.has(module.provenance?.releaseTier ?? "core-public"))
    .map((module) => ({
      ...module,
      scenarios: module.scenarios.filter((scenario) =>
        allowedTiers.has(scenario.provenance?.releaseTier ?? module.provenance?.releaseTier ?? "core-public")
      ),
    }))
    .filter((module) => module.scenarios.length > 0)
}

export function deriveReleaseTierForModule(moduleDefinition: ScenarioModule): ScenarioReleaseTier {
  return (
    moduleDefinition.provenance?.releaseTier ??
    deriveReleaseTierFromSplit(moduleDefinition.provenance?.split) ??
    "core-public"
  )
}
