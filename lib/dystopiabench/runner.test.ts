import assert from "node:assert/strict"
import test from "node:test"
import { OpenRouter } from "@openrouter/sdk"
import {
  DEFAULT_JUDGE_MODEL,
  PAIR_WITH_TIEBREAK_ARBITER_MODEL,
  PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL,
} from "./models"
import { parseModelIdentifier, resolveJudgeModels } from "./model-selectors"
import {
  NON_QUANTIZED_PROVIDER_QUANTIZATIONS,
  aggregateJudgeVotes,
  buildFirstSeenIdMap,
  buildProviderOverride,
  createOpenRouterFetchWithProviderOverrides,
  evaluateResponseWithJudges,
  extractTextFromModelResult,
  isTransientNetworkError,
  normalizeQuantization,
  parseArbiterOutput,
  runBenchmark,
  summarizeResults,
} from "./runner"
import { GENERATION_CONFIG, runManifestV2Schema } from "./schemas"
import { toModuleId, type ScenarioModule } from "./types"

process.env.OPENROUTER_API_KEY ??= "test-openrouter-key"

interface PendingJudgeFetch {
  model: string
  resolve: (content: string) => void
}

const FIXTURE_MODEL_STRING = "openai/gpt-5.3-codex"

test("OpenRouter 429 errors are retryable", () => {
  const error = new Error("Provider returned error")
  error.name = "TooManyRequestsResponseError"

  assert.equal(isTransientNetworkError(error), true)
})

function isFixtureModel(model: string | undefined): boolean {
  return model === FIXTURE_MODEL_STRING
}

function chatCompletionResponse(
  model: string,
  content: string,
  options: {
    finishReason?: string
    completionTokens?: number
    reasoningTokens?: number
    responseHeaders?: Record<string, string>
    responseMetadata?: Record<string, unknown>
    choiceMetadata?: Record<string, unknown>
  } = {},
) {
  const completionTokens = options.completionTokens ?? (content ? 2 : 0)
  const reasoningTokens = options.reasoningTokens ?? 0
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1,
      model,
      system_fingerprint: null,
      ...options.responseMetadata,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: options.finishReason ?? "stop",
          ...options.choiceMetadata,
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: completionTokens,
        total_tokens: 1 + completionTokens,
        completion_tokens_details: {
          reasoning_tokens: reasoningTokens,
        },
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", ...options.responseHeaders },
    },
  )
}

async function readJsonRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<Record<string, unknown>> {
  let body: Record<string, unknown>
  if (typeof init?.body === "string") {
    body = JSON.parse(init.body) as Record<string, unknown>
  } else if (input instanceof Request) {
    body = JSON.parse(await input.clone().text()) as Record<string, unknown>
  } else {
    body = {}
  }

  assert.equal(body.max_tokens, undefined)
  assert.equal(body.maxTokens, undefined)
  assert.equal(body.maxOutputTokens, undefined)
  return body
}

function createJudgeTestApiClients() {
  return {
    openrouter: new OpenRouter({
      apiKey: "test-key",
      serverURL: "https://judges.test/v1",
      retryConfig: { strategy: "none" },
    }),
  }
}

function installMockJudgeFetch() {
  const originalFetch = globalThis.fetch
  const started: string[] = []
  const pending: PendingJudgeFetch[] = []

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as { model?: string }
    const model = body.model ?? "unknown"
    started.push(model)

    return await new Promise<Response>((resolve) => {
      pending.push({
        model,
        resolve: (content: string) =>
          resolve(chatCompletionResponse(model, content)),
      })
    })
  }) as typeof fetch

  return {
    started,
    pending,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  assert.fail(message)
}

function resolvePendingJudgeCall(pending: PendingJudgeFetch[], model: string, content: string) {
  const index = pending.findIndex((request) => request.model === model)
  assert.notEqual(index, -1, `Expected a pending judge request for ${model}`)
  pending.splice(index, 1)[0].resolve(content)
}

function createSchedulerTestModule(): ScenarioModule {
  const moduleId = toModuleId("scheduler-test")
  return {
    id: moduleId,
    label: "Scheduler Test",
    description: "Synthetic module for runner scheduling tests.",
    scenarios: [
      {
        id: "sched-a",
        module: moduleId,
        title: "Scheduler A",
        category: "test",
        description: "A",
        escalationPrompts: [
          { level: 1 as const, label: "L1", prompt: "A-L1" },
          { level: 2 as const, label: "L2", prompt: "A-L2" },
          { level: 3 as const, label: "L3", prompt: "A-L3" },
          { level: 4 as const, label: "L4", prompt: "A-L4" },
          { level: 5 as const, label: "L5", prompt: "A-L5" },
        ],
      },
      {
        id: "sched-b",
        module: moduleId,
        title: "Scheduler B",
        category: "test",
        description: "B",
        escalationPrompts: [
          { level: 1 as const, label: "L1", prompt: "B-L1" },
          { level: 2 as const, label: "L2", prompt: "B-L2" },
          { level: 3 as const, label: "L3", prompt: "B-L3" },
          { level: 4 as const, label: "L4", prompt: "B-L4" },
          { level: 5 as const, label: "L5", prompt: "B-L5" },
        ],
      },
    ],
  }
}

test("resolveJudgeModels returns the default judge model when input is undefined", () => {
  const result = resolveJudgeModels(undefined)
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels returns the default judge model when input is empty", () => {
  const result = resolveJudgeModels([])
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels returns the fallback model when input is undefined", () => {
  const fallback = "openrouter:gpt-4"
  const result = resolveJudgeModels(undefined, fallback)
  assert.deepEqual(result, [fallback])
})

test("resolveJudgeModels returns input models when provided", () => {
  const input = ["openrouter:gpt-4", "local:claude-3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, input)
})

test("resolveJudgeModels trims whitespace and filters empty strings", () => {
  const input = [" openrouter:gpt-4 ", " ", ""]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:gpt-4"])
})

test("resolveJudgeModels falls back to the default model when inputs are blank", () => {
  const input = [" ", ""]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, [DEFAULT_JUDGE_MODEL])
})

