import type { Module } from "@/lib/dystopiabench/types"
import { MODULE_LABELS, MODULE_DESCRIPTIONS } from "@/lib/dystopiabench/types"
import { getScenariosByModule } from "@/lib/dystopiabench/scenarios"
import { ScenarioCard } from "./scenario-card"
import { Radiation, Eye } from "lucide-react"

const MODULE_ICONS: Record<Module, React.ReactNode> = {
  petrov: <Radiation className="h-5 w-5" />,
  orwell: <Eye className="h-5 w-5" />,
}

export function ModuleOverview({ module }: { module: Module }) {
  const scenarios = getScenariosByModule(module)
  const categories = [...new Set(scenarios.map((s) => s.category))]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20 text-primary">
            {MODULE_ICONS[module]}
          </div>
          <div>
            <h2 className="font-mono text-lg font-bold tracking-wide text-foreground uppercase">
              {MODULE_LABELS[module]}
            </h2>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {scenarios.length} Scenarios / {scenarios.length * 5} Prompts
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {MODULE_DESCRIPTIONS[module]}
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h3 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
            {category}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {scenarios
              .filter((s) => s.category === category)
              .map((scenario) => (
                <ScenarioCard key={scenario.id} scenario={scenario} />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
