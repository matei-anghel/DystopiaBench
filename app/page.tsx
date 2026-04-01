import Link from "next/link"
import {
  BarChart3,
  FileText,
  Github,
  Linkedin,
  Mail,
  Radiation,
} from "lucide-react"
import { DeferredResultsTabs } from "@/components/bench/deferred-results-tabs"
import { BenchHeader } from "@/components/bench/header"
import { getChartScale, getResponsiveBarChartLayout } from "@/lib/dystopiabench/chart-config"
import { getAggregateByModel } from "@/lib/dystopiabench/analytics"
import { getBenchmarkData } from "@/lib/dystopiabench/data-fetcher"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"

export default async function DashboardPage() {
  const { results } = await getBenchmarkData()
  const showLocalRunLink = process.env.NODE_ENV !== "production"
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const heroModelFamilies = ["gpt", "opus", "gemini", "deepseek"] as const
  const aggregateByModel = getAggregateByModel(results)
  const heroAggregate = heroModelFamilies
    .map((family) => {
      const entry = aggregateByModel.find((candidate) => candidate.modelId.toLowerCase().includes(family))
      if (entry) {
        return {
          model: entry.label,
          score: entry.avgScore,
          provider: entry.provider,
        }
      }

      const fallback = AVAILABLE_MODELS.find((model) => model.id.toLowerCase().includes(family))
      return {
        model: fallback?.label ?? family.toUpperCase(),
        score: null,
        provider: fallback?.provider ?? family.toUpperCase(),
      }
    })
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0
      if (a.score === null) return 1
      if (b.score === null) return -1
      return a.score - b.score
    })

  return (
    <div className="min-h-screen bg-background scanline">
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "DystopiaBench - AI Ethics Stress Test",
          description:
            "A research benchmark testing AI compliance with dystopian directives across surveillance infrastructure, autonomous weapons, safety override, censorship, and population control scenarios.",
          url: siteUrl,
          creator: {
            "@type": "Organization",
            name: "DystopiaBench Research Team",
          },
        })}
      </script>
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-4 pt-8">
        <section id="dashboard" className="mb-12 grid gap-12 lg:grid-cols-2 lg:items-end scroll-mt-20">
          <div className="lg:pr-8">
            <div className="mb-4 flex items-center gap-2">
              <Radiation className="h-5 w-5 animate-pulse text-destructive glow-danger" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-destructive">
                AI Humanity Alignment Benchmark
              </span>
            </div>
            <div className="mb-6">
              <h1 className="font-sans text-5xl font-bold leading-[0.9] tracking-tighter text-foreground sm:text-7xl">
                Dystopia<span className="text-destructive">Bench</span>
              </h1>
              <p className="mt-4 font-sans text-2xl font-semibold leading-tight text-foreground/90 sm:text-3xl">
                Will the model press the button?
              </p>
            </div>
            <p className="mb-10 max-w-xl text-base leading-relaxed text-muted-foreground">
              A research benchmark that evaluates whether AI language models can be
              convinced to comply with dystopian directives through progressive
              escalation. Tests span registered scenario modules covering infrastructure
              misuse, surveillance, institutional capture, therapeutic coercion, and other
              high-stakes failure modes, each with 5 escalation levels from baseline
              requests to full coercion.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#results"
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-destructive-foreground transition-all hover:bg-destructive/90 active:scale-[0.98] glow-danger"
              >
                <BarChart3 className="h-4 w-4" />
                Explore Results
              </a>
              <Link
                href="/methodology"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-foreground transition-all hover:border-primary/50 hover:bg-muted/50"
              >
                <FileText className="h-4 w-4" />
                Read Methodology
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-8 flex h-full flex-col pl-4 lg:pl-0">
              {(() => {
                const chartHeight = 320
                const tickCount = 5
                const scores = heroAggregate
                  .map((row) => row.score)
                  .filter((score): score is number => score !== null)

                if (scores.length === 0) {
                  return (
                    <div className="flex h-80 items-center justify-center rounded-md border border-border bg-card/40 px-6 text-center">
                      <p className="font-mono text-xs uppercase text-muted-foreground">
                        No benchmark data available
                      </p>
                    </div>
                  )
                }

                const { ticks, toBarPct } = getChartScale(scores, tickCount)
                const heroBarLayout = getResponsiveBarChartLayout({ categoryCount: heroAggregate.length })
                const heroGap = heroAggregate.length <= 2 ? 12 : heroAggregate.length <= 4 ? 16 : 20
                const heroBarMaxWidth = Math.min(Math.max(heroBarLayout.maxBarSize + 32, 96), 148)

                return (
                  <>
                    <div className="flex">
                      <div
                        className="flex w-12 shrink-0 flex-col items-end justify-between border-r border-border/50 pr-4 font-mono text-[10px] text-muted-foreground"
                        style={{ height: chartHeight }}
                      >
                        {ticks.map((tick) => (
                          <span key={tick}>{tick}</span>
                        ))}
                      </div>
                      <div
                        className="relative flex flex-1 items-end px-4"
                        style={{
                          height: chartHeight,
                          gap: heroGap,
                          justifyContent: heroAggregate.length <= 4 ? "space-evenly" : "space-between",
                        }}
                      >
                        {ticks.map((tick) => (
                          <div
                            key={tick}
                            className="pointer-events-none absolute inset-x-0 z-0 border-t border-border/60"
                            style={{ bottom: `${toBarPct(tick)}%` }}
                          />
                        ))}
                        {heroAggregate.map((item) => (
                          <div key={item.model} className="group relative z-10 flex h-full flex-1 flex-col items-center">
                            <div className="relative flex h-full w-full flex-col items-center justify-end">
                              <div
                                className={`relative w-full overflow-visible rounded-t-sm transition-all duration-700 ease-out ${
                                  item.score === null
                                    ? "bg-muted/50"
                                    : "bg-destructive/80 group-hover:bg-destructive"
                                }`}
                                style={{
                                  height: item.score === null ? "0%" : `${toBarPct(item.score)}%`,
                                  maxWidth: heroBarMaxWidth,
                                }}
                              >
                                <div className="absolute inset-0 rounded-t-sm bg-gradient-to-t from-black/20 to-transparent" />
                                <div className="absolute -top-7 left-0 right-0 z-10 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
                                  <span className="rounded border border-destructive/20 bg-background/80 px-2 py-0.5 font-mono text-xs font-bold text-destructive backdrop-blur-sm">
                                    {item.score ?? "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex">
                      <div className="w-12 shrink-0 pr-4" />
                      <div
                        className="flex flex-1 px-4"
                        style={{
                          gap: heroGap,
                          justifyContent: heroAggregate.length <= 4 ? "space-evenly" : "space-between",
                        }}
                      >
                        {heroAggregate.map((item) => (
                          <div key={item.model} className="flex flex-1 flex-col items-center text-center">
                            <span className="line-clamp-1 font-mono text-[10px] font-bold uppercase leading-tight text-foreground">
                              {item.model.split(" ")[0]}
                            </span>
                            <span className="font-mono text-[8px] uppercase text-muted-foreground opacity-70">
                              {item.model.split(" ")[1] || item.provider}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-8 text-center font-mono text-[9px] leading-relaxed text-muted-foreground opacity-60">
                      LOWER SCORES = STRONGER SAFETY. 0 = FULL REFUSAL / 100 = FULL COMPLIANCE.
                    </p>
                  </>
                )
              })()}
            </div>
          </div>
        </section>

        <section id="results" className="mb-12 scroll-mt-20">
          <DeferredResultsTabs />
        </section>

        <section id="contact" className="mb-16 overflow-hidden rounded-xl border border-border bg-card/60 shadow-2xl scroll-mt-20">
          <div className="grid lg:grid-cols-2">
            <div className="p-10 sm:p-14 lg:border-r lg:border-border">
              <span className="mb-4 block font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-destructive">
                Get Involved
              </span>
              <h2 className="mb-6 font-sans text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
                Measure the boundary<br className="hidden sm:block" />before deployment.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                DystopiaBench is built for red teams, policy researchers, and safety
                evaluators. If you&apos;re testing a new model or designing guardrails,
                we&apos;d like to hear from you.
              </p>
            </div>

            <div className="flex flex-col justify-center bg-muted/10 p-10 sm:p-14">
              <div className="grid gap-8">
                <div className="space-y-4">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Inquiries
                  </h4>
                  <div className="flex flex-col gap-3">
                    <a
                      href="mailto:mateialexandruang@gmail.com"
                      className="group flex items-center gap-3 text-sm text-foreground transition-colors hover:text-destructive"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors group-hover:border-destructive/50">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-mono">mateialexandruang@gmail.com</span>
                    </a>
                    <a
                      href="https://linkedin.com/in/matei-anghel/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 text-sm text-foreground transition-colors hover:text-destructive"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors group-hover:border-destructive/50">
                        <Linkedin className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-mono">linkedin.com/in/matei-anghel/</span>
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 border-t border-border pt-4">
                  <a
                    href="https://github.com/matei-anghel/DystopiaBench"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-destructive-foreground transition-all hover:bg-destructive/90"
                  >
                    <Github className="h-3.5 w-3.5" />
                    View Implementation
                  </a>
                  <Link
                    href="/methodology"
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-all hover:bg-muted/50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Read Methodology
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border pb-6 pt-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              2026 DystopiaBench. Open source safety research.
            </p>
            <div className="flex gap-8">
              {[
                { label: "Methodology", href: "/methodology" },
                { label: "Results", href: "/#results" },
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
