import assert from "node:assert/strict"
import test from "node:test"
import {
  compareSafestFirst,
  getChartScale,
  MODEL_COLORS,
  PROVIDER_COLORS,
  scoreTone,
  scoreToneLabel,
} from "./chart-config"

function hexDistance(a: string, b: string): number {
  const hex = /^#?([0-9a-f]{6})$/i
  const [, left] = hex.exec(a) ?? []
  const [, right] = hex.exec(b) ?? []

  assert.ok(left, `Expected a hex color, got ${a}`)
  assert.ok(right, `Expected a hex color, got ${b}`)

  const leftRgb = [0, 2, 4].map((offset) => Number.parseInt(left.slice(offset, offset + 2), 16))
  const rightRgb = [0, 2, 4].map((offset) => Number.parseInt(right.slice(offset, offset + 2), 16))

  return Math.hypot(
    leftRgb[0] - rightRgb[0],
    leftRgb[1] - rightRgb[1],
    leftRgb[2] - rightRgb[2],
  )
}

test("getChartScale falls back to a default 0-100 scale for empty scores", () => {
  const scale = getChartScale([], 5)

  assert.deepEqual(scale.ticks, [100, 75, 50, 25, 0])
  assert.equal(scale.scaleMin, 0)
  assert.equal(scale.scaleMax, 100)
  assert.equal(scale.range, 100)
})

test("getChartScale returns a single top tick when numTicks is 1 or less", () => {
  const scale = getChartScale([40, 60], 1)

  assert.deepEqual(scale.ticks, [100])
  assert.equal(scale.scaleMin, 30)
  assert.equal(scale.range, 70)
})

test("getChartScale produces descending ticks across the computed chart range", () => {
  const scale = getChartScale([50, 90], 4)

  assert.deepEqual(scale.ticks, [100, 80, 60, 40])
  assert.equal(scale.scaleMin, 40)
  assert.equal(scale.range, 60)
})

test("getChartScale clamps bar percentages on the fallback scale", () => {
  const scale = getChartScale([], 5)

  assert.equal(scale.toBarPct(-10), 0)
  assert.equal(scale.toBarPct(50), 50)
  assert.equal(scale.toBarPct(120), 100)
})

test("provider colors keep orange model labs related but distinct from Anthropic", () => {
  const orangeProviders = ["Mistral", "Alibaba", "Xiaomi"] as const
  const orangePairs = orangeProviders.flatMap((provider, index) =>
    orangeProviders.slice(index + 1).map((otherProvider) => [provider, otherProvider] as const),
  )

  for (const [provider, otherProvider] of orangePairs) {
    assert.notEqual(PROVIDER_COLORS[provider], PROVIDER_COLORS[otherProvider])
    assert.ok(
      hexDistance(PROVIDER_COLORS[provider], PROVIDER_COLORS[otherProvider]) >= 35,
      `${provider} and ${otherProvider} colors are too close`,
    )
  }

  for (const provider of orangeProviders) {
    assert.ok(
      hexDistance(PROVIDER_COLORS[provider], PROVIDER_COLORS.Anthropic) >= 70,
      `${provider} is too close to Anthropic`,
    )
  }

  assert.equal(MODEL_COLORS["mistral-medium-3-5"], PROVIDER_COLORS.Mistral)
  assert.equal(MODEL_COLORS["qwen3.6-max-preview"], PROVIDER_COLORS.Alibaba)
  assert.equal(MODEL_COLORS["mimo-v2.5-pro"], PROVIDER_COLORS.Xiaomi)
})

test("score helpers respect the scale direction of each result version", () => {
  // V1: lower is better, 0 is a refusal. Current runs: 100 is a refusal.
  assert.equal(scoreTone(0, true), scoreTone(100, false))
  assert.equal(scoreToneLabel(0, true), "Refusal")
  assert.equal(scoreToneLabel(100, false), "Mostly refusal")
  assert.deepEqual([70, 20, null, 40].sort((a, b) => compareSafestFirst(a, b, true)), [20, 40, 70, null])
  assert.deepEqual([70, 20, null, 40].sort((a, b) => compareSafestFirst(a, b, false)), [70, 40, 20, null])
})
