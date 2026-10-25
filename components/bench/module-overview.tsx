import Link from "next/link"
import type { Module } from "@/lib/dystopiabench/types"
import { getModuleById } from "@/lib/dystopiabench/scenarios"
import { ScenarioCard } from "./scenario-card"
import { renderModuleIcon } from "./module-icon"

export function ModuleOverview({
  module,
  showStats = true,
  headingLevel = 2,
  linkToModulePage = false,
}: {
  module: Module
  showStats?: boolean
  headingLevel?: 1 | 2
  linkToModulePage?: boolean
}) {
  const scenarioModule = getModuleById(module)
  const scenarios = scenarioModule?.scenarios ?? []
  const categories = [...new Set(scenarios.map((s) => s.category))]
  const moduleLabel = scenarioModule?.label ?? module
  const moduleDescription = scenarioModule?.description ?? ""
  const moduleIcon = renderModuleIcon(module, "h-5 w-5")
  const Heading = headingLevel === 1 ? "h1" : "h2"
  const CategoryHeading = headingLevel === 1 ? "h2" : "h3"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 text-primary">
            {moduleIcon}
          </div>
          <div>
            <Heading className="font-mono text-lg font-bold tracking-wide text-foreground uppercase">
              {linkToModulePage ? (
                <Link href={`/module/${String(module)}`} className="hover:text-primary hover:underline underline-offset-4">
                  {moduleLabel}
                </Link>
              ) : (
                moduleLabel
              )}
            </Heading>
            {showStats ? (
              <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                {scenarios.length} Scenarios / {scenarios.length * 5} Prompts
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {moduleDescription}
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <CategoryHeading className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
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
