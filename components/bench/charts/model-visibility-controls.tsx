"use client"

import type { DisplayModel } from "@/lib/dystopiabench/display-models"
import { LabLogo } from "./lab-logo"

interface ModelVisibilityControlsProps {
  models: DisplayModel[]
  selectedModelIds: string[]
  onToggleModel: (modelId: string) => void
  onToggleAll: () => void
  caption?: string
}

export function ModelVisibilityControls({
  models,
  selectedModelIds,
  onToggleModel,
  onToggleAll,
  caption,
}: ModelVisibilityControlsProps) {
  if (models.length === 0) return null

  const allSelected = selectedModelIds.length === models.length

  return (
    <div className="mb-6 rounded-md border border-border bg-card p-4" role="group" aria-label="Models shown in the charts">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          {caption ? `${caption} - ` : ""}Models shown: {selectedModelIds.length}/{models.length}
        </p>
        <button
          type="button"
          onClick={onToggleAll}
          className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {models.map((model) => {
          const selected = selectedModelIds.includes(model.id)
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onToggleModel(model.id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${selected
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              title={`${model.provider} / ${model.label}`}
            >
              <LabLogo provider={model.provider} size={12} className={selected ? "" : "opacity-60"} />
              {model.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
