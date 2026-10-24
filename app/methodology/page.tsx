import type { Metadata } from "next"
import Link from "next/link"
import { BenchHeader } from "@/components/bench/header"
import { MethodologySection } from "@/components/bench/methodology-section"
import { ModuleOverview } from "@/components/bench/module-overview"
import { getModelById } from "@/lib/dystopiabench/models"
import { ALL_MODULES } from "@/lib/dystopiabench/scenarios"
import { orderScenarioModulesForDisplay } from "@/lib/dystopiabench/module-display-order"
import { V1_DATA_FILES, V1_RUN_CONFIG, getV1Summary } from "@/lib/dystopiabench/v1-summary"

// Counts are read from the published V1 chart data at build time.
export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Methodology | DystopiaBench",
  description:
    "Experimental design, prompting protocol, scoring, and reproducibility details for DystopiaBench.",
  alternates: {
    canonical: "/methodology",
  },
}

function modelLabel(modelId: string): string {
  return getModelById(modelId)?.label ?? modelId
}

export default function MethodologyPage() {
  const displayModules = orderScenarioModulesForDisplay(ALL_MODULES)
  const showLocalRunLink = process.env.NODE_ENV !== "production"

  return (
    <div className="min-h-screen bg-background scanline">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-4 py-4 pt-8 sm:px-6">
        <section id="methodology" className="mb-16 scroll-mt-20">
          <MethodologySection
            summary={getV1Summary()}
            runConfig={V1_RUN_CONFIG}
            judgeLabels={V1_RUN_CONFIG.judgeModels.map(modelLabel)}
            tieBreakerLabel={modelLabel(V1_RUN_CONFIG.judgeTieBreakerModel)}
            dataFiles={V1_DATA_FILES}
          />
        </section>

        <section className="mb-16 space-y-12" aria-label="Scenario modules">
          {displayModules.map((module) => (
            <section key={module.id} id={String(module.id)} className="scroll-mt-20">
              <ModuleOverview module={module.id} showStats={false} linkToModulePage />
            </section>
          ))}
        </section>

        <footer className="border-t border-border pb-6 pt-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              2026 DystopiaBench. Open source safety research.
            </p>
            <div className="flex gap-8">
              {[
                { label: "Home", href: "/" },
                { label: "Results", href: "/#results" },
                ...(showLocalRunLink ? [{ label: "Run (Local)", href: "/run" }] : []),
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="border-b border-transparent font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
