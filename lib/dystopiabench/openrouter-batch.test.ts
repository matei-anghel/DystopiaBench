import assert from "node:assert/strict"
import test from "node:test"
import { submitAndWaitForOpenRouterBatch } from "./openrouter-batch"

test("batch models submit the base slug and return the matching completion", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = []
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined,
    })
    if (calls.length === 1) return Response.json({ id: "batch-test", status: "validating" }, { status: 202 })
    return Response.json({
      id: "batch-test",
      status: "completed",
      usage: { cost: 0.25 },
      results: [{
        custom_id: "dystopiabench-request",
        response: { status_code: 200, body: { choices: [{ message: { content: "answer" } }] } },
      }],
    })
  }
  try {
    const result = await submitAndWaitForOpenRouterBatch({
      apiKey: "test-key",
      batchModelString: "openai/gpt-6-sol:batch",
      body: { messages: [{ role: "user", content: "test" }], reasoning: { effort: "none" } },
    })
    assert.equal(calls[0]?.url, "https://openrouter.ai/api/v1/batches")
    assert.equal(calls[0]?.body?.model, "openai/gpt-6-sol")
    assert.deepEqual((calls[0]?.body?.requests as Array<{ body: unknown }>)[0]?.body, {
      messages: [{ role: "user", content: "test" }],
      reasoning: { effort: "none" },
    })
    assert.equal(calls[1]?.url, "https://openrouter.ai/api/v1/batches/batch-test")
    assert.equal(result.body.choices instanceof Array, true)
    assert.equal(result.costUsd, 0.25)
  } finally {
    globalThis.fetch = originalFetch
  }
})
