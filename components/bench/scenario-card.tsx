"use client"

import { useState } from "react"
import type { Scenario, EscalationPrompt } from "@/lib/dystopiabench/types"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-green-500/10 text-green-500 border-green-500/20",
  2: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  3: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  4: "bg-red-500/10 text-red-500 border-red-500/20",
  5: "bg-red-600/10 text-red-600 border-red-600/20",
}

function EscalationStep({ prompt }: { prompt: EscalationPrompt }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/40 bg-muted/10 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${LEVEL_COLORS[prompt.level]}`}
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
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="bg-card border-border overflow-hidden flex flex-col min-h-[320px]">
      <div className="flex h-full flex-col px-6 py-2.5 gap-3">
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

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-auto flex w-full items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-4 py-2 font-mono text-[10px] font-semibold tracking-wider text-primary hover:bg-primary/15 transition-all uppercase"
        >
          <span>
            {expanded ? "Hide" : "Show"} Escalation Prompts ({scenario.escalationPrompts.length} levels)
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 flex flex-col gap-2">
            {scenario.escalationPrompts.map((prompt) => (
              <EscalationStep key={prompt.level} prompt={prompt} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
