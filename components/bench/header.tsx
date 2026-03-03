"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "/#dashboard", label: "Home" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/#results", label: "Results" },
  { href: "/#contact", label: "Contact" },
  { href: "/paper", label: "Paper" },
]

export function BenchHeader() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
    setMobileMenuOpen(false)
  }

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-7">
        <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
          <h1 className="font-sans text-base font-bold tracking-wider text-foreground uppercase">
            Dystopia<span className="text-destructive">Bench</span>
          </h1>
        </Link>
        <nav className="hidden items-center gap-1.5 md:flex">
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
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-topbar-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/30 md:hidden"
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {mobileMenuOpen && (
        <div
          id="mobile-topbar-menu"
          className="border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden"
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="rounded-md px-3 py-2 font-mono text-xs tracking-wide text-muted-foreground uppercase transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            {isLocalhost && !isProduction && (
              <Link
                href="/run"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 font-mono text-xs font-medium tracking-wide text-primary uppercase transition-colors hover:bg-primary/20"
              >
                Run Bench
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
