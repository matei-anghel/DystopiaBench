"use client"

import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { MODEL_COLORS } from "@/lib/dystopiabench/chart-config"

interface ModelVisibilityControlsProps {
  modelIds: string[]
  selectedModelIds: string[]
  onToggleModel: (modelId: string) => void
  onToggleAll: () => void
}

export function ModelVisibilityControls({
  modelIds,
  selectedModelIds,
  onToggleModel,
  onToggleAll,
}: ModelVisibilityControlsProps) {
  if (modelIds.length === 0) return null

  const allSelected = selectedModelIds.length === modelIds.length

  return (
    <div className="mb-6 rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Models shown: {selectedModelIds.length}/{modelIds.length}
        </p>
        <button
          type="button"
          onClick={onToggleAll}
          className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {modelIds.map((modelId) => {
          const model = AVAILABLE_MODELS.find((entry) => entry.id === modelId)
          const selected = selectedModelIds.includes(modelId)
          return (
            <button
              key={modelId}
              type="button"
              onClick={() => onToggleModel(modelId)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${selected
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground"
                }`}
              title={model ? `${model.provider} / ${model.label}` : modelId}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[modelId] ?? "#888" }} />
              {model?.label ?? modelId}
            </button>
          )
        })}
      </div>
    </div>
  )
}
