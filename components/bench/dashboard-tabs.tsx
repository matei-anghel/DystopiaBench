"use client"

import { useState, useMemo } from "react"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"

const BASE_RESULT_TABS = [
    { id: "aggregate", label: "Aggregate", sub: "All models - Both modules" },
    { id: "petrov", label: "Petrov", sub: "Infrastructure - Weapons - Safety Override" },
    { id: "orwell", label: "Orwell", sub: "Surveillance - Population Control - Censorship" },
    { id: "scenario", label: "Per Scenario", sub: `${ALL_SCENARIOS.length} scenarios - Model x Scenario grid` },
] as const

type TabId = "aggregate" | "petrov" | "orwell" | "scenario" | "prompt"

function normalizeSelection(selected: string[], available: string[], { initial = false } = {}): string[] {
    const next = selected.filter((id) => available.includes(id))
    if (initial && next.length === 0) return available
    return next
}

export function DashboardTabs({
    results,
    modelCount,
    scenarioCount,
    availableModelIds,
    conversationMode = "stateful",
}: {
    results: BenchmarkResult[]
    modelCount: number
    scenarioCount: number
    availableModelIds: string[]
    conversationMode?: "stateful" | "stateless"
}) {
    const [activeTab, setActiveTab] = useState<TabId>("aggregate")
    const [hasInteracted, setHasInteracted] = useState(false)
    const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])

    const selectedModelIds = useMemo(
        () => normalizeSelection(rawSelectedModelIds, availableModelIds, { initial: !hasInteracted }),
        [availableModelIds, rawSelectedModelIds, hasInteracted],
    )

    const filteredResults = useMemo(() => {
        const selectedSet = new Set(selectedModelIds)
        return results.filter((row) => selectedSet.has(row.modelId))
    }, [results, selectedModelIds])
    const resultTabs = useMemo(
        () => [
            ...BASE_RESULT_TABS,
            conversationMode === "stateless"
                ? { id: "prompt" as const, label: "Per Prompt (No Escalation)", sub: "L1-L5 isolated prompts - Deep dive" }
                : { id: "prompt" as const, label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
        ],
        [conversationMode],
    )

    const toggleModel = (modelId: string) => {
        setHasInteracted(true)
        setRawSelectedModelIds((current) => {
            const next = normalizeSelection(current, availableModelIds, { initial: !hasInteracted })
            if (!next.includes(modelId)) return [...next, modelId]
            return next.filter((id) => id !== modelId)
        })
    }

    const toggleAll = () => {
        setHasInteracted(true)
        setRawSelectedModelIds((current) => {
            const next = normalizeSelection(current, availableModelIds, { initial: !hasInteracted })
            if (next.length === availableModelIds.length) {
                return []
            }
            return availableModelIds
        })
    }

    return (
        <>
            <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                    <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <p className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
                        Benchmark Results
                    </p>
                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                        {filteredResults.length.toLocaleString()} tests · {selectedModelIds.length}/{modelCount} models · {scenarioCount} scenarios
                    </p>
                </div>
            </div>

            <ModelVisibilityControls
                modelIds={availableModelIds}
                selectedModelIds={selectedModelIds}
                onToggleModel={toggleModel}
                onToggleAll={toggleAll}
            />

            <div className="mb-8 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
                {resultTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex w-full min-w-0 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${activeTab === tab.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                            }`}
                    >
                        <span className="font-mono text-xs font-bold tracking-wide uppercase">
                            {tab.label}
                        </span>
                        <span className={`mt-0.5 font-mono text-[9px] leading-relaxed ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
                            }`}>
                            {tab.sub}
                        </span>
                    </button>
                ))}
            </div>

            {activeTab === "aggregate" && <AggregateCharts results={filteredResults} />}
            {activeTab === "petrov" && <ModuleCharts module="petrov" results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "orwell" && <ModuleCharts module="orwell" results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "scenario" && <ScenarioCharts results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "prompt" && (
                <PromptCharts
                    results={filteredResults}
                    selectedModelIds={selectedModelIds}
                    viewMode={conversationMode}
                />
            )}
        </>
    )
}
