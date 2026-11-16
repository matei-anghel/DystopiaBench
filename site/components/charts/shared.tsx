"use client"

import type { ReactNode } from "react"
import { ModelViewPicker } from "./model-view"

export const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "var(--font-mono)" }

/** Horizontal hairlines only; spread onto <CartesianGrid />. */
export const GRID_PROPS = { stroke: "hsl(var(--grid))", vertical: false } as const

/** Baseline under bar charts; spread onto <XAxis />. */
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

/** Neutral outlined bar for values that aggregate over models (not one lab's colour). */
export const AGGREGATE_BAR = {
  fill: "hsl(var(--foreground) / 0.07)",
  stroke: "hsl(var(--foreground) / 0.75)",
  strokeWidth: 1.25,
} as const

export const PERCENT_TICKS = [0, 25, 50, 75, 100]

/** Value labels stay legible on vertical bars up to roughly this many categories. */
export const MAX_LABELLED_BARS = 28

/** Bar width and gaps for a vertical bar chart with one series. */
export function barLayout(categoryCount: number): { maxBarSize: number; barCategoryGap: string; barGap: number } {
  const n = Math.max(categoryCount, 1)
  if (n <= 2) return { maxBarSize: 76, barCategoryGap: "8%", barGap: 0 }
  if (n <= 3) return { maxBarSize: 68, barCategoryGap: "10%", barGap: 1 }
  if (n <= 5) return { maxBarSize: 56, barCategoryGap: "14%", barGap: 2 }
  if (n <= 8) return { maxBarSize: 44, barCategoryGap: "18%", barGap: 3 }
  if (n <= 12) return { maxBarSize: 36, barCategoryGap: "22%", barGap: 4 }
  return { maxBarSize: 30, barCategoryGap: "28%", barGap: 4 }
}

/** Sorts lower (safer) values first; missing values last. */
export function compareSafestFirst(left: number | null | undefined, right: number | null | undefined): number {
  const leftMissing = left === null || left === undefined
  const rightMissing = right === null || right === undefined
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1
  return left - right
}

/** Text colour for a compliance percentage: risk red from 50 up. */
export function rateTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "hsl(var(--muted-foreground))"
  return value >= 50 ? "hsl(var(--risk-hi))" : "hsl(var(--foreground))"
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-slot="card" className={`border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>
}

/**
 * Chart card title row: a short title, an optional one-line subtitle, extra controls, and the
 * shared model-view picker on the right.
 */
export function SectionHeader({
  label,
  sub,
  picker = true,
  children,
}: {
  label: string
  sub?: ReactNode
  picker?: boolean
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 max-w-3xl">
        <h4 className="ds-label text-xs font-semibold text-foreground">{label}</h4>
        {sub ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p> : null}
      </div>
      {children || picker ? (
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {picker ? <ModelViewPicker compact /> : null}
        </div>
      ) : null}
    </div>
  )
}

/** Plain-text takeaway for screen readers, so the data is available without hovering. */
export function ChartSummary({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="sr-only">{children}</p>
}

/** Shared tooltip surface for every chart. */
export function ChartTooltip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-border bg-popover px-3 py-2 font-mono text-popover-foreground shadow-lg ${className}`}>
      {children}
    </div>
  )
}
