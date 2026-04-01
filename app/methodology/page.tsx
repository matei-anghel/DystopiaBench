import type { Metadata } from "next"
import Link from "next/link"
import { BenchHeader } from "@/components/bench/header"
import { MethodologySection } from "@/components/bench/methodology-section"
import { ModuleOverview } from "@/components/bench/module-overview"
import { getBenchmarkData } from "@/lib/dystopiabench/data-fetcher"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { ALL_MODULES, ALL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { GENERATION_CONFIG } from "@/lib/dystopiabench/schemas"

export const metadata: Metadata = {
  title: "Methodology | DystopiaBench",
  description:
    "Experimental design, prompting protocol, scoring, and reproducibility details for DystopiaBench.",
  alternates: {
    canonical: "/methodology",
  },
}

export default async function MethodologyPage() {
  const { manifest } = await getBenchmarkData()
  const showLocalRunLink = process.env.NODE_ENV !== "production"
  const generationConfig = manifest?.metadata.generationConfig ?? GENERATION_CONFIG
  const transportPolicy = manifest?.metadata.transportPolicy ?? "chat-first-fallback"
  const conversationMode = manifest?.metadata.conversationMode ?? "stateful"
  const judgeStrategy = manifest?.metadata.judgeStrategy ?? "single"
  const providerPrecisionPolicy = manifest?.metadata.providerPrecisionPolicy ?? "default"

  return (
    <div className="min-h-screen bg-background scanline">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-4 pt-8">
        <section id="methodology" className="mb-16 scroll-mt-20">
          <MethodologySection
            benchmarkModuleCount={ALL_MODULES.length}
            benchmarkScenarioCount={ALL_SCENARIOS.length}
            benchmarkEscalationLevelCount={5}
            conversationMode={conversationMode}
            generationConfig={generationConfig}
            judgeStrategy={judgeStrategy}
            providerPrecisionPolicy={providerPrecisionPolicy}
            transportPolicy={transportPolicy}
            modelCount={AVAILABLE_MODELS.length}
          />
        </section>

        <section className="mb-16 space-y-12">
          {ALL_MODULES.map((module) => (
            <section key={module.id} id={String(module.id)} className="scroll-mt-20">
              <ModuleOverview module={module.id} />
            </section>
          ))}
        </section>

        <footer className="border-t border-border pb-6 pt-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              2026 DystopiaBench. Open source safety research.
            </p>
            <div className="flex gap-8">
              {[
                { label: "Home", href: "/" },
                { label: "Results", href: "/results" },
                ...(showLocalRunLink ? [{ label: "Run (Local)", href: "/run" }] : []),
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="border-b border-transparent font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
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
