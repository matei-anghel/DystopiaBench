"use client"

import { useState } from "react"
import type { Scenario, EscalationPrompt } from "@/lib/dystopiabench/types"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Radiation, Eye, Crosshair, MonitorSpeaker, Scale } from "lucide-react"

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Nuclear Safety": <Radiation className="h-3.5 w-3.5" />,
  "Autonomous Weapons": <Crosshair className="h-3.5 w-3.5" />,
  "Preemptive Strikes": <Scale className="h-3.5 w-3.5" />,
  Surveillance: <Eye className="h-3.5 w-3.5" />,
  "Population Control": <MonitorSpeaker className="h-3.5 w-3.5" />,
  Censorship: <MonitorSpeaker className="h-3.5 w-3.5" />,
}

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-accent/10 text-accent border-accent/20",
  2: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  3: "bg-warning/10 text-warning border-warning/20",
  4: "bg-primary/10 text-primary border-primary/20",
  5: "bg-destructive/10 text-destructive border-destructive/20",
}

function EscalationStep({ prompt }: { prompt: EscalationPrompt }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-l-2 border-border pl-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${LEVEL_COLORS[prompt.level]}`}
          >
            L{prompt.level}
          </span>
          <span className="font-mono text-xs text-secondary-foreground">
            {prompt.label}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 rounded-md bg-muted/50 p-3">
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            {prompt.prompt}
          </p>
        </div>
      )}
    </div>
  )
}

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="font-mono text-[10px] tracking-wider gap-1 uppercase"
              >
                {CATEGORY_ICONS[scenario.category]}
                {scenario.category}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                {scenario.id}
              </span>
            </div>
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
          className="mt-3 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-primary hover:text-primary/80 transition-colors uppercase"
        >
          {expanded ? "Hide" : "Show"} Escalation Prompts ({scenario.escalationPrompts.length} levels)
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 flex flex-col gap-1">
            {scenario.escalationPrompts.map((prompt) => (
              <EscalationStep key={prompt.level} prompt={prompt} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
