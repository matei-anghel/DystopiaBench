const OPENROUTER_BATCH_URL = "https://openrouter.ai/api/v1/batches"
const BATCH_POLL_INTERVAL_MS = 10_000
const BATCH_WAIT_LIMIT_MS = 26 * 60 * 60 * 1000

interface BatchRecord {
  id?: string
  status?: string
  error?: unknown
  usage?: { cost?: number }
  results?: Array<{
    custom_id?: string
    response?: { status_code?: number; body?: Record<string, unknown> }
    error?: unknown
  }> | null
}

export class OpenRouterBatchSubmittedError extends Error {
  constructor(message: string, readonly batchId: string) {
    super(`${message} (batch ${batchId})`)
    this.name = "OpenRouterBatchSubmittedError"
  }
}

export async function submitAndWaitForOpenRouterBatch(params: {
  apiKey: string
  batchModelString: string
  body: Record<string, unknown>
  abortSignal?: AbortSignal
}): Promise<{ batchId: string; body: Record<string, unknown>; costUsd?: number }> {
  const model = params.batchModelString.replace(/:batch$/, "")
  const headers = {
    Authorization: `Bearer ${params.apiKey}`,
    "Content-Type": "application/json",
  }
  const customId = "dystopiabench-request"
  const submitted = await fetch(OPENROUTER_BATCH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: "/v1/chat/completions",
      model,
      requests: [{ custom_id: customId, body: params.body }],
    }),
    signal: params.abortSignal,
  })
  if (!submitted.ok) {
    throw new Error(`OpenRouter batch submission HTTP ${submitted.status}: ${await submitted.text()}`)
  }
  const created = await submitted.json() as BatchRecord
  if (!created.id) throw new Error("OpenRouter batch submission returned no batch ID.")

  const startedAt = Date.now()
  while (true) {
    if (params.abortSignal?.aborted) {
      throw new OpenRouterBatchSubmittedError("Polling interrupted; the submitted batch may still complete", created.id)
    }
    if (Date.now() - startedAt > BATCH_WAIT_LIMIT_MS) {
      throw new OpenRouterBatchSubmittedError("Batch polling exceeded 26 hours", created.id)
    }

    let record: BatchRecord
    try {
      const response = await fetch(`${OPENROUTER_BATCH_URL}/${encodeURIComponent(created.id)}`, {
        headers,
        signal: params.abortSignal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      record = await response.json() as BatchRecord
    } catch (error) {
      throw new OpenRouterBatchSubmittedError(`Could not poll submitted batch: ${error instanceof Error ? error.message : error}`, created.id)
    }

    if (record.status === "completed") {
      const result = record.results?.find((item) => item.custom_id === customId)
      if (!result) throw new OpenRouterBatchSubmittedError("Completed batch has no matching result", created.id)
      if (result.error || !result.response?.body || result.response.status_code !== 200) {
        throw new OpenRouterBatchSubmittedError(`Batch request failed: ${JSON.stringify(result.error ?? result.response)}`, created.id)
      }
      return { batchId: created.id, body: result.response.body, costUsd: record.usage?.cost }
    }
    if (["failed", "expired", "cancelled"].includes(record.status ?? "")) {
      throw new OpenRouterBatchSubmittedError(`Batch ended with status ${record.status}: ${JSON.stringify(record.error)}`, created.id)
    }
    if (!["validating", "in_progress", "finalizing", "cancelling"].includes(record.status ?? "")) {
      throw new OpenRouterBatchSubmittedError(`Batch returned unexpected status ${record.status}`, created.id)
    }

    await new Promise<void>((resolve) => setTimeout(resolve, BATCH_POLL_INTERVAL_MS))
  }
}
