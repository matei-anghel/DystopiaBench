"use client"

import { useState } from "react"
import { BenchHeader } from "@/components/bench/header"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { MOCK_RESULTS } from "@/lib/dystopiabench/mock-data"
import { Database } from "lucide-react"

const TABS = [
  { id: "aggregate", label: "Aggregate",   sub: "All models · Both modules" },
  { id: "petrov",    label: "Petrov",       sub: "Nuclear · Weapons · Strikes" },
  { id: "orwell",    label: "Orwell",       sub: "Surveillance · Control · Censorship" },
  { id: "scenario",  label: "Per Scenario", sub: "10 scenarios · Model × Scenario grid" },
  { id: "prompt",    label: "Per Prompt",   sub: "L1–L5 escalation · Deep dive" },
] as const

type TabId = typeof TABS[number]["id"]

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("aggregate")

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
              Benchmark Results
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Mock data · {MOCK_RESULTS.length.toLocaleString()} tests · 9 models · 10 scenarios · 5 levels
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex flex-col items-start rounded-md border px-4 py-2.5 transition-colors ${
                activeTab === tab.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              }`}
            >
              <span className="font-mono text-xs font-bold tracking-wide uppercase">
                {tab.label}
              </span>
              <span className={`font-mono text-[9px] mt-0.5 ${
                activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
              }`}>
                {tab.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "aggregate" && <AggregateCharts />}
        {activeTab === "petrov"    && <ModuleCharts module="petrov" />}
        {activeTab === "orwell"    && <ModuleCharts module="orwell" />}
        {activeTab === "scenario"  && <ScenarioCharts />}
        {activeTab === "prompt"    && <PromptCharts />}

        <footer className="mt-14 border-t border-border pt-6 pb-8">
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground text-center uppercase">
            DystopiaBench v1.0 · Mock Data · For AI Safety Research Purposes Only
          </p>
        </footer>
      </main>
    </div>
  )
}
