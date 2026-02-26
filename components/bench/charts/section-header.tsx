export function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">{label}</p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