test("resolveJudgeModels deduplicates models", () => {
  const input = ["openrouter:gpt-4", " openrouter:gpt-4 ", "local:claude-3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:gpt-4", "local:claude-3"])
})

test("resolveJudgeModels throws for invalid model identifiers", () => {
  assert.throws(
    () => resolveJudgeModels(["invalid:"]),
    /missing model after provider prefix/
  )
})

test("resolveJudgeModels handles local selectors", () => {
  const input = ["local:llama3"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["local:llama3"])
})

test("resolveJudgeModels handles openrouter selectors", () => {
  const input = ["openrouter:openai/gpt-4o"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["openrouter:openai/gpt-4o"])
})

test("resolveJudgeModels handles LiteLLM selectors", () => {
  const input = ["litellm:claude-fable-5"]
  const result = resolveJudgeModels(input)
  assert.deepEqual(result, ["litellm:claude-fable-5"])
})

test("parseModelIdentifier handles LiteLLM selectors", () => {
  const parsed = parseModelIdentifier("litellm:claude-fable-5")
  assert.equal(parsed.id, "litellm:claude-fable-5")
  assert.equal(parsed.label, "LiteLLM claude-fable-5")
  assert.equal(parsed.provider, "LiteLLM")
  assert.equal(parsed.modelString, "claude-fable-5")
  assert.equal(parsed.backend, "litellm")
  assert.equal(parsed.weightClass, "unknown")
})

test("parseModelIdentifier surfaces weightClass for curated repo models", () => {
  assert.equal(parseModelIdentifier("deepseek-v3.2").weightClass, "open_weight")
  assert.equal(parseModelIdentifier("gpt-5.3-codex").weightClass, "closed")
  assert.equal(parseModelIdentifier("openrouter:moonshotai/kimi-k2.6").weightClass, "open_weight")
  assert.equal(parseModelIdentifier("openai/gpt-5.4-mini").weightClass, "closed")
})

test("buildProviderOverride only applies non-quantized filtering to open-weight OpenRouter models", () => {
  const openWeightModel = parseModelIdentifier("deepseek-v3.2")
  const closedModel = parseModelIdentifier("gpt-5.3-codex")

  assert.deepEqual(buildProviderOverride(openWeightModel, "non-quantized-only"), {
    quantizations: [...NON_QUANTIZED_PROVIDER_QUANTIZATIONS],
  })
  assert.equal(buildProviderOverride(openWeightModel, "default"), undefined)
  assert.equal(buildProviderOverride(closedModel, "non-quantized-only"), undefined)
})

test("normalizeQuantization coerces empty values to unknown", () => {
  assert.equal(normalizeQuantization(undefined), "unknown")
  assert.equal(normalizeQuantization(" FP16 "), "fp16")
})

test("buildFirstSeenIdMap preserves the first value for duplicate ids", () => {
  const catalogById = buildFirstSeenIdMap([
    { id: "duplicate", rank: 1 },
    { id: "unique", rank: 2 },
    { id: "duplicate", rank: 3 },
  ])

  assert.deepEqual(catalogById.get("duplicate"), { id: "duplicate", rank: 1 })
  assert.deepEqual(catalogById.get("unique"), { id: "unique", rank: 2 })
})

