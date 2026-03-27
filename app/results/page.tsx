"use client"

import { BenchHeader } from "@/components/bench/header"
import { DashboardTabs } from "@/components/bench/dashboard-tabs"
import { useBenchmarkData } from "@/hooks/use-benchmark-data"
import { Card } from "@/components/ui/card"

export default function ResultsPage() {
  const {
    loading,
    statefulResults,
    statefulManifest,
    statefulLoadError,
    isolatedLatestResults,
    isolatedLatestManifest,
  } = useBenchmarkData()

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-10 2xl:max-w-[1760px]">


        {loading ? (
          <Card className="border-border bg-muted/20 p-6 mb-6">
            <p className="font-mono text-xs text-muted-foreground uppercase">Loading results...</p>
          </Card>
        ) : null}

        {!loading && statefulLoadError ? (
          <Card className="border-border bg-muted/20 p-6 mb-6">
            <p className="font-mono text-xs text-destructive uppercase">
              Stateful load error: {statefulLoadError}
            </p>
          </Card>
        ) : null}

        <DashboardTabs
          statefulResults={statefulResults}
          isolatedResults={isolatedLatestResults}
          statefulManifest={statefulManifest}
          isolatedManifest={isolatedLatestManifest}
        />

        <footer className="border-t border-border pt-6 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              2026 DystopiaBench. Open source safety research.
            </p>
            <div className="flex gap-8">
              {[
                { label: "Methodology", href: "/#methodology" },
                { label: "Results", href: "/#results" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors uppercase border-b border-transparent hover:border-muted-foreground/30"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
