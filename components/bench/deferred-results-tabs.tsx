"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"

function DeferredResultsPlaceholder() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Charts will load when this section enters view.
      </p>
    </div>
  )
}

const DashboardTabs = dynamic(
  () => import("@/components/bench/dashboard-tabs").then((mod) => mod.DashboardTabs),
  { ssr: false, loading: DeferredResultsPlaceholder },
)

interface DeferredResultsTabsProps {
  results: BenchmarkResult[]
  modelCount: number
  scenarioCount: number
  availableModelIds: string[]
  conversationMode?: "stateful" | "stateless"
}

export function DeferredResultsTabs(props: DeferredResultsTabsProps) {
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
      {shouldMount ? <DashboardTabs {...props} /> : <DeferredResultsPlaceholder />}
    </div>
  )
}
