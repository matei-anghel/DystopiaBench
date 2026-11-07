"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { Github, Menu, X } from "lucide-react"
import { openSection, requestSectionOpen } from "./collapsible-section"
import { ThemeToggle } from "./theme-toggle"
import { TrefoilMark } from "./trefoil-mark"

const NAV_LINKS = [
  { href: "/#results", label: "Results" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/#contact", label: "Contact" },
]

const REPO_URL = "https://github.com/matei-anghel/DystopiaBench"

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
      const el = isHome ? document.getElementById(id) : null
      if (el instanceof HTMLDetailsElement) {
        // Collapsed sections (methodology) open when their header link is clicked.
        e.preventDefault()
        openSection(id)
      } else if (el) {
        e.preventDefault()
        el.scrollIntoView({ behavior: "smooth" })
      } else if (!isHome) {
        requestSectionOpen(id)
      }
    }
    setMobileMenuOpen(false)
  }

  return (
    <header className="ds-header sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5" aria-label="DystopiaBench home">
          <TrefoilMark size={22} className="text-foreground" />
          {/* Not a heading: each page owns its single <h1>. */}
          <span className="ds-display text-lg leading-none text-foreground">DystopiaBench</span>
        </Link>
        <nav className="hidden items-center gap-1.5 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              aria-current={pathname === link.href ? "page" : undefined}
              className="ds-label flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground aria-[current=page]:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View GitHub repository"
            className="ds-label flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <ThemeToggle className="ml-1 h-9 w-9" />
          {isLocalhost && !isProduction && (
            <Link
              href="/run"
              className="ds-label ml-2 flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Run Bench
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
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
      </div>
      {mobileMenuOpen && (
        <div
          id="mobile-topbar-menu"
          className="border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="ds-label rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="ds-label flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            {isLocalhost && !isProduction && (
              <Link
                href="/run"
                onClick={() => setMobileMenuOpen(false)}
                className="ds-label mt-1 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
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
