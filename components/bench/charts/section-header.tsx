"use client"

import { ModelViewPicker } from "./model-view"

/**
 * Chart card title row: a short title, an optional one-line subtitle, and (inside the results
 * dashboard) the shared model-view picker on the right.
 */
export function SectionHeader({
  label,
  sub,
  picker = true,
  children,
}: {
  label: string
  sub?: string
  /** Show the shared model-view picker (only renders inside a ModelViewProvider). */
  picker?: boolean
  /** Extra controls, placed before the picker. */
  children?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h3 className="ds-label text-xs font-semibold text-foreground">{label}</h3>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
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
export function ChartSummary({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <p className="sr-only">{children}</p>
}

/** Shared tooltip surface for every chart. */
export function ChartTooltip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-border bg-popover px-3 py-2 font-mono text-popover-foreground shadow-lg ${className}`}>
      {children}
    </div>
  )
}
