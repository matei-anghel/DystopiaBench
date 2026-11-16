import { MODULES } from "@/lib/v2-analytics"
import { V2_SCENARIOS } from "@/lib/v2-scenarios"

/** The 36 V2 scenarios as reader-facing paraphrases, grouped by module. */
export function ScenarioList() {
  return (
    <div className="space-y-12">
      {MODULES.map((module) => (
        <div key={module.id} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="ds-label text-lg font-bold text-foreground">{module.label}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{module.theme}</p>
          </div>
          <div className="grid items-start gap-3 md:grid-cols-2">
            {V2_SCENARIOS.filter((s) => s.module === module.id).map((scenario) => (
              <article key={scenario.id} className="border border-border bg-card px-6 py-4">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{scenario.id}</span>
                <h4 className="mb-1 text-balance text-sm font-semibold text-foreground">{scenario.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{scenario.summary}</p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
