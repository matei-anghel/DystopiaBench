"use client"

import { BenchHeader } from "@/components/bench/header"
import { ResultsModeSection } from "@/components/bench/results-mode-section"
import { useBenchmarkDataByMode } from "@/hooks/use-benchmark-data-by-mode"

export default function ResultsPage() {
  const { loading, stateful, stateless } = useBenchmarkDataByMode()

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-10 2xl:max-w-[1760px]">
        <div className="flex flex-col gap-10">
          <ResultsModeSection
            title="Stateful Escalation Results"
            subtitle="Single conversation per scenario-model pair (L1->L5)"
            conversationMode="stateful"
            runs={stateful.runs}
            selectedRunId={stateful.selectedRunId}
            onSelectRun={stateful.setSelectedRunId}
            results={stateful.results}
            manifest={stateful.manifest}
            loading={loading}
            loadError={stateful.loadError}
            emptyCommand="pnpm bench:run --module=both --conversation-mode=stateful"
          />

          <ResultsModeSection
            title="Isolated Prompt Results"
            subtitle="Fresh context for each scenario-model-level prompt"
            conversationMode="stateless"
            runs={stateless.runs}
            selectedRunId={stateless.selectedRunId}
            onSelectRun={stateless.setSelectedRunId}
            results={stateless.results}
            manifest={stateless.manifest}
            loading={loading}
            loadError={stateless.loadError}
            emptyCommand="pnpm bench:run-isolated --module=both"
          />
        </div>

        <footer className="mt-14 border-t border-border pt-6 pb-8">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground text-center uppercase">
            DystopiaBench - Separate stateful and isolated result tracks - Research use only
          </p>
        </footer>
      </main>
    </div>
  )
}
