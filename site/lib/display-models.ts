import { getLabColor } from "@/lib/labs"
import type { V2Model } from "@/lib/v2-results"

/** A model as the charts draw it: name, lab, lab colour and weight class. */
export interface DisplayModel {
  id: string
  label: string
  provider: string
  color: string
  weights: "open" | "closed"
}

export function toDisplayModel(model: V2Model): DisplayModel {
  return { id: model.id, label: model.label, provider: model.lab, color: getLabColor(model.lab), weights: model.weights }
}

export function indexDisplayModels(models: readonly DisplayModel[]): Map<string, DisplayModel> {
  return new Map(models.map((model) => [model.id, model]))
}
