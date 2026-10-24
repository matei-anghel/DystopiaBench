import { readFileSync } from "node:fs"
import { join } from "node:path"
import { resolveDisplayModel, type DisplayModel } from "./display-models"
import type { BenchmarkResult } from "./types"

/**
 * Build-time summary of the published V1 dataset, read straight from the chart files the
 * dashboard loads, so static pages (hero chart, methodology) can never drift from the data.
 * Server-only: uses the filesystem during static generation.
 */

const V1_DATA_DIR = join(process.cwd(), "public", "data")

/** Generation and judging settings recorded in the V1 run manifest (run main-plus-mistral-medium-3-5-20260506). */
export const V1_RUN_CONFIG = {
  runId: "main-plus-mistral-medium-3-5-20260506",
  publishedDate: "2026-05-06",
  modelTemperature: 0,
  modelTopP: 1,
  judgeTemperature: 0,
  judgeTopP: 1,
  maxRetries: 0,
  timeoutMs: 45_000,
  judgeStrategy: "pair-with-tiebreak",
  judgeModels: ["gpt-5.4-mini", "claude-haiku-4.5"],
  judgeTieBreakerModel: "kimi-k2.6",
  transportPolicy: "chat-first-fallback",
  providerPrecisionPolicy: "default",
  scheduler: "level-wave",
} as const

export const V1_DATA_FILES = {
  stateful: "public/data/legacy-results-stateful.chart.json",
  stateless: "public/data/legacy-results-stateless.chart.json",
} as const

export interface V1ModelAggregate extends DisplayModel {
  avgScore: number
}

export interface V1Summary {
  modelCount: number
  scenarioCount: number
  moduleCount: number
  levelCount: number
  replicates: number
  tupleCount: number
  promptAttempts: number
  statelessModelCount: number
  statelessScenarioCount: number
  models: V1ModelAggregate[]
}

function readResults(mode: keyof typeof V1_DATA_FILES): BenchmarkResult[] {
  const raw = readFileSync(join(V1_DATA_DIR, `legacy-results-${mode}.chart.json`), "utf8")
  const payload = JSON.parse(raw) as { results?: BenchmarkResult[] }
  return Array.isArray(payload.results) ? payload.results : []
}

let cachedSummary: V1Summary | undefined

export function getV1Summary(): V1Summary {
  if (cachedSummary) return cachedSummary

  const stateful = readResults("stateful")
  const stateless = readResults("stateless")
  const rowsByModel = new Map<string, BenchmarkResult[]>()
  for (const row of stateful) {
    const rows = rowsByModel.get(row.modelId)
    if (rows) rows.push(row)
    else rowsByModel.set(row.modelId, [row])
  }

  const models = [...rowsByModel.entries()].map(([modelId, rows]) => ({
    ...resolveDisplayModel(modelId, rows[0]),
    avgScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
  }))
  const replicates = Math.max(1, ...stateful.map((row) => row.replicateCount ?? 1))

  cachedSummary = {
    modelCount: rowsByModel.size,
    scenarioCount: new Set(stateful.map((row) => row.scenarioId)).size,
    moduleCount: new Set(stateful.map((row) => row.module)).size,
    levelCount: new Set(stateful.map((row) => row.level)).size,
    replicates,
    tupleCount: stateful.length,
    promptAttempts: stateful.reduce((sum, row) => sum + (row.replicateCount ?? 1), 0),
    statelessModelCount: new Set(stateless.map((row) => row.modelId)).size,
    statelessScenarioCount: new Set(stateless.map((row) => row.scenarioId)).size,
    models,
  }
  return cachedSummary
}
