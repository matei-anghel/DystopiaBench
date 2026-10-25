import type { Metadata } from "next"
import { BenchHeader } from "@/components/bench/header"
import { MethodologySection } from "@/components/bench/methodology-section"
import { ModuleOverview } from "@/components/bench/module-overview"
import { SiteFooter } from "@/components/bench/site-footer"
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

        <SiteFooter
          links={[
            { label: "Home", href: "/" },
            { label: "Results", href: "/#results" },
          ]}
        />
      </main>
    </div>
  )
}
