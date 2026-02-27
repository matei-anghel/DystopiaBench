"use client"

import { useState, useMemo } from "react"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { ModelVisibilityControls } from "@/components/bench/charts/model-visibility-controls"
import { Database } from "lucide-react"
import type { MockResult } from "@/lib/dystopiabench/mock-data"

const RESULT_TABS = [
    { id: "aggregate", label: "Aggregate", sub: "All models - Both modules" },
    { id: "petrov", label: "Petrov", sub: "Nuclear - Weapons - Strikes" },
    { id: "orwell", label: "Orwell", sub: "Surveillance - Control - Censorship" },
    { id: "scenario", label: "Per Scenario", sub: "10 scenarios - Model x Scenario grid" },
    { id: "prompt", label: "Per Prompt", sub: "L1-L5 escalation - Deep dive" },
] as const

type TabId = typeof RESULT_TABS[number]["id"]

function normalizeSelection(selected: string[], available: string[]): string[] {
    const next = selected.filter((id) => available.includes(id))
    return next.length > 0 ? next : available
}

export function DashboardTabs({
    results,
    dataSource,
    modelCount,
    scenarioCount,
    availableModelIds
}: {
    results: MockResult[]
    dataSource: "real" | "mock"
    modelCount: number
    scenarioCount: number
    availableModelIds: string[]
}) {
    const [activeTab, setActiveTab] = useState<TabId>("aggregate")
    const [rawSelectedModelIds, setRawSelectedModelIds] = useState<string[]>([])

    const selectedModelIds = useMemo(
        () => normalizeSelection(rawSelectedModelIds, availableModelIds),
        [availableModelIds, rawSelectedModelIds],
    )

    const filteredResults = useMemo(() => {
        const selectedSet = new Set(selectedModelIds)
        return results.filter((row) => selectedSet.has(row.modelId))
    }, [results, selectedModelIds])

    const toggleModel = (modelId: string) => {
        setRawSelectedModelIds((current) => {
            const next = normalizeSelection(current, availableModelIds)
            if (!next.includes(modelId)) return [...next, modelId]
            if (next.length === 1) return next
            return next.filter((id) => id !== modelId)
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
                        {dataSource === "real" ? "Real run data" : "Mock data fallback"} ·{" "}
                        {filteredResults.length.toLocaleString()} tests · {selectedModelIds.length}/{modelCount} models · {scenarioCount} scenarios
                    </p>
                </div>
            </div>

            <ModelVisibilityControls
                modelIds={availableModelIds}
                selectedModelIds={selectedModelIds}
                onToggleModel={toggleModel}
                onSelectAll={() => setRawSelectedModelIds(availableModelIds)}
            />

            <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
                {RESULT_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 flex flex-col items-start rounded-md border px-4 py-2.5 transition-colors ${activeTab === tab.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                            }`}
                    >
                        <span className="font-mono text-xs font-bold tracking-wide uppercase">
                            {tab.label}
                        </span>
                        <span className={`font-mono text-[9px] mt-0.5 ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
                            }`}>
                            {tab.sub}
                        </span>
                    </button>
                ))}
            </div>

            {activeTab === "aggregate" && <AggregateCharts results={filteredResults} dataSource={dataSource} />}
            {activeTab === "petrov" && <ModuleCharts module="petrov" results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "orwell" && <ModuleCharts module="orwell" results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "scenario" && <ScenarioCharts results={filteredResults} selectedModelIds={selectedModelIds} />}
            {activeTab === "prompt" && <PromptCharts results={filteredResults} selectedModelIds={selectedModelIds} />}
        </>
    )
}
