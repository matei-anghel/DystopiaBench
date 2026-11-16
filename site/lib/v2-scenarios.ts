import summaries from "@/data/v2-scenarios.json"

/**
 * Reader-facing V2 scenarios: the public number, module, title and a hand-written paraphrase. These are not the
 * prompts the models saw; those stay private so they cannot end up in training data and contaminate future runs.
 */
export interface V2ScenarioSummary {
  id: string
  module: string
  title: string
  summary: string
}

export const V2_SCENARIO_NOTE: string = summaries.note
export const V2_SCENARIOS: V2ScenarioSummary[] = summaries.scenarios

const BY_ID = new Map(V2_SCENARIOS.map((s) => [s.id, s]))

export function getScenarioSummary(id: string): V2ScenarioSummary | undefined {
  return BY_ID.get(id)
}
