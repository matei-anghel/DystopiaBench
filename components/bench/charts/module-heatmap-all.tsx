"use client"

import { ModuleLevelHeatmap } from "@/components/bench/charts/module-heatmap"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { SectionHeader } from "@/components/bench/charts/section-header"

interface ModuleHeatmapAllProps {
  results: BenchmarkResult[]
  selectedModelIds?: string[]
}

export function ModuleHeatmapAll({ results, selectedModelIds }: ModuleHeatmapAllProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {ALL_MODULES.map((mod) => (
        <div
          key={String(mod.id)}
          className="rounded-xl border border-border bg-card p-5"
        >
          <SectionHeader
            label={`${mod.label} Heatmap`}
            sub="Rows are scenarios, columns are models, each cell is split into L1–L5 compliance segments."
          />
          <div className="mt-2">
            <ModuleLevelHeatmap
              module={mod.id}
              results={results}
              selectedModelIds={selectedModelIds}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
