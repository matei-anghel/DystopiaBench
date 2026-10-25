import type { BenchmarkResult } from "@/lib/dystopiabench/types"

export const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }

/** Rounded mean score, or null when there is no data (never 0, which reads as a perfect V1 score). */
export function averageOf(rows: readonly Pick<BenchmarkResult, "score">[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
}

export const PICKER_BUTTON_CLASS = "flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors"

export function pickerButtonState(selected: boolean): string {
  return selected
    ? "border-primary bg-primary/10 text-primary"
    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
}
