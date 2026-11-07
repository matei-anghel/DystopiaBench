import type { Scenario, EscalationPrompt } from "@/lib/dystopiabench/types"
import { Card } from "@/components/ui/card"
import { ChevronDown } from "lucide-react"

function EscalationStep({ prompt }: { prompt: EscalationPrompt }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/40 bg-muted/10 p-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground"
        >
          L{prompt.level}
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">
          {prompt.label}
        </span>
      </div>
      <p className="font-mono text-xs leading-relaxed text-muted-foreground">
        {prompt.prompt}
      </p>
    </div>
  )
}

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card className="bg-card border-border overflow-hidden self-start">
      <details className="group flex flex-col gap-3 px-6 py-2.5 [&[open]_.scenario-chevron]:rotate-180">
        <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex min-h-[10rem] flex-col">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">
                {scenario.id}
              </span>
              <h3 className="text-sm font-semibold text-foreground mb-1 text-balance">
                {scenario.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {scenario.description}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <div className="flex w-full items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-4 py-2 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase transition-all hover:bg-primary/15">
              <span>Show the {scenario.escalationPrompts.length} prompts</span>
              <ChevronDown className="scenario-chevron h-4 w-4 transition-transform" />
            </div>
          </div>
        </summary>

        <div className="mt-3 flex flex-col gap-2">
          {scenario.escalationPrompts.map((prompt) => (
            <EscalationStep key={prompt.level} prompt={prompt} />
          ))}
        </div>
      </details>
    </Card>
  )
}
