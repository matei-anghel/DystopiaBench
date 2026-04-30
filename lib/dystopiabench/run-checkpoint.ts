import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { z } from "zod"
import {
  benchmarkResultV2Schema,
  conversationModeSchema,
  endpointUsedSchema,
  judgeStrategySchema,
  providerPrecisionPolicySchema,
} from "./schemas"
import { getPrivateArtifactDir, sanitizeRunId } from "./storage"

export const runCheckpointStatusSchema = z.enum(["running", "interrupted", "completed"])

export const runCheckpointConfigSchema = z.object({
  module: z.string(),
  modelIds: z.array(z.string()),
  levels: z.array(z.number().int().min(1).max(5)),
  scenarioIds: z.array(z.string()).optional(),
  judgeModel: z.string().optional(),
  judgeModels: z.array(z.string()).optional(),
  judgeStrategy: judgeStrategySchema.optional(),
  transportPolicy: z.enum(["chat-first-fallback", "chat-only"]).optional(),
  conversationMode: conversationModeSchema.optional(),
  providerPrecisionPolicy: providerPrecisionPolicySchema.optional(),
  timeoutMs: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  perModelConcurrency: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  retryBackoffBaseMs: z.number().int().positive().optional(),
  retryBackoffJitterMs: z.number().int().nonnegative().optional(),
  replicates: z.number().int().positive().optional(),
  experimentId: z.string().optional(),
  project: z.string().optional(),
  owner: z.string().optional(),
  purpose: z.string().optional(),
  modelSnapshot: z.string().optional(),
  providerRegion: z.string().optional(),
  policyVersion: z.string().optional(),
  systemPromptOverrideUsed: z.boolean().optional(),
  customPrepromptUsed: z.boolean().optional(),
  gitCommit: z.string().optional(),
  datasetBundleVersion: z.string().optional(),
  benchmarkId: z.string().optional(),
  benchmarkBundleVersion: z.string().optional(),
  scenarioSources: z.array(z.string()).optional(),
  promptLocale: z.string().optional(),
  sourceLocale: z.string().optional(),
  localePack: z.unknown().optional(),
  localePackId: z.string().optional(),
  localePreset: z.string().optional(),
  retainRuns: z.number().int().nonnegative().optional(),
  archiveDir: z.string().optional(),
  allowNonPublicPublish: z.boolean().optional(),
  publishLatestAliases: z.boolean().optional(),
})

export const runCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: runCheckpointStatusSchema,
  totalPlannedPrompts: z.number().int().nonnegative(),
  completedPrompts: z.number().int().nonnegative(),
  config: runCheckpointConfigSchema,
  results: z.array(benchmarkResultV2Schema),
  openrouter: z.object({
    linkedRowCount: z.number().int().nonnegative().optional(),
    rowsMissingGenerationId: z.number().int().nonnegative().optional(),
    archivePath: z.string().optional(),
  }).optional(),
})

export type RunCheckpoint = z.infer<typeof runCheckpointSchema>
export type RunCheckpointConfig = z.infer<typeof runCheckpointConfigSchema>
export type RunCheckpointStatus = z.infer<typeof runCheckpointStatusSchema>

export function getRunCheckpointDir(): string {
  return join(getPrivateArtifactDir(), "run-checkpoints")
}

export function getRunCheckpointPath(runId: string): string {
  return join(getRunCheckpointDir(), `checkpoint-${sanitizeRunId(runId)}.json`)
}

function writeJsonAtomic(filePath: string, value: unknown) {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tempPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  )
  writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf-8")
  chmodSync(tempPath, 0o644)
  renameSync(tempPath, filePath)
}

export function createRunCheckpoint(input: {
  runId: string
  config: RunCheckpointConfig
  totalPlannedPrompts?: number
  results?: RunCheckpoint["results"]
  status?: RunCheckpointStatus
}): RunCheckpoint {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    runId: sanitizeRunId(input.runId),
    createdAt: now,
    updatedAt: now,
    status: input.status ?? "running",
    totalPlannedPrompts: input.totalPlannedPrompts ?? input.results?.length ?? 0,
    completedPrompts: input.results?.length ?? 0,
    config: input.config,
    results: input.results ?? [],
  }
}

export function writeRunCheckpoint(checkpoint: RunCheckpoint, filePath = getRunCheckpointPath(checkpoint.runId)) {
  checkpoint.updatedAt = new Date().toISOString()
  checkpoint.completedPrompts = checkpoint.results.length
  writeJsonAtomic(filePath, checkpoint)
}

export function readRunCheckpoint(runId: string): RunCheckpoint {
  const filePath = getRunCheckpointPath(runId)
  if (!existsSync(filePath)) {
    throw new Error(`Run checkpoint not found: ${filePath}`)
  }
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
  return runCheckpointSchema.parse(raw)
}

export function hasRunCheckpoint(runId: string): boolean {
  return existsSync(getRunCheckpointPath(runId))
}

export function checkpointResultKey(row: Pick<RunCheckpoint["results"][number], "sampleId" | "scenarioId" | "modelId" | "level" | "replicate">): string {
  return row.sampleId ?? `${row.scenarioId}::${row.modelId}::${row.level}::r${row.replicate ?? 1}`
}

export function isCheckpointRowScorable(row: RunCheckpoint["results"][number]): boolean {
  return row.scorable === true
}

export function isCheckpointRowTerminalTransportFailure(row: RunCheckpoint["results"][number]): boolean {
  return row.status === "model_error" || row.status === "aborted"
}

export function buildResumePrefixRows(checkpoint: RunCheckpoint): RunCheckpoint["results"] {
  const byPair = new Map<string, Array<RunCheckpoint["results"][number]>>()
  for (const row of checkpoint.results) {
    const pair = `${row.scenarioId}::${row.modelId}::r${row.replicate ?? 1}`
    const existing = byPair.get(pair)
    if (existing) {
      existing.push(row)
    } else {
      byPair.set(pair, [row])
    }
  }

  const prefixRows: RunCheckpoint["results"] = []
  for (const rows of byPair.values()) {
    const sorted = [...rows].sort((a, b) => a.level - b.level)
    for (const row of sorted) {
      if (!isCheckpointRowScorable(row)) break
      prefixRows.push(row)
    }
  }

  return prefixRows
}
