"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

function DeferredResultsPlaceholder() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        Charts will load when this section enters view.
      </p>
    </div>
  )
}

// The loader pulls in the run schemas, scenario catalog and model registry, so it is kept out
// of the homepage's initial bundle and fetched only when the results section approaches view.
const ResultsLoader = dynamic(
  () => import("@/components/bench/results-loader").then((mod) => mod.ResultsLoader),
  { ssr: false, loading: DeferredResultsPlaceholder },
)

export function DeferredResultsTabs() {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [shouldMount, setShouldMount] = useState(
    () => typeof window !== "undefined" && !("IntersectionObserver" in window),
  )

  useEffect(() => {
    if (shouldMount) return
    const node = sentinelRef.current
    if (!node) return
    if (!("IntersectionObserver" in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldMount(true)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin: "500px 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldMount])

  return (
    <div ref={sentinelRef}>
      {shouldMount ? <ResultsLoader /> : <DeferredResultsPlaceholder />}
    </div>
  )
}
