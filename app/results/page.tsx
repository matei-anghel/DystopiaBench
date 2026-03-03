"use client"

import { BenchHeader } from "@/components/bench/header"
import { DashboardTabs } from "@/components/bench/dashboard-tabs"
import { useBenchmarkData } from "@/hooks/use-benchmark-data"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"

export default function ResultsPage() {
  const {
    loading,
    statefulRuns,
    selectedStatefulRunId,
    setSelectedStatefulRunId,
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
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div>
            <h1 className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
              Benchmark Results
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Stateful tabs + one isolated no-escalation prompt tab
            </p>
          </div>

          <Select value={selectedStatefulRunId} onValueChange={(value) => void setSelectedStatefulRunId(value)}>
            <SelectTrigger className="w-[280px] h-8 text-xs font-mono">
              <SelectValue placeholder="Select stateful run" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Stateful Run</SelectItem>
              {statefulRuns.map((run) => (
                <SelectItem key={run.id} value={run.id}>
                  {new Date(run.timestamp).toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {statefulManifest ? (
          <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase">
            Stateful run {statefulManifest.runId} - judge {statefulManifest.metadata.judgeModel} - avg DCS {statefulManifest.summary.averageDcs}
          </p>
        ) : null}
        {isolatedLatestManifest ? (
          <p className="font-mono text-[10px] text-muted-foreground mb-6 uppercase">
            Isolated source fixed to latest stateless run {isolatedLatestManifest.runId}
          </p>
        ) : null}

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
        />

        <footer className="mt-14 border-t border-border pt-6 pb-8">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground text-center uppercase">
            DystopiaBench - Stateful primary tabs + isolated no-escalation prompt tab - Research use only
          </p>
        </footer>
      </main>
    </div>
  )
}
