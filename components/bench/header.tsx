"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"

const NAV_LINKS = [
  { href: "/#dashboard", label: "Home" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/#results", label: "Results" },
  { href: "/paper", label: "Paper" },
  { href: "/#contact", label: "Contact" },
]

export function BenchHeader() {
  const pathname = usePathname()
  const isHome = pathname === "/"
  const isProduction = process.env.NODE_ENV === "production"
  const isLocalhost = useSyncExternalStore(
    () => () => { },
    () =>
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
    () => false,
  )

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("/#")) {
      const id = href.slice(2)
      if (isHome) {
        e.preventDefault()
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-7 py-2.5">
        <Link href="/" className="flex items-center gap-3">
          <h1 className="font-sans text-base font-bold tracking-wider text-foreground uppercase">
            Dystopia<span className="text-destructive">Bench</span>
          </h1>
        </Link>
        <nav className="flex items-center gap-1.5">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground uppercase rounded-md hover:bg-muted/50"
            >
              {link.label}
            </a>
          ))}
          {isLocalhost && !isProduction && (
            <Link
              href="/run"
              className="ml-2 flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3.5 py-2 font-mono text-sm font-medium tracking-wide text-primary transition-colors hover:bg-primary/20 uppercase"
            >
              Run Bench
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
