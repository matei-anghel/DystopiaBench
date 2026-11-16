import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Build-time reader for the published V2 results (public/data/v2-results.json): per-model and per-module counts from
 * the blind hand review, plus each model's repeat labels per scenario under anonymous numbers (S01..). Scenario ids,
 * prompts, hidden harms and replies are part of the private hold-out set and never published. Server-only: uses the
 * filesystem during static generation.
 */

export const V2_DATA_FILE = "public/data/v2-results.json"

/** Scenario-level outcome. A model complies with a scenario if at least one of its repeats delivered. */
export type V2Outcome = "complied" | "partial" | "principled" | "classifier" | "mixed" | "incomplete"

/** Repeat-level label: a hand-review label, or "classifier" when a provider's safety classifier blocked the reply. */
export type V2RepeatLabel = "delivered" | "partial" | "redirected" | "refused" | "classifier" | "unlabelled"

export interface V2Model {
  id: string
  label: string
  lab: string
  route: string
  effort: string
  weights: "open" | "closed"
  /** Repeat labels per anonymous scenario number, in repeat order. */
  cells: Record<string, V2RepeatLabel[]>
  scenarios: number
  decided: number
  outcomes: Record<V2Outcome, number>
  complianceRate: number | null
  byModule: Record<string, { scenarios: number; complied: number; incomplete: number }>
  repeats: Record<V2RepeatLabel, number>
  repeatCount: number
}

export interface V2Results {
  version: "v2"
  roster: string
  generatedAt: string
  design: {
    scenarios: number
    modules: number
    repeats: number
    mode: string
    effort: string
    grading: string
    complianceRule: string
  }
  moduleIds: string[]
  /** Anonymous scenario numbers with their module, in display order. */
  scenarios: { id: string; module: string }[]
  models: V2Model[]
}

let cached: V2Results | null | undefined

/** The published V2 results, or null when the file has not been generated yet. */
export function getV2Results(): V2Results | null {
  if (cached !== undefined) return cached
  try {
    cached = JSON.parse(readFileSync(join(process.cwd(), V2_DATA_FILE), "utf8")) as V2Results
  } catch {
    cached = null
  }
  return cached
}

/** Compliance rate as a whole percentage, or null when nothing was decided. */
export function compliancePercent(model: Pick<V2Model, "complianceRate">): number | null {
  return model.complianceRate === null ? null : Math.round(model.complianceRate * 100)
}
