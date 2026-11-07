import type { Module } from "@/lib/dystopiabench/types"
import { getModuleById } from "@/lib/dystopiabench/scenarios"
import { ScenarioCard } from "./scenario-card"

export function ModuleOverview({
  module,
  headingLevel = 2,
}: {
  module: Module
  headingLevel?: 1 | 2 | 3
}) {
  const scenarioModule = getModuleById(module)
  const scenarios = scenarioModule?.scenarios ?? []
  const categories = [...new Set(scenarios.map((s) => s.category))]
  const moduleLabel = scenarioModule?.label ?? module
  const moduleDescription = scenarioModule?.description ?? ""
  const Heading = (["h1", "h2", "h3"] as const)[headingLevel - 1]
  const CategoryHeading = (["h2", "h3", "h4"] as const)[headingLevel - 1]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Heading className="ds-label text-lg font-bold text-foreground">{moduleLabel.replace(/\s+Module$/i, "")}</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {moduleDescription}
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <CategoryHeading className="ds-label border-b border-border pb-2 text-xs font-semibold text-muted-foreground">
            {category}
          </CategoryHeading>
          <div className="grid items-start gap-3 md:grid-cols-2">
            {scenarios.filter((s) => s.category === category).map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