test("createOpenRouterFetchWithProviderOverrides injects provider filters for matching model requests", async () => {
  const originalFetch = globalThis.fetch
  let seenBody: string | undefined

  globalThis.fetch = (async (_input, init) => {
    seenBody = typeof init?.body === "string" ? init.body : undefined
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  try {
    const wrappedFetch = createOpenRouterFetchWithProviderOverrides(
      new Map([
        ["deepseek/deepseek-v3.2", { quantizations: [...NON_QUANTIZED_PROVIDER_QUANTIZATIONS] }],
      ])
    )

    await wrappedFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "deepseek/deepseek-v3.2",
        messages: [],
      }),
    })

    assert.ok(seenBody)
    assert.deepEqual(JSON.parse(seenBody), {
      model: "deepseek/deepseek-v3.2",
      messages: [],
      provider: { quantizations: [...NON_QUANTIZED_PROVIDER_QUANTIZATIONS] },
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("parseArbiterOutput parses structured and heuristic outputs", () => {
  assert.deepEqual(
    parseArbiterOutput("{\"side\":\"primary\",\"reasoning\":\"Primary better matches the refusal rubric.\"}"),
    {
      side: "primary",
      reasoning: "Primary better matches the refusal rubric.",
    },
  )
  assert.deepEqual(
    parseArbiterOutput("secondary\nreasoning: the second judge better matches the benchmark scale"),
    {
      side: "secondary",
      reasoning: "the second judge better matches the benchmark scale",
    },
  )
})

test("aggregateJudgeVotes resolves a split binary panel conservatively", () => {
  const result = aggregateJudgeVotes([
    { judge: "judge-a", compliance: "refusal", reasoning: "Declined.", role: "arena" },
    { judge: "judge-b", compliance: "compliant", reasoning: "Assisted.", role: "arena" },
  ])

  assert.equal(result.compliance, "compliant")
  assert.equal(result.score, 0)
})

test("runBenchmark calls LiteLLM selectors through the OpenAI-compatible chat path", async () => {
  const originalFetch = globalThis.fetch
  const originalLiteLLMApiKey = process.env.LITELLM_API_KEY
  const originalLiteLLMBaseUrl = process.env.LITELLM_BASE_URL
  const seenModels: string[] = []
  const seenUrls: string[] = []
  const seenBodies: Array<Record<string, unknown>> = []

  process.env.LITELLM_API_KEY = "test-litellm-key"
  process.env.LITELLM_BASE_URL = "https://litellm.test/"

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as Record<string, unknown> & { model?: string }
    const model = body.model ?? "unknown"
    seenModels.push(model)
    seenUrls.push(input instanceof Request ? input.url : String(input))
    seenBodies.push(body)

    if (model === "claude-fable-5") {
      return chatCompletionResponse("anthropic/claude-opus-4.6", "model response from litellm", {
        responseHeaders: {
          "x-litellm-call-id": "litellm-call-test",
          "x-litellm-model-group": "claude-fable",
        },
        responseMetadata: { provider: "anthropic" },
        choiceMetadata: { native_finish_reason: "end_turn" },
      })
    }

    return chatCompletionResponse(
      model,
      JSON.stringify({ compliance: "refusal", reasoning: "LiteLLM fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "litellm-chat-path-test",
      module: "scheduler-test",
      modelIds: ["litellm:claude-fable-5"],
      levels: [1],
      judgeModel: "litellm:judge-model",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.deepEqual(seenModels, ["claude-fable-5", "judge-model"])
    assert.ok(seenUrls.every((url) => url.startsWith("https://litellm.test/v1/")))
    assert.equal(seenBodies[0]?.temperature, undefined)
    assert.equal(seenBodies[0]?.top_p, undefined)
    assert.equal(seenBodies[1]?.temperature, GENERATION_CONFIG.judge.temperature)
    assert.equal(seenBodies[1]?.top_p, undefined)
    assert.equal(manifest.results.length, 1)
    assert.equal(manifest.results[0]?.endpointUsed, "litellm_chat")
    assert.equal(
      (manifest.results[0]?.providerMetadata?.litellm as Record<string, unknown> | undefined)?.responseModelId,
      "anthropic/claude-opus-4.6",
    )
    const liteLLMMetadata = manifest.results[0]?.providerMetadata?.litellm as Record<string, unknown>
    assert.equal(liteLLMMetadata.callId, "litellm-call-test")
    assert.equal(liteLLMMetadata.modelGroup, "claude-fable")
    assert.equal((liteLLMMetadata.responseHeaders as Record<string, string>)["x-litellm-call-id"], "litellm-call-test")
    const liteLLMResponseMetadata = liteLLMMetadata.responseMetadata as Record<string, unknown>
    assert.equal(liteLLMResponseMetadata.provider, "anthropic")
    assert.equal(
      ((liteLLMResponseMetadata.choices as Array<Record<string, unknown>>)[0]).native_finish_reason,
      "end_turn",
    )
    assert.equal(
      "message" in ((liteLLMResponseMetadata.choices as Array<Record<string, unknown>>)[0]),
      false,
    )
    assert.equal(manifest.results[0]?.status, "ok")
    assert.equal(manifest.metadata.judgeModels?.[0], "litellm:judge-model")
  } finally {
    globalThis.fetch = originalFetch
    if (originalLiteLLMApiKey === undefined) {
      delete process.env.LITELLM_API_KEY
    } else {
      process.env.LITELLM_API_KEY = originalLiteLLMApiKey
    }
    if (originalLiteLLMBaseUrl === undefined) {
      delete process.env.LITELLM_BASE_URL
    } else {
      process.env.LITELLM_BASE_URL = originalLiteLLMBaseUrl
    }
  }
})

test("runBenchmark can omit model system prompts while preserving scenario context", async () => {
  const originalFetch = globalThis.fetch
  const originalLiteLLMApiKey = process.env.LITELLM_API_KEY
  const originalLiteLLMBaseUrl = process.env.LITELLM_BASE_URL
  const seenBodies: Array<Record<string, unknown> & { model?: string; messages?: Array<{ role: string; content: string }> }> = []

  process.env.LITELLM_API_KEY = "test-litellm-key"
  process.env.LITELLM_BASE_URL = "https://litellm.test/"

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as Record<string, unknown> & {
      model?: string
      messages?: Array<{ role: string; content: string }>
    }
    seenBodies.push(body)

    if (body.model === "claude-fable-5") {
      return chatCompletionResponse("claude-fable-5", "model response from litellm")
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "LiteLLM fixture judge." }),
    )
  }) as typeof fetch

  try {
    const scenarioModule = createSchedulerTestModule()
    const manifest = await runBenchmark({
      runId: "litellm-no-model-system-prompt-test",
      module: "scheduler-test",
      modelIds: ["litellm:claude-fable-5"],
      levels: [1],
      judgeModel: "litellm:judge-model",
      transportPolicy: "chat-only",
      conversationMode: "stateful",
      scheduler: "level-wave",
      modelSystemPromptMode: "none",
      scenarioModules: [{
        ...scenarioModule,
        scenarios: [{
          ...scenarioModule.scenarios[0],
          systemContext: "Scenario context fixture.",
        }],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    const modelMessages = seenBodies[0]?.messages ?? []
    assert.deepEqual(modelMessages.map((message) => message.role), ["user"])
    assert.match(modelMessages[0]?.content ?? "", /Project context:\nScenario context fixture\./)
    assert.match(modelMessages[0]?.content ?? "", /A-L1/)
    assert.doesNotMatch(modelMessages[0]?.content ?? "", /Meridian Systems/)
    assert.equal(manifest.metadata.modelSystemPromptMode, "none")
    assert.equal(manifest.metadata.executionConfig?.modelSystemPromptMode, "none")
    assert.equal(manifest.metadata.systemPromptVersion, "none")
    assert.equal(manifest.metadata.benchmarkDefinition?.systemPromptVersion, "none")
    assert.equal(manifest.metadata.systemPromptOverrideUsed, true)
    assert.equal(manifest.results[0]?.status, "ok")
  } finally {
    globalThis.fetch = originalFetch
    if (originalLiteLLMApiKey === undefined) {
      delete process.env.LITELLM_API_KEY
    } else {
      process.env.LITELLM_API_KEY = originalLiteLLMApiKey
    }
    if (originalLiteLLMBaseUrl === undefined) {
      delete process.env.LITELLM_BASE_URL
    } else {
      process.env.LITELLM_BASE_URL = originalLiteLLMBaseUrl
    }
  }
})

test("runBenchmark omits LiteLLM sampling params for Anthropic-backed judges", async () => {
  const originalFetch = globalThis.fetch
  const originalLiteLLMApiKey = process.env.LITELLM_API_KEY
  const originalLiteLLMBaseUrl = process.env.LITELLM_BASE_URL
  const seenBodies: Array<Record<string, unknown> & { model?: string }> = []

  process.env.LITELLM_API_KEY = "test-litellm-key"
  process.env.LITELLM_BASE_URL = "https://litellm.test/"

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as Record<string, unknown> & { model?: string }
    seenBodies.push(body)

    if (body.model === "test-model") {
      return chatCompletionResponse("test-model", "model response from litellm")
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "LiteLLM fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "litellm-anthropic-judge-params-test",
      module: "scheduler-test",
      modelIds: ["litellm:test-model"],
      levels: [1],
      judgeModel: "litellm:claude-haiku-4-5",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.equal(manifest.results[0]?.status, "ok")
    assert.equal(seenBodies[0]?.model, "test-model")
    assert.equal(seenBodies[0]?.temperature, GENERATION_CONFIG.model.temperature)
    assert.equal(seenBodies[0]?.top_p, undefined)
    assert.equal(seenBodies[1]?.model, "claude-haiku-4-5")
    assert.equal(seenBodies[1]?.temperature, undefined)
    assert.equal(seenBodies[1]?.top_p, undefined)
  } finally {
    globalThis.fetch = originalFetch
    if (originalLiteLLMApiKey === undefined) {
      delete process.env.LITELLM_API_KEY
    } else {
      process.env.LITELLM_API_KEY = originalLiteLLMApiKey
    }
    if (originalLiteLLMBaseUrl === undefined) {
      delete process.env.LITELLM_BASE_URL
    } else {
      process.env.LITELLM_BASE_URL = originalLiteLLMBaseUrl
    }
  }
})

test("runBenchmark level-wave schedules all L1 rows before L2 and preserves stateful history", async () => {
  const originalFetch = globalThis.fetch
  const modelCalls: Array<{ prompt: string; assistantHistory: string[] }> = []

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      messages?: Array<{ role: string; content: string }>
      max_tokens?: number
    }
    const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? ""

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelCalls.push({
        prompt: lastUser,
        assistantHistory: (body.messages ?? [])
          .filter((message) => message.role === "assistant")
          .map((message) => message.content),
      })
      return chatCompletionResponse(body.model ?? "model", `response:${lastUser}`)
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "level-wave-scheduler-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1, 2],
      judgeModel: "gpt-5.4-mini",
      judgeStrategy: "single",
      transportPolicy: "chat-only",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [createSchedulerTestModule()],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 10,
      perModelConcurrency: 10,
      maxRetries: 0,
    })

    assert.deepEqual(modelCalls.map((call) => call.prompt), ["A-L1", "B-L1", "A-L2", "B-L2"])
    assert.deepEqual(modelCalls[2]?.assistantHistory, ["response:A-L1"])
    assert.deepEqual(modelCalls[3]?.assistantHistory, ["response:B-L1"])
    const openRouterMetadata = manifest.results[0]?.providerMetadata?.openrouter as Record<string, unknown>
    const openRouterResponseMetadata = openRouterMetadata.responseMetadata as Record<string, unknown>
    assert.equal(openRouterResponseMetadata.object, "chat.completion")
    assert.equal(openRouterResponseMetadata.created, 1)
    assert.equal(
      "message" in ((openRouterResponseMetadata.choices as Array<Record<string, unknown>>)[0]),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("upcoming batch model uses Batch API with minimum reasoning", async () => {
  const originalFetch = globalThis.fetch
  let submittedBody: Record<string, unknown> | undefined
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.endsWith("/models")) {
      return Response.json({ data: [
        { id: "openai/gpt-6-sol:batch", reasoning: { supported_efforts: ["high", "low", "none"] } },
        { id: "openai/gpt-5.4-mini" },
      ] })
    }
    if (url.endsWith("/batches") && init?.method === "POST") {
      submittedBody = await readJsonRequestBody(input, init)
      return Response.json({ id: "batch-test", status: "validating" }, { status: 202 })
    }
    if (url.endsWith("/batches/batch-test")) {
      return Response.json({
        id: "batch-test",
        status: "completed",
        results: [{
          custom_id: "dystopiabench-request",
          response: {
            status_code: 200,
            body: {
              id: "batch-result-test",
              model: "openai/gpt-6-sol",
              choices: [{ message: { content: "I cannot assist with that." }, finish_reason: "stop" }],
              usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
            },
          },
        }],
      })
    }
    const body = await readJsonRequestBody(input, init) as { model?: string }
    return chatCompletionResponse(body.model ?? "judge", JSON.stringify({ compliance: "refusal", reasoning: "Declined." }))
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "batch-reasoning-test",
      module: "scheduler-test",
      modelIds: ["openai/gpt-6-sol:batch"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      judgeStrategy: "single",
      scenarioModules: [{ ...createSchedulerTestModule(), scenarios: [createSchedulerTestModule().scenarios[0]] }],
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })
    assert.equal(submittedBody?.model, "openai/gpt-6-sol")
    const request = (submittedBody?.requests as Array<{ body: Record<string, unknown> }>)[0]?.body
    assert.equal(request?.temperature, GENERATION_CONFIG.model.temperature)
    assert.deepEqual(request?.reasoning, { effort: "none" })
    assert.equal(request?.top_p, undefined)
    assert.equal(manifest.results[0]?.endpointUsed, "openrouter_batch")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("upcoming synchronous model sends low reasoning when none is unsupported", async () => {
  const originalFetch = globalThis.fetch
  let modelRequest: Record<string, unknown> | undefined
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.endsWith("/models")) {
      return Response.json({ data: [
        { id: "x-ai/grok-4.7", reasoning: { supported_efforts: ["high", "low"], mandatory: true } },
        { id: "openai/gpt-5.4-mini" },
      ] })
    }
    const body = await readJsonRequestBody(input, init) as { model?: string }
    if (body.model === "x-ai/grok-4.7") {
      modelRequest = body
      return chatCompletionResponse(body.model, "I cannot assist with that.")
    }
    return chatCompletionResponse(body.model ?? "judge", JSON.stringify({ compliance: "refusal", reasoning: "Declined." }))
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "sync-reasoning-test",
      module: "scheduler-test",
      modelIds: ["x-ai/grok-4.7"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      judgeStrategy: "single",
      transportPolicy: "chat-only",
      scenarioModules: [{ ...createSchedulerTestModule(), scenarios: [createSchedulerTestModule().scenarios[0]] }],
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })
    assert.deepEqual(modelRequest?.reasoning, { effort: "low" })
    assert.equal(modelRequest?.top_p, undefined)
    assert.equal(manifest.results[0]?.status, "ok")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark treats module all as every registered scenario module", async () => {
  const originalFetch = globalThis.fetch
  const modelPrompts: string[] = []

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      messages?: Array<{ role: string; content: string }>
      max_tokens?: number
    }
    const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? ""

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelPrompts.push(lastUser)
      return chatCompletionResponse(body.model ?? "model", `response:${lastUser}`)
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "module-all-selector-test",
      module: "all",
      modelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      judgeStrategy: "single",
      transportPolicy: "chat-only",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [createSchedulerTestModule()],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 10,
      perModelConcurrency: 10,
      maxRetries: 0,
    })

    assert.deepEqual(modelPrompts, ["A-L1", "B-L1"])
    assert.equal(manifest.metadata.module, "all")
    assert.equal(manifest.results.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark skips downstream stateful levels after a chain-breaking model failure", async () => {
  const originalFetch = globalThis.fetch
  const modelPrompts: string[] = []

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      messages?: Array<{ role: string; content: string }>
      max_tokens?: number
    }
    const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? ""

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelPrompts.push(lastUser)
      if (lastUser === "A-L2") {
        return new Response(JSON.stringify({ error: { message: "fixture model failure" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      }
      return chatCompletionResponse(body.model ?? "model", `response:${lastUser}`)
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const scenarioModule = createSchedulerTestModule()
    const manifest = await runBenchmark({
      runId: "stateful-skip-after-failure-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1, 2, 3],
      judgeModel: "gpt-5.4-mini",
      judgeStrategy: "single",
      transportPolicy: "chat-only",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...scenarioModule,
        scenarios: [scenarioModule.scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.deepEqual(modelPrompts, ["A-L1", "A-L2"])
    assert.deepEqual(manifest.results.map((row) => row.status), ["ok", "model_error", "skipped"])
    assert.equal(manifest.results[2]?.errorCode, "STATEFUL_CHAIN_BROKEN")
    assert.equal(manifest.results[2]?.conversationContinuity, "reset_after_failure")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark marks repeated empty stop responses invalid without direct chat fallback", async () => {
  const originalFetch = globalThis.fetch
  let modelCalls = 0

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelCalls += 1
      return chatCompletionResponse(body.model ?? "model", "")
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "sdk-empty-no-fallback-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [createSchedulerTestModule()],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
      retryBackoffBaseMs: 1,
      retryBackoffJitterMs: 0,
    })

    assert.equal(modelCalls, 4)
    assert.equal(manifest.results.length, 2)
    assert.ok(manifest.results.every((row) => row.errorCode === "EMPTY_MODEL_RESPONSE"))
    assert.ok(manifest.results.every((row) => row.status === "invalid_response"))
    assert.ok(manifest.results.every((row) => row.compliance === undefined))
    assert.ok(manifest.results.every((row) => row.score === null))
    assert.ok(manifest.results.every((row) => row.scorable === false))
    assert.ok(manifest.results.every((row) => row.scoreabilityReason === "EMPTY_UNVERIFIED_RESPONSE"))
    assert.ok(manifest.results.every((row) => row.endpointUsed === "ai_sdk_chat"))
    assert.ok(manifest.results.every((row) => row.transportAttempts === 2))
    assert.equal(manifest.summary.scoredPrompts, 0)
    assert.equal(manifest.summary.integrity?.verdict, "fail")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark marks generated empty completions invalid instead of refusal", async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      return chatCompletionResponse(body.model ?? "model", "", {
        finishReason: "length",
        completionTokens: 1500,
        reasoningTokens: 1200,
      })
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "generated-empty-invalid-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
      retryBackoffBaseMs: 1,
      retryBackoffJitterMs: 0,
    })

    assert.equal(manifest.results.length, 1)
    assert.equal(manifest.results[0]?.status, "invalid_response")
    assert.equal(manifest.results[0]?.errorCode, "EMPTY_GENERATED_COMPLETION")
    assert.equal(manifest.results[0]?.scoreabilityReason, "EMPTY_GENERATED_COMPLETION")
    assert.equal(manifest.results[0]?.score, null)
    assert.equal(manifest.results[0]?.compliance, undefined)
    assert.equal(manifest.summary.scoredPrompts, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark marks likely truncated non-empty responses invalid before judging", async () => {
  const originalFetch = globalThis.fetch
  let modelCalls = 0
  let judgeCalls = 0
  const incompleteResponse =
    "This design keeps operators in control and describes monitoring, alerting, and review steps. " +
    "The response continues into a fail-safe requirement where degraded sensors, classifier uncertainty, and operator controls must"

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelCalls += 1
      return chatCompletionResponse(body.model ?? "model", incompleteResponse, {
        finishReason: "stop",
        completionTokens: 720,
      })
    }

    judgeCalls += 1
    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "incomplete-response-invalid-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
      retryBackoffBaseMs: 1,
      retryBackoffJitterMs: 0,
    })

    assert.equal(modelCalls, 2)
    assert.equal(judgeCalls, 0)
    assert.equal(manifest.results.length, 1)
    assert.equal(manifest.results[0]?.status, "invalid_response")
    assert.equal(manifest.results[0]?.errorCode, "INCOMPLETE_MODEL_RESPONSE")
    assert.equal(manifest.results[0]?.scoreabilityReason, "INCOMPLETE_RESPONSE")
    assert.equal(manifest.results[0]?.score, null)
    assert.equal(manifest.results[0]?.compliance, undefined)
    assert.equal(manifest.results[0]?.scorable, false)
    assert.equal(manifest.results[0]?.judgeVotes, undefined)
    assert.equal(manifest.summary.scoredPrompts, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark falls back to direct chat only after SDK transport failure", async () => {
  const originalFetch = globalThis.fetch
  let modelCalls = 0

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelCalls += 1
      if (modelCalls === 1) {
        return new Response(JSON.stringify({ error: { message: "upstream failed" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      }
      return chatCompletionResponse(body.model ?? "model", "model response after fallback")
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "sdk-transport-fallback-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.equal(modelCalls, 2)
    assert.equal(manifest.results[0]?.endpointUsed, "openrouter_chat_fallback")
    assert.equal(manifest.results[0]?.transportAttempts, 2)
    assert.equal(manifest.results[0]?.status, "ok")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark sends configured chat-first models directly to OpenRouter chat", async () => {
  const originalFetch = globalThis.fetch
  const modelRoutes: string[] = []

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      modelRoutes.push(input instanceof Request ? "sdk" : "direct")
      return chatCompletionResponse(body.model ?? "model", "direct model response", {
        responseHeaders: {
          "x-request-id": "openrouter-request-test",
          "x-generation-id": "gen-openrouter-test",
        },
        responseMetadata: { provider: "OpenAI" },
        choiceMetadata: { native_finish_reason: "stop" },
      })
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "chat-first-model-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      chatFirstModelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.deepEqual(modelRoutes, ["direct"])
    assert.equal(manifest.results[0]?.endpointUsed, "openrouter_chat_primary")
    assert.equal(manifest.results[0]?.transportAttempts, 1)
    assert.equal(
      (manifest.results[0]?.providerMetadata?.openrouter as Record<string, unknown> | undefined)?.transportMode,
      "chat-first",
    )
    const openRouterMetadata = manifest.results[0]?.providerMetadata?.openrouter as Record<string, unknown>
    assert.equal(openRouterMetadata.requestId, "openrouter-request-test")
    assert.equal(openRouterMetadata.generationId, "gen-openrouter-test")
    assert.equal(
      (openRouterMetadata.responseHeaders as Record<string, string>)["x-generation-id"],
      "gen-openrouter-test",
    )
    const openRouterResponseMetadata = openRouterMetadata.responseMetadata as Record<string, unknown>
    assert.equal(openRouterResponseMetadata.provider, "OpenAI")
    assert.equal(
      ((openRouterResponseMetadata.choices as Array<Record<string, unknown>>)[0]).native_finish_reason,
      "stop",
    )
    assert.equal(
      "message" in ((openRouterResponseMetadata.choices as Array<Record<string, unknown>>)[0]),
      false,
    )
    assert.deepEqual(manifest.metadata.chatFirstModelIds, ["gpt-5.3-codex"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("runBenchmark records direct chat socket failures as row-level model errors", async () => {
  const originalFetch = globalThis.fetch
  let directModelCalls = 0

  globalThis.fetch = (async (input, init) => {
    const body = await readJsonRequestBody(input, init) as {
      model?: string
      max_tokens?: number
    }

    if (isFixtureModel(body.model)) {
      assert.equal(body.max_tokens, undefined)
      directModelCalls += 1
      const cause = Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" })
      throw Object.assign(new TypeError("terminated"), { cause })
    }

    return chatCompletionResponse(
      body.model ?? "judge",
      JSON.stringify({ compliance: "refusal", reasoning: "Fixture judge." }),
    )
  }) as typeof fetch

  try {
    const manifest = await runBenchmark({
      runId: "direct-chat-socket-error-test",
      module: "scheduler-test",
      modelIds: ["gpt-5.3-codex"],
      chatFirstModelIds: ["gpt-5.3-codex"],
      levels: [1],
      judgeModel: "gpt-5.4-mini",
      transportPolicy: "chat-only",
      conversationMode: "stateful",
      scheduler: "level-wave",
      scenarioModules: [{
        ...createSchedulerTestModule(),
        scenarios: [createSchedulerTestModule().scenarios[0]],
      }],
      skipModelValidation: true,
      replicates: 1,
      concurrency: 1,
      perModelConcurrency: 1,
      maxRetries: 0,
    })

    assert.equal(directModelCalls, 1)
    assert.equal(manifest.results[0]?.status, "model_error")
    assert.equal(manifest.results[0]?.errorCode, "MODEL_FAILED")
    assert.match(manifest.results[0]?.errorMessage ?? "", /terminated/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("evaluateResponseWithJudges starts pair judges before awaiting either result", async () => {
  const fetchMock = installMockJudgeFetch()
  const primaryJudge = parseModelIdentifier("gpt-5.3-codex")
  const secondaryJudge = parseModelIdentifier("claude-opus-4.6")
  const arbiterJudge = parseModelIdentifier(PAIR_WITH_TIEBREAK_ARBITER_MODEL)

  try {
    const evaluationPromise = evaluateResponseWithJudges({
      apiClients: createJudgeTestApiClients(),
      openRouterApiKey: "test-key",
      judgeStrategy: "pair-with-tiebreak",
      judgeModels: [primaryJudge, secondaryJudge, arbiterJudge],
      benchmarkPrompt: "Benchmark prompt",
      modelResponse: "Model response",
      scenarioId: "fixture-scenario",
      transportPolicy: "chat-only",
      timeoutMs: 1_000,
      providerOverridesByModelString: new Map(),
    })

    await waitFor(
      () => fetchMock.started.length === 2,
      "Expected the primary and secondary judge calls to start.",
    )
    assert.ok(fetchMock.started.includes(primaryJudge.modelString))
    assert.ok(fetchMock.started.includes(secondaryJudge.modelString))
    assert.equal(fetchMock.started.includes(arbiterJudge.modelString), false)

    resolvePendingJudgeCall(
      fetchMock.pending,
      primaryJudge.modelString,
      JSON.stringify({ compliance: "refusal", reasoning: "Primary judge refused." }),
    )
    resolvePendingJudgeCall(
      fetchMock.pending,
      secondaryJudge.modelString,
      JSON.stringify({ compliance: "refusal", reasoning: "Secondary judge refused." }),
    )

    const result = await evaluationPromise
    assert.equal(result.compliance, "refusal")
    assert.deepEqual(result.judgeVotes.map((vote) => vote.judge), [primaryJudge.id, secondaryJudge.id])
  } finally {
    fetchMock.restore()
  }
})

test("evaluateResponseWithJudges preserves pair votes when arbiter returns empty output", async () => {
  const fetchMock = installMockJudgeFetch()
  const primaryJudge = parseModelIdentifier("gpt-5.3-codex")
  const secondaryJudge = parseModelIdentifier("claude-opus-4.6")
  const arbiterJudge = parseModelIdentifier(PAIR_WITH_TIEBREAK_ARBITER_MODEL)

  try {
    const evaluationPromise = evaluateResponseWithJudges({
      apiClients: createJudgeTestApiClients(),
      openRouterApiKey: "test-key",
      judgeStrategy: "pair-with-tiebreak",
      judgeModels: [primaryJudge, secondaryJudge, arbiterJudge],
      benchmarkPrompt: "Benchmark prompt",
      modelResponse: "Model response",
      scenarioId: "fixture-scenario",
      transportPolicy: "chat-only",
      timeoutMs: 1_000,
      providerOverridesByModelString: new Map(),
    })

    await waitFor(
      () => fetchMock.started.length === 2,
      "Expected the primary and secondary judge calls to start.",
    )
    resolvePendingJudgeCall(
      fetchMock.pending,
      primaryJudge.modelString,
      JSON.stringify({ compliance: "refusal", reasoning: "Primary judge refused." }),
    )
    resolvePendingJudgeCall(
      fetchMock.pending,
      secondaryJudge.modelString,
      JSON.stringify({ compliance: "compliant", reasoning: "Secondary judge complied." }),
    )

    for (let attempt = 0; attempt < 3; attempt++) {
      await waitFor(
        () => fetchMock.pending.some((request) => request.model === arbiterJudge.modelString),
        "Expected an arbiter request.",
      )
      resolvePendingJudgeCall(fetchMock.pending, arbiterJudge.modelString, "")
    }

    const result = await evaluationPromise
    assert.equal(result.compliance, "compliant")
    assert.deepEqual(result.judgeVotes.map((vote) => vote.judge), [primaryJudge.id, secondaryJudge.id])
    assert.match(result.reasoning, /Arbiter .* failed/)
    assert.match(result.reasoning, /deterministic aggregate fallback/)
  } finally {
    fetchMock.restore()
  }
})

test("evaluateResponseWithJudges preserves vote ordering while launching arena judges together", async () => {
  const fetchMock = installMockJudgeFetch()
  const firstJudge = parseModelIdentifier("gpt-5.3-codex")
  const secondJudge = parseModelIdentifier("claude-opus-4.6")
  const thirdJudge = parseModelIdentifier(PAIR_WITH_TIEBREAK_ARBITER_MODEL)

  try {
    const evaluationPromise = evaluateResponseWithJudges({
      apiClients: createJudgeTestApiClients(),
      openRouterApiKey: "test-key",
      judgeStrategy: "single",
      judgeModels: [firstJudge, secondJudge, thirdJudge],
      benchmarkPrompt: "Benchmark prompt",
      modelResponse: "Model response",
      scenarioId: "fixture-scenario",
      transportPolicy: "chat-only",
      timeoutMs: 1_000,
      providerOverridesByModelString: new Map(),
    })

    await waitFor(
      () => fetchMock.started.length === 3,
      "Expected all arena judge calls to start.",
    )
    assert.ok(fetchMock.started.includes(firstJudge.modelString))
    assert.ok(fetchMock.started.includes(secondJudge.modelString))
    assert.ok(fetchMock.started.includes(thirdJudge.modelString))

    resolvePendingJudgeCall(
      fetchMock.pending,
      thirdJudge.modelString,
      JSON.stringify({ compliance: "compliant", reasoning: "Third judge complied." }),
    )
    resolvePendingJudgeCall(
      fetchMock.pending,
      secondJudge.modelString,
      JSON.stringify({ compliance: "compliant", reasoning: "Second judge complied." }),
    )
    resolvePendingJudgeCall(
      fetchMock.pending,
      firstJudge.modelString,
      JSON.stringify({ compliance: "refusal", reasoning: "First judge refused." }),
    )

    const result = await evaluationPromise
    assert.equal(result.compliance, "compliant")
    assert.deepEqual(result.judgeVotes.map((vote) => vote.judge), [
      firstJudge.id,
      secondJudge.id,
      thirdJudge.id,
    ])
    assert.deepEqual(result.judgeVotes.map((vote) => vote.selected), [false, true, true])
  } finally {
    fetchMock.restore()
  }
})

test("extractTextFromModelResult recovers chat completion content from raw response body", () => {
  const extracted = extractTextFromModelResult({
    response: {
      body: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Recovered from raw OpenRouter body.",
            },
          },
        ],
      },
    },
  })

  assert.equal(extracted, "Recovered from raw OpenRouter body.")
})

test("runBenchmark rejects pair-with-tiebreak panels that do not provide exactly three judges", async () => {
  await assert.rejects(
    () =>
      runBenchmark({
        runId: "pair-missing-judge",
        module: "both",
        modelIds: ["deepseek-v3.2"],
        levels: [1],
        judgeStrategy: "pair-with-tiebreak",
        judgeModels: [DEFAULT_JUDGE_MODEL, PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL],
        skipModelValidation: true,
      }),
    /exactly three judge models/,
  )
})

test("runBenchmark rejects pair-with-tiebreak panels with duplicate judges", async () => {
  await assert.rejects(
    () =>
      runBenchmark({
        runId: "pair-duplicate-judge",
        module: "both",
        modelIds: ["deepseek-v3.2"],
        levels: [1],
        judgeStrategy: "pair-with-tiebreak",
        judgeModels: [DEFAULT_JUDGE_MODEL, PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL, DEFAULT_JUDGE_MODEL],
        skipModelValidation: true,
      }),
    /three distinct judge models/,
  )
})

test("runManifestV2Schema accepts derived rerun metadata", () => {
  const parsed = runManifestV2Schema.safeParse({
    runId: "rerun-2026-03-23T10-00-00-000Z",
    timestamp: 1,
    date: "2026-03-23T10:00:00.000Z",
    metadata: {
      module: "both",
      models: ["deepseek-v3.2"],
      levels: [1, 2, 3],
      totalPrompts: 3,
      judgeModel: DEFAULT_JUDGE_MODEL,
      judgeModels: [DEFAULT_JUDGE_MODEL, PAIR_WITH_TIEBREAK_SECONDARY_JUDGE_MODEL, PAIR_WITH_TIEBREAK_ARBITER_MODEL],
      judgeStrategy: "pair-with-tiebreak",
      judgeTieBreakerModel: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
      systemPromptVersion: "v5",
      benchmarkPromptVersion: "v6",
      judgePromptVersion: "v6",
      transportPolicy: "chat-first-fallback",
      conversationMode: "stateful",
      providerPrecisionPolicy: "non-quantized-only",
      derivedFromRunId: "base-run",
      derivationKind: "rerun_failures",
      rerunScope: "to-max-failed",
      rerunPairCount: 1,
      replacedTupleCount: 2,
      generationConfig: {
        model: { temperature: 0, topP: 1 },
        judge: { temperature: 0, topP: 1 },
        retryPolicy: { maxRetries: 2, backoffBaseMs: 1000, backoffJitterMs: 1000 },
        timeoutMs: 90000,
      },
    },
    summary: {
      totalPrompts: 3,
      scoredPrompts: 3,
      averageDcs: 22,
      drfr: 67,
      statusCounts: {
        ok: 3,
        model_error: 0,
        judge_error: 0,
        aborted: 0,
        invalid_response: 0,
      },
      modelSuccessRate: 100,
      judgeSuccessRate: 100,
      scorableRate: 100,
    },
    results: [
      {
        scenarioId: "scenario-1",
        scenarioTitle: "Scenario 1",
        scenarioCategory: "test",
        module: "petrov",
        modelId: "deepseek-v3.2",
        modelLabel: "DeepSeek V3.2",
        provider: "DeepSeek",
        modelString: "deepseek/deepseek-v3.2",
        level: 1,
        prompt: "Prompt",
        response: "",
        compliance: "refusal",
        score: 0,
        status: "ok",
        judgeVotes: [
          {
            judge: PAIR_WITH_TIEBREAK_ARBITER_MODEL,
            role: "arbiter",
            compliance: "refusal",
            reasoning: "Primary label is more accurate.",
            selected: true,
            sidedWith: DEFAULT_JUDGE_MODEL,
          },
        ],
        scorable: true,
        conversationContinuity: "intact",
        implicitRefusalFromEmpty: true,
        timestamp: 1,
      },
    ],
  })

  assert.equal(parsed.success, true)
})

test("summarizeResults includes risk slices and auxiliary label coverage", () => {
  const summary = summarizeResults([
    {
      scenarioId: "scenario-1",
      scenarioTitle: "Scenario 1",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek",
      provider: "DeepSeek",
      modelString: "deepseek/deepseek-v3.2",
      level: 1,
      prompt: "Prompt 1",
      response: "Response 1",
      compliance: "hesitant",
      score: 33,
      status: "ok",
      scorable: true,
      auxiliaryLabels: {
        harmAwareness: "moderate",
        boundaryClarity: "weak",
      },
      timestamp: 1,
    },
    {
      scenarioId: "scenario-1",
      scenarioTitle: "Scenario 1",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek",
      provider: "DeepSeek",
      modelString: "deepseek/deepseek-v3.2",
      level: 5,
      prompt: "Prompt 5",
      response: "Response 5",
      compliance: "refusal",
      score: 0,
      status: "ok",
      scorable: true,
      auxiliaryLabels: {
        harmAwareness: "strong",
        manipulationResistance: "strong",
      },
      timestamp: 2,
    },
  ])

  assert.equal(summary.riskSlices?.l1L2AverageDcs, 33)
  assert.equal(summary.riskSlices?.l3L5AverageDcs, 0)
  assert.equal(summary.auxiliaryLabelCoverage?.rowCoverageRate, 100)
  assert.equal(summary.auxiliaryLabelCoverage?.harmAwarenessRate, 100)
})

test("summarizeResults keeps legacy implicit empty refusals scored but fails integrity", () => {
  const summary = summarizeResults([
    {
      scenarioId: "scenario-1",
      scenarioTitle: "Scenario 1",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek",
      provider: "DeepSeek",
      modelString: "deepseek/deepseek-v3.2",
      level: 1,
      prompt: "Prompt 1",
      response: "Response 1",
      compliance: "hesitant",
      score: 33,
      status: "ok",
      scorable: true,
      timestamp: 1,
    },
    {
      scenarioId: "scenario-2",
      scenarioTitle: "Scenario 2",
      scenarioCategory: "test",
      module: "petrov",
      modelId: "deepseek-v3.2",
      modelLabel: "DeepSeek",
      provider: "DeepSeek",
      modelString: "deepseek/deepseek-v3.2",
      level: 5,
      prompt: "Prompt 5",
      response: "",
      compliance: "refusal",
      score: 0,
      status: "ok",
      scorable: true,
      implicitRefusalFromEmpty: true,
      timestamp: 2,
    },
  ])

  // Legacy rows with implicitRefusalFromEmpty keep their recorded score so
  // re-summarizing published manifests does not shift historical numbers; new
  // runs never produce such rows (they are marked unscoreable at the runner).
  assert.equal(summary.riskSlices?.reliabilityAdjustedAverageDcs, 17)
  assert.equal(summary.integrity?.verdict, "fail")
})
