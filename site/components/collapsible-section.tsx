"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

const OPEN_REQUEST_KEY = "dystopiabench-open-section"

/**
 * Ask a CollapsibleSection to open after the next navigation (e.g. a header link clicked on
 * another page). Sections never open on their own from the URL alone.
 */
export function requestSectionOpen(id: string) {
  try {
    window.sessionStorage.setItem(OPEN_REQUEST_KEY, id)
  } catch {
    // Storage unavailable: the section stays collapsed and the visitor can open it.
  }
}

/** Open a section on this page and bring it into view. */
export function openSection(id: string) {
  const node = document.getElementById(id)
  if (node instanceof HTMLDetailsElement) node.open = true
  pinIntoView(node)
}

// Charts above load lazily and push the section down after the jump; keep it in view while the
// page settles, unless the visitor starts scrolling on their own.
function pinIntoView(node: HTMLElement | null) {
  if (!node) return
  node.scrollIntoView({ block: "start" })
  const observer = new ResizeObserver(() => node.scrollIntoView({ block: "start" }))
  observer.observe(document.body)
  const userEvents = ["wheel", "touchstart", "keydown", "mousedown"] as const
  const stop = () => {
    observer.disconnect()
    window.clearTimeout(timeout)
    for (const name of userEvents) window.removeEventListener(name, stop)
  }
  const timeout = window.setTimeout(stop, 6000)
  for (const name of userEvents) window.addEventListener(name, stop, { passive: true })
}

/** Same-page link that opens a CollapsibleSection and scrolls to it. */
export function OpenSectionLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        openSection(id)
      }}
    >
      {children}
    </a>
  )
}

/**
 * A page section that starts collapsed. The whole title row toggles it; it also opens when a
 * same-page link to `#<id>` is clicked, or when another page requested it via requestSectionOpen.
 */
export function CollapsibleSection({
  id,
  title,
  nested = false,
  children,
}: {
  id: string
  title: string
  /** A sub-section inside another CollapsibleSection: smaller heading and row. */
  nested?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDetailsElement | null>(null)

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(OPEN_REQUEST_KEY) === id) {
        window.sessionStorage.removeItem(OPEN_REQUEST_KEY)
        openSection(id)
      }
    } catch {
      // Storage unavailable: stay collapsed.
    }
    // In-page links (e.g. the hero's Methodology button) change the hash.
    const onHashChange = () => {
      if (window.location.hash === `#${id}`) openSection(id)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [id])

  // Named groups (static class strings for Tailwind) keep a nested section's Show/Hide label
  // independent of the section it sits in.
  if (nested) {
    return (
      <details ref={ref} id={id} className="group/sub scroll-mt-20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <h3 className="ds-display text-3xl leading-none text-foreground">{title}</h3>
          <span className="ds-label inline-flex h-11 shrink-0 items-center gap-2.5 rounded-md border border-foreground/25 bg-card px-5 text-xs font-semibold text-foreground transition-colors group-hover/sub:border-foreground/60">
            <span className="group-open/sub:hidden">Show</span>
            <span className="hidden group-open/sub:inline">Hide</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open/sub:rotate-180" aria-hidden />
          </span>
        </summary>
        <div className="pb-6 pt-2">{children}</div>
      </details>
    )
  }

  return (
    <details ref={ref} id={id} className="group/section scroll-mt-20">
      <summary className="-mx-4 flex min-h-32 cursor-pointer list-none items-center justify-between gap-6 px-4 py-8 transition-colors hover:bg-muted/40 sm:-mx-6 sm:px-6 [&::-webkit-details-marker]:hidden">
        <h2 className="ds-display text-3xl leading-none text-foreground sm:text-4xl">{title}</h2>
        <span className="ds-label inline-flex h-11 shrink-0 items-center gap-2.5 rounded-md border border-foreground/25 bg-card px-5 text-xs font-semibold text-foreground transition-colors group-hover/section:border-foreground/60">
          <span className="group-open/section:hidden">Show</span>
          <span className="hidden group-open/section:inline">Hide</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="pb-6 pt-2">{children}</div>
    </details>
  )
}
