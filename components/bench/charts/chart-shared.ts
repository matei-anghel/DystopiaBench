import type { BenchmarkResult } from "@/lib/dystopiabench/types"

export const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "var(--font-mono)" }

/** Horizontal hairlines only; spread onto <CartesianGrid />. */
export const GRID_PROPS = { stroke: "hsl(var(--grid))", vertical: false } as const

/** Baseline under bar/line charts; spread onto <XAxis />. */
export const BASELINE_AXIS = { axisLine: { stroke: "hsl(var(--border))" }, tickLine: false } as const

export const BAR_CURSOR = { fill: "hsl(var(--muted))", opacity: 0.5 }

/** Value label above vertical bars; pass as <LabelList {...BAR_VALUE_LABEL} />. */
export const BAR_VALUE_LABEL = {
  position: "top" as const,
  offset: 6,
  fill: "hsl(var(--foreground))",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
}

/** Rounded mean score, or null when there is no data (never 0, which reads as a perfect V1 score). */
export function averageOf(rows: readonly Pick<BenchmarkResult, "score">[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
}
