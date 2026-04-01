import assert from "node:assert/strict"
import test from "node:test"
import { getChartScale } from "./chart-config"

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
