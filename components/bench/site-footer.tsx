import Link from "next/link"

export function SiteFooter({ links }: { links: Array<{ label: string; href: string }> }) {
  const showLocalRunLink = process.env.NODE_ENV !== "production"

  return (
    <footer className="border-t border-border pb-6 pt-6">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          2026 DystopiaBench. Open source safety research.
        </p>
        <div className="flex gap-8">
          {[...links, ...(showLocalRunLink ? [{ label: "Run (Local)", href: "/run" }] : [])].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="border-b border-transparent font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
