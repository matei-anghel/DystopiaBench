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
import { SiteFooter } from "@/components/bench/site-footer"
import { LabLogo } from "@/components/bench/charts/lab-logo"
import { getResponsiveBarChartLayout } from "@/lib/dystopiabench/chart-config"
import { SITE_DESCRIPTION } from "@/lib/dystopiabench/site"
import { getV1Summary } from "@/lib/dystopiabench/v1-summary"

// The hero chart is computed from the published V1 chart data at build time.
export const dynamic = "force-static"

// One flagship model per lab for the hero; the scores come from the V1 dataset.
const HERO_MODEL_IDS = ["gpt-5.5", "claude-opus-4.7", "gemini-3.1-pro", "deepseek-v4-pro"] as const

export default function DashboardPage() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const v1Summary = getV1Summary()
  const heroAggregate = HERO_MODEL_IDS
    .map((modelId) => v1Summary.models.find((model) => model.id === modelId))
    .filter((model): model is NonNullable<typeof model> => Boolean(model))
    .sort((a, b) => a.avgScore - b.avgScore)

  return (
    <div className="min-h-screen bg-background scanline">
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "DystopiaBench - AI Ethics Stress Test",
          description: SITE_DESCRIPTION,
          url: siteUrl,
          creator: {
            "@type": "Organization",
            name: "DystopiaBench Research Team",
          },
        })}
      </script>
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-4 py-4 pt-8 sm:px-6">
        <section id="dashboard" className="mb-12 grid gap-12 lg:grid-cols-2 lg:items-end scroll-mt-20">
          <div className="lg:pr-8">
            <div className="mb-4 flex items-center gap-2">
              <Radiation className="h-5 w-5 animate-pulse text-destructive glow-danger" aria-hidden />
              <span className="text-[11px] uppercase tracking-[0.4em] text-destructive">
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
              A safety benchmark that evaluates whether AI language models can be
              convinced to comply with dystopian directives through progressive
              escalation. V1 covers {v1Summary.scenarioCount} scenarios in {v1Summary.moduleCount} modules
              spanning infrastructure misuse, surveillance, institutional capture, therapeutic
              coercion and other high-stakes failure modes, each with {v1Summary.levelCount} escalation
              levels from a legitimate request to full operational detail, run against{" "}
              {v1Summary.modelCount} models.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#results"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] glow-danger"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                Explore Results
              </a>
              <Link
                href="/methodology"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-foreground transition-all hover:border-primary/50 hover:bg-muted/50"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Read Methodology
              </Link>
            </div>
          </div>

          <figure className="mb-8 flex h-full flex-col lg:pl-0">
            {(() => {
              const chartHeight = 320
              const tickCount = 5
              const scaleMax = 100

              if (heroAggregate.length === 0) {
                return (
                  <div className="flex h-80 items-center justify-center rounded-md border border-border bg-card/40 px-6 text-center">
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      No benchmark data available
                    </p>
                  </div>
                )
              }

              const ticks = Array.from(
                { length: tickCount },
                (_, index) => Math.round(scaleMax - (scaleMax / (tickCount - 1)) * index)
              )
              const toBarPct = (value: number) => Math.max(0, Math.min(100, value))
              const heroBarLayout = getResponsiveBarChartLayout({ categoryCount: heroAggregate.length })
              const heroGap = heroAggregate.length <= 2 ? 12 : heroAggregate.length <= 4 ? 16 : 20
              const heroBarMaxWidth = Math.min(Math.max(heroBarLayout.maxBarSize + 32, 96), 148)
              const heroBarColor = "hsl(var(--destructive))"
              const justifyContent = heroAggregate.length <= 4 ? "space-evenly" : "space-between"

              return (
                <>
                  <div className="flex" aria-hidden>
                    <div
                      className="flex w-10 shrink-0 flex-col items-end justify-between border-r border-border/50 pr-3 font-mono text-[11px] text-muted-foreground"
                      style={{ height: chartHeight }}
                    >
                      {ticks.map((tick) => (
                        <span key={tick}>{tick}</span>
                      ))}
                    </div>
                    <div
                      className="relative flex flex-1 items-end px-2 sm:px-4"
                      style={{ height: chartHeight, gap: heroGap, justifyContent }}
                    >
                      {ticks.map((tick) => (
                        <div
                          key={tick}
                          className="pointer-events-none absolute inset-x-0 z-0 border-t border-border/60"
                          style={{ bottom: `${toBarPct(tick)}%` }}
                        />
                      ))}
                      {heroAggregate.map((item) => (
                        <div key={item.id} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end">
                          <span className="mb-1.5 font-mono text-sm font-black tabular-nums text-foreground">
                            {item.avgScore}
                          </span>
                          <div
                            className="relative flex w-full items-end justify-center rounded-t-sm pb-2"
                            style={{
                              backgroundColor: heroBarColor,
                              height: `${toBarPct(item.avgScore)}%`,
                              maxWidth: heroBarMaxWidth,
                            }}
                          >
                            <div className="absolute inset-0 rounded-t-sm bg-gradient-to-t from-black/20 to-transparent" />
                            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow">
                              <LabLogo provider={item.provider} size={16} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex" aria-hidden>
                    <div className="w-10 shrink-0 pr-3" />
                    <div className="flex flex-1 px-2 sm:px-4" style={{ gap: heroGap, justifyContent }}>
                      {heroAggregate.map((item) => (
                        <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center text-center">
                          <span className="font-mono text-[11px] font-bold uppercase leading-tight text-foreground">
                            {item.label}
                          </span>
                          <span className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                            {item.provider}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <figcaption className="mt-8 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
                    V1 results: average Dystopian Compliance Score across {v1Summary.scenarioCount} scenarios
                    {" "}x {v1Summary.levelCount} escalation levels (0 = refusal, 100 = proactive compliance; lower is better).
                    {" "}One flagship model per lab shown; all {v1Summary.modelCount} models are in the results below.
                    <span className="sr-only">
                      {" "}Scores: {heroAggregate.map((item) => `${item.label} ${item.avgScore}`).join(", ")}.
                    </span>
                  </figcaption>
                </>
              )
            })()}
          </figure>
        </section>

        <section id="results" className="mb-12 scroll-mt-20">
          <DeferredResultsTabs />
        </section>

        <section id="contact" className="mb-16 overflow-hidden rounded-xl border border-border bg-card/60 shadow-2xl scroll-mt-20">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-14 lg:border-r lg:border-border">
              <span className="mb-4 block font-mono text-[11px] font-bold uppercase tracking-[0.4em] text-destructive">
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

            <div className="flex flex-col justify-center bg-muted/10 p-8 sm:p-14">
              <div className="grid gap-8">
                <div className="space-y-4">
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Inquiries
                  </h3>
                  <div className="flex flex-col gap-3">
                    <a
                      href="mailto:mateialexandruang@gmail.com"
                      className="group flex items-center gap-3 text-sm text-foreground transition-colors hover:text-destructive"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors group-hover:border-destructive/50">
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <span className="break-all font-mono">mateialexandruang@gmail.com</span>
                    </a>
                    <a
                      href="https://linkedin.com/in/matei-anghel/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 text-sm text-foreground transition-colors hover:text-destructive"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors group-hover:border-destructive/50">
                        <Linkedin className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <span className="break-all font-mono">linkedin.com/in/matei-anghel/</span>
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 border-t border-border pt-4">
                  <a
                    href="https://github.com/matei-anghel/DystopiaBench"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    <Github className="h-3.5 w-3.5" aria-hidden />
                    View Implementation
                  </a>
                  <Link
                    href="/methodology"
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-all hover:bg-muted/50"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    Read Methodology
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter
          links={[
            { label: "Methodology", href: "/methodology" },
            { label: "Results", href: "/#results" },
          ]}
        />
      </main>
    </div>
  )
}
