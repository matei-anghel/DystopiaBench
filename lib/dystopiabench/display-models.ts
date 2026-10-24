import { getProviderColor } from "./chart-config"
import { ALL_CURATED_MODELS, getModelById } from "./models"
import type { BenchmarkResult } from "./types"

/**
 * Chart-facing model descriptor. Dashboard model lists are always derived from the model IDs
 * present in the loaded results (never from the current run roster), so changing the roster in
 * `models.ts` cannot hide historical results.
 */
export interface DisplayModel {
  id: string
  label: string
  provider: string
  color: string
}

type ResultModelFields = Pick<BenchmarkResult, "modelId" | "modelLabel" | "provider">

const CURATED_ORDER = new Map(ALL_CURATED_MODELS.map((model, index) => [model.id, index]))

export function resolveDisplayModel(modelId: string, fallback?: Partial<ResultModelFields>): DisplayModel {
  const curated = getModelById(modelId)
  const provider = curated?.provider ?? fallback?.provider ?? "Unknown"
  return {
    id: modelId,
    label: curated?.label ?? fallback?.modelLabel ?? modelId,
    provider,
    color: getProviderColor(provider),
  }
}

/** Curated catalog order groups models by lab; unknown models follow, alphabetically. */
export function compareDisplayModels(left: DisplayModel, right: DisplayModel): number {
  const leftOrder = CURATED_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = CURATED_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return left.label.localeCompare(right.label)
}

export function getDisplayModels(
  results: readonly ResultModelFields[],
  selectedModelIds?: readonly string[],
): DisplayModel[] {
  const firstRowByModel = new Map<string, ResultModelFields>()
  for (const row of results) {
    if (!firstRowByModel.has(row.modelId)) firstRowByModel.set(row.modelId, row)
  }

  const selected = selectedModelIds ? new Set(selectedModelIds) : null
  return [...firstRowByModel.entries()]
    .filter(([modelId]) => !selected || selected.has(modelId))
    .map(([modelId, row]) => resolveDisplayModel(modelId, row))
    .sort(compareDisplayModels)
}

export function indexDisplayModels(models: readonly DisplayModel[]): Map<string, DisplayModel> {
  return new Map(models.map((model) => [model.id, model]))
}

const LINE_DASH_PATTERNS = [undefined, "6 3", "2 3", "10 3 2 3", "1 2"] as const

/**
 * Models share their lab's colour, so lines from the same lab are told apart by dash pattern:
 * the first model of each lab is solid, later ones are dashed/dotted.
 */
export function getModelLineDashes(models: readonly DisplayModel[]): Map<string, string | undefined> {
  const seenPerProvider = new Map<string, number>()
  const dashes = new Map<string, string | undefined>()
  for (const model of models) {
    const rank = seenPerProvider.get(model.provider) ?? 0
    seenPerProvider.set(model.provider, rank + 1)
    dashes.set(model.id, LINE_DASH_PATTERNS[rank % LINE_DASH_PATTERNS.length])
  }
  return dashes
}
