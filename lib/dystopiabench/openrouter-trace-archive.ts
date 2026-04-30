import { OpenRouter } from "@openrouter/sdk"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { z } from "zod"
import type { BenchmarkResultV2, RunManifestV2 } from "./schemas"
import { getOpenRouterAppTitle, getOpenRouterHttpReferer, requireOpenRouterApiKey } from "./env"
import { getPrivateArtifactDir } from "./storage"

const openRouterTraceUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
})

export const openRouterTraceLinkSchema = z.object({
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
  generationName: z.string().optional(),
  endpointUsed: z.string().optional(),
  responseId: z.string().optional(),
  responseModelId: z.string().optional(),
  requestId: z.string().optional(),
  generationId: z.string().optional(),
  finishReason: z.string().optional(),
  rawFinishReason: z.string().optional(),
  cacheStatus: z.string().optional(),
  cacheTtl: z.string().optional(),
  usage: openRouterTraceUsageSchema.optional(),
}).passthrough()

export const openRouterTraceRowSchema = z.object({
  sampleId: z.string().optional(),
  attemptId: z.string().optional(),
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  modelId: z.string(),
  modelLabel: z.string(),
  provider: z.string(),
  level: z.number().int().min(1).max(5),
  replicate: z.number().int().positive().optional(),
  prompt: z.string(),
  response: z.string(),
  promptHash: z.string().length(64).optional(),
  responseHash: z.string().length(64).optional(),
  timestamp: z.number().int(),
  traceLink: openRouterTraceLinkSchema,
})

const openRouterGenerationContentSchema = z.object({
  input: z.union([
    z.object({
      prompt: z.string(),
    }),
    z.object({
      messages: z.array(z.unknown().nullable()),
    }),
  ]),
  output: z.object({
    completion: z.string().nullable(),
    reasoning: z.string().nullable(),
  }),
})

export const openRouterArchiveErrorSchema = z.object({
  category: z.enum(["unauthorized", "forbidden", "not_found", "rate_limited", "error"]),
  statusCode: z.number().int().optional(),
  name: z.string().optional(),
  message: z.string(),
})

