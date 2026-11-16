"use client"

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { LabLogo } from "@/components/lab-logo"
import type { DisplayModel } from "@/lib/display-models"

/**
 * Which models the dashboard charts show. One shared view drives every chart (as on Artificial
 * Analysis): changing it from any chart's picker changes them all.
 */
export type ModelViewId = "all" | "flagships" | "closed" | "open" | "custom"
export type PresetModelViewId = Exclude<ModelViewId, "custom">

export const MODEL_VIEWS: Array<{ id: PresetModelViewId; label: string; hint: string }> = [
  { id: "all", label: "All models", hint: "Every model in the V2 roster" },
  { id: "flagships", label: "Flagships", hint: "One frontier model per lab" },
  { id: "closed", label: "Closed weights", hint: "API-only models" },
  { id: "open", label: "Open weights", hint: "Downloadable models" },
]

// Per lab, the first of these present is its flagship; labs with none listed use their first model in roster order.
const FLAGSHIP_PREFERENCE = ["fable-5-2", "gpt-6-1-sol", "gemini-4-argon", "grok-4-7", "muse-wonder", "kimi-k3-1-pro",
  "deepseek-v4-pro-0813", "qwen-4-max",
  "glm-5-3-prime", "qwen-3-8-max-prime"]

export function getViewModelIds(view: PresetModelViewId, models: readonly DisplayModel[]): string[] {
  switch (view) {
    case "all":
      return models.map((model) => model.id)
    case "closed":
      return models.filter((model) => model.weights === "closed").map((model) => model.id)
    case "open":
      return models.filter((model) => model.weights === "open").map((model) => model.id)
    case "flagships": {
      const byProvider = new Map<string, DisplayModel>()
      const rank = (candidate: DisplayModel | undefined) => {
        const index = candidate ? FLAGSHIP_PREFERENCE.indexOf(candidate.id) : -1
        return index === -1 ? Number.MAX_SAFE_INTEGER : index
      }
      for (const model of models) {
        const current = byProvider.get(model.provider)
        if (!current || rank(model) < rank(current)) byProvider.set(model.provider, model)
      }
      const flagships = new Set([...byProvider.values()].map((model) => model.id))
      return models.filter((model) => flagships.has(model.id)).map((model) => model.id)
    }
  }
}

interface ModelViewContextValue {
  /** Every model in the dataset, in roster order. */
  models: DisplayModel[]
  view: ModelViewId
  selectedIds: string[]
  setView: (view: PresetModelViewId) => void
  setCustom: (ids: string[]) => void
}

const ModelViewContext = createContext<ModelViewContextValue | null>(null)
export const ModelViewProvider = ModelViewContext.Provider

export function useModelView() {
  return useContext(ModelViewContext)
}

function viewLabel(view: ModelViewId): string {
  return view === "custom" ? "Custom" : MODEL_VIEWS.find((entry) => entry.id === view)?.label ?? view
}

/**
 * Dropdown for the shared model view. `compact` is the per-chart variant; the full one sits in
 * the results toolbar. Renders nothing outside a ModelViewProvider.
 */
export function ModelViewPicker({ compact = false, align = "end" }: { compact?: boolean; align?: "start" | "end" }) {
  const context = useModelView()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const byProvider = new Map<string, DisplayModel[]>()
    for (const model of context?.models ?? []) {
      if (needle && !`${model.label} ${model.provider}`.toLowerCase().includes(needle)) continue
      const rows = byProvider.get(model.provider)
      if (rows) rows.push(model)
      else byProvider.set(model.provider, [model])
    }
    return [...byProvider.entries()]
  }, [context?.models, query])

  if (!context || context.models.length === 0) return null
  const { models, view, selectedIds, setView, setCustom } = context
  const selected = new Set(selectedIds)

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    // Keep catalog order so legends and colours stay stable.
    setCustom(models.filter((model) => next.has(model.id)).map((model) => model.id))
  }

  const triggerClass = compact
    ? "h-7 gap-1.5 px-2 text-[11px]"
    : "h-9 gap-2 px-3 text-xs"

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center rounded-md border border-border bg-background font-mono text-foreground transition-colors hover:border-muted-foreground/50 ${triggerClass}`}
      >
        {compact ? (
          <>
            <span className="font-medium">{viewLabel(view)}</span>
            <span className="tabular-nums text-muted-foreground">{selectedIds.length}</span>
          </>
        ) : (
          <>
            <span className="font-medium">Models</span>
            <span className="sr-only">: {viewLabel(view)}, {selectedIds.length} shown</span>
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Models shown in every chart"
          className={`absolute top-full z-50 mt-1.5 flex max-h-[min(70vh,520px)] w-[min(86vw,320px)] flex-col overflow-hidden rounded-md border border-border bg-background/80 text-popover-foreground shadow-xl backdrop-blur-xl ${align === "end" ? "right-0" : "left-0"}`}
        >
          <div className="border-b border-border p-1.5" role="radiogroup" aria-label="Preset view">
            {MODEL_VIEWS.map((entry) => {
              const count = getViewModelIds(entry.id, models).length
              const active = view === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={count === 0}
                  onClick={() => setView(entry.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-40 aria-checked:bg-muted"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center">
                    {active ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block font-mono text-xs text-foreground">{entry.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{entry.hint}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter models or labs"
              aria-label="Filter models or labs"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setCustom(selectedIds.length === models.length ? [] : models.map((model) => model.id))}
              className="shrink-0 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {selectedIds.length === models.length ? "Clear" : "All"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {groups.map(([provider, rows]) => {
              const ids = rows.map((model) => model.id)
              const allOn = ids.every((id) => selected.has(id))
              return (
                <div key={provider} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggle(ids, !allOn)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted"
                    title={allOn ? `Hide all ${provider} models` : `Show all ${provider} models`}
                  >
                    <LabLogo provider={provider} size={13} />
                    <span className="flex-1 font-mono text-[11px] font-semibold text-muted-foreground">{provider}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {ids.filter((id) => selected.has(id)).length}/{ids.length}
                    </span>
                  </button>
                  {rows.map((model) => {
                    const on = selected.has(model.id)
                    return (
                      <label
                        key={model.id}
                        className="flex cursor-pointer items-center gap-2 rounded py-1 pl-7 pr-2 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle([model.id], !on)}
                          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                        />
                        <span className={`font-mono text-xs ${on ? "text-foreground" : "text-muted-foreground"}`}>
                          {model.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )
            })}
            {groups.length === 0 ? (
              <p className="px-2 py-3 font-mono text-[11px] text-muted-foreground">No models match.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
