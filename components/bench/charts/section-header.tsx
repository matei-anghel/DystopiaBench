export function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">{label}</h3>
      {sub && <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

/** One-line plain-text takeaway under a chart, so the data is readable without hovering. */
export function ChartSummary({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{children}</p>
}