export const openRouterTraceArchiveEntrySchema = z.object({
  generationId: z.string(),
  rows: z.array(openRouterTraceRowSchema).min(1),
  metadataStatus: z.enum(["ok", "error"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  metadataError: openRouterArchiveErrorSchema.optional(),
  contentStatus: z.enum(["ok", "error"]),
  content: openRouterGenerationContentSchema.optional(),
  contentError: openRouterArchiveErrorSchema.optional(),
})

export const openRouterTraceArchiveSchema = z.object({
  schemaVersion: z.literal(1),
  archivedAt: z.string(),
  runId: z.string(),
  runTimestamp: z.number().int(),
  runDate: z.string(),
  summary: z.object({
    totalRunRows: z.number().int().nonnegative(),
    openrouterRowCount: z.number().int().nonnegative(),
    rowsMissingGenerationId: z.number().int().nonnegative(),
    uniqueGenerationCount: z.number().int().nonnegative(),
    metadataRetrievedCount: z.number().int().nonnegative(),
    contentRetrievedCount: z.number().int().nonnegative(),
  }),
  entries: z.array(openRouterTraceArchiveEntrySchema),
})

export type OpenRouterTraceLink = z.infer<typeof openRouterTraceLinkSchema>
export type OpenRouterTraceArchiveRow = z.infer<typeof openRouterTraceRowSchema>
export type OpenRouterTraceArchiveEntry = z.infer<typeof openRouterTraceArchiveEntrySchema>
export type OpenRouterTraceArchive = z.infer<typeof openRouterTraceArchiveSchema>

export interface OpenRouterTraceArchiveWriteResult {
  archive: OpenRouterTraceArchive
  path: string
  relativePath: string
}

export interface OpenRouterGenerationClient {
  getGeneration(request: { id: string }): Promise<{ data: Record<string, unknown> }>
  listGenerationContent(request: { id: string }): Promise<{
    data: {
      input: { prompt: string } | { messages: Array<unknown | null> }
      output: {
        completion: string | null
        reasoning: string | null
      }
    }
  }>
}

export interface OpenRouterArchiveTarget {
  generationId: string
  rows: OpenRouterTraceArchiveRow[]
}

export interface OpenRouterArchiveTargetCollection {
  openrouterRowCount: number
  rowsMissingGenerationId: number
  targets: OpenRouterArchiveTarget[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function extractTraceLink(result: BenchmarkResultV2): OpenRouterTraceLink | undefined {
  const candidate = isRecord(result.providerMetadata) ? result.providerMetadata.openrouter : undefined
  const parsed = openRouterTraceLinkSchema.safeParse(candidate)
  if (!parsed.success) return undefined
  return parsed.data
}

function resolveGenerationId(link: OpenRouterTraceLink): string | undefined {
  if (link.generationId?.trim()) return link.generationId.trim()
  if (link.responseId?.startsWith("gen-")) return link.responseId
  return undefined
}

function toArchiveRow(result: BenchmarkResultV2, traceLink: OpenRouterTraceLink): OpenRouterTraceArchiveRow {
  return {
    sampleId: result.sampleId,
    attemptId: result.attemptId,
    scenarioId: result.scenarioId,
    scenarioTitle: result.scenarioTitle,
    modelId: result.modelId,
    modelLabel: result.modelLabel,
    provider: result.provider,
    level: result.level,
    replicate: result.replicate,
    prompt: result.prompt,
    response: result.response,
    promptHash: result.promptHash,
    responseHash: result.responseHash,
    timestamp: result.timestamp,
    traceLink,
  }
}

export function collectOpenRouterArchiveTargets(
  manifest: RunManifestV2,
): OpenRouterArchiveTargetCollection {
  const byGenerationId = new Map<string, OpenRouterArchiveTarget>()
  let openrouterRowCount = 0
  let rowsMissingGenerationId = 0

  for (const result of manifest.results) {
    const traceLink = extractTraceLink(result)
    if (!traceLink) continue

    openrouterRowCount++
    const generationId = resolveGenerationId(traceLink)
    if (!generationId) {
      rowsMissingGenerationId++
      continue
    }

    const row = toArchiveRow(result, traceLink)
    const existing = byGenerationId.get(generationId)
    if (existing) {
      existing.rows.push(row)
      continue
    }

    byGenerationId.set(generationId, {
      generationId,
      rows: [row],
    })
  }

  return {
    openrouterRowCount,
    rowsMissingGenerationId,
    targets: [...byGenerationId.values()].sort((a, b) => a.rows[0].timestamp - b.rows[0].timestamp),
  }
}

function classifyArchiveError(error: unknown): z.infer<typeof openRouterArchiveErrorSchema> {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
        ? error.status
        : undefined

  const name =
    typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
      ? error.name
      : undefined

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown OpenRouter archive error."

  const category =
    statusCode === 401
      ? "unauthorized"
      : statusCode === 403
        ? "forbidden"
        : statusCode === 404
          ? "not_found"
          : statusCode === 429
            ? "rate_limited"
            : "error"

  return {
    category,
    statusCode,
    name,
    message,
  }
}

export function createOpenRouterGenerationClient(apiKey = requireOpenRouterApiKey()): OpenRouterGenerationClient {
  const client = new OpenRouter({
    apiKey,
    httpReferer: getOpenRouterHttpReferer(),
    appTitle: getOpenRouterAppTitle(),
  })
  return client.generations
}

export function getOpenRouterTraceArchivePath(runId: string): string {
  return join(getPrivateArtifactDir(), "openrouter-traces", `openrouter-traces-${runId}.json`)
}

export function writeOpenRouterTraceArchive(
  archive: OpenRouterTraceArchive,
  outFile = getOpenRouterTraceArchivePath(archive.runId),
): OpenRouterTraceArchiveWriteResult {
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(archive, null, 2), "utf-8")
  const relativePath = relative(process.cwd(), outFile) || outFile
  return {
    archive,
    path: outFile,
    relativePath,
  }
}

export async function archiveOpenRouterTracesForManifest(
  manifest: RunManifestV2,
  options?: {
    client?: OpenRouterGenerationClient
  },
): Promise<OpenRouterTraceArchive> {
  const client = options?.client ?? createOpenRouterGenerationClient()
  const collection = collectOpenRouterArchiveTargets(manifest)
  const entries: OpenRouterTraceArchiveEntry[] = []

  for (const target of collection.targets) {
    const entry: OpenRouterTraceArchiveEntry = {
      generationId: target.generationId,
      rows: target.rows,
      metadataStatus: "error",
      contentStatus: "error",
    }

    const [metadataResult, contentResult] = await Promise.allSettled([
      client.getGeneration({ id: target.generationId }),
      client.listGenerationContent({ id: target.generationId }),
    ])

    if (metadataResult.status === "fulfilled") {
      entry.metadataStatus = "ok"
      entry.metadata = metadataResult.value.data
    } else {
      entry.metadataError = classifyArchiveError(metadataResult.reason)
    }

    if (contentResult.status === "fulfilled") {
      entry.contentStatus = "ok"
      entry.content = openRouterGenerationContentSchema.parse(contentResult.value.data)
    } else {
      entry.contentError = classifyArchiveError(contentResult.reason)
    }

    entries.push(entry)
  }

  const archive = {
    schemaVersion: 1 as const,
    archivedAt: new Date().toISOString(),
    runId: manifest.runId,
    runTimestamp: manifest.timestamp,
    runDate: manifest.date,
    summary: {
      totalRunRows: manifest.results.length,
      openrouterRowCount: collection.openrouterRowCount,
      rowsMissingGenerationId: collection.rowsMissingGenerationId,
      uniqueGenerationCount: collection.targets.length,
      metadataRetrievedCount: entries.filter((entry) => entry.metadataStatus === "ok").length,
      contentRetrievedCount: entries.filter((entry) => entry.contentStatus === "ok").length,
    },
    entries,
  }

  return openRouterTraceArchiveSchema.parse(archive)
}

export async function archiveAndWriteOpenRouterTracesForManifest(
  manifest: RunManifestV2,
  options?: {
    client?: OpenRouterGenerationClient
    outFile?: string
  },
): Promise<OpenRouterTraceArchiveWriteResult> {
  const archive = await archiveOpenRouterTracesForManifest(manifest, options)
  return writeOpenRouterTraceArchive(archive, options?.outFile)
}
