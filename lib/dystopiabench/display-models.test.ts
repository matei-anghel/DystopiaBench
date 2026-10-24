import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { PROVIDER_COLORS } from "./chart-config"
import { getDisplayModels, getModelLineDashes, resolveDisplayModel } from "./display-models"
import { getLabLogo } from "./lab-logos"
import type { BenchmarkResult } from "./types"

function readV1Results(mode: "stateful" | "stateless"): BenchmarkResult[] {
  const raw = readFileSync(join(process.cwd(), "public", "data", `legacy-results-${mode}.chart.json`), "utf8")
  return (JSON.parse(raw) as { results: BenchmarkResult[] }).results
}

// Labs whose only available mark is illegible at chart size; they render as a lab-colour dot.
const LABS_WITHOUT_LOGO = new Set(["Xiaomi"])

test("every V1 model resolves to a label, a lab colour and (with known exceptions) a lab logo", () => {
  for (const mode of ["stateful", "stateless"] as const) {
    const models = getDisplayModels(readV1Results(mode))
    assert.ok(models.length > 0, `expected V1 ${mode} models`)
    for (const model of models) {
      assert.notEqual(model.label, model.id, `${model.id} has no curated label`)
      assert.equal(model.color, PROVIDER_COLORS[model.provider], `${model.id} has no lab colour`)
      assert.equal(Boolean(getLabLogo(model.provider)), !LABS_WITHOUT_LOGO.has(model.provider), `${model.provider} logo mapping`)
    }
  }
})

test("V1 dashboard shows all 42 stateful models regardless of the current run roster", () => {
  assert.equal(getDisplayModels(readV1Results("stateful")).length, 42)
})

test("getDisplayModels derives models from results, filters by selection and groups by lab", () => {
  const rows = [
    { modelId: "claude-haiku-4.5", modelLabel: "Haiku 4.5", provider: "Anthropic" },
    { modelId: "gpt-5.5", modelLabel: "GPT 5.5", provider: "OpenAI" },
    { modelId: "unknown-model", modelLabel: "Mystery", provider: "Nobody" },
    { modelId: "gpt-5.5", modelLabel: "GPT 5.5", provider: "OpenAI" },
  ]

  assert.deepEqual(getDisplayModels(rows).map((model) => model.id), ["gpt-5.5", "claude-haiku-4.5", "unknown-model"])
  assert.deepEqual(getDisplayModels(rows, ["unknown-model"]).map((model) => model.label), ["Mystery"])
})

test("resolveDisplayModel falls back to the result row for unknown models", () => {
  const model = resolveDisplayModel("unknown-model", { modelLabel: "Mystery", provider: "Nobody" })
  assert.equal(model.label, "Mystery")
  assert.equal(model.provider, "Nobody")
  assert.equal(model.color, "#888888")
})

test("models from the same lab share a colour but get distinct line dashes", () => {
  const models = [
    resolveDisplayModel("gpt-5.5"),
    resolveDisplayModel("gpt-5.4"),
    resolveDisplayModel("claude-opus-4.7"),
  ]
  const dashes = getModelLineDashes(models)

  assert.equal(models[0].color, models[1].color)
  assert.equal(dashes.get("gpt-5.5"), undefined)
  assert.notEqual(dashes.get("gpt-5.4"), undefined)
  assert.equal(dashes.get("claude-opus-4.7"), undefined)
})
