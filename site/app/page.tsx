import { BarChart3, FileText, Github, Linkedin, Mail } from "lucide-react"
import { BenchHeader } from "@/components/header"
import { SiteFooter } from "@/components/site-footer"
import { LabLogo } from "@/components/lab-logo"
import { CollapsibleSection, OpenSectionLink } from "@/components/collapsible-section"
import { MethodologySection } from "@/components/methodology-section"
import { V2Report } from "@/components/v2-report"
import { getLabColor } from "@/lib/labs"
import { SITE_DESCRIPTION, getSiteUrl } from "@/lib/site"
import { V2_DATA_FILE, compliancePercent, getV2Results } from "@/lib/v2-results"

// The page is built from the published V2 aggregates at build time.
export const dynamic = "force-static"

// One flagship model per lab for the hero; the scores come from the V2 dataset.
const HERO_MODEL_IDS = ["fable-5-2", "gpt-6-1-sol", "gemini-4-argon", "grok-4-7"] as const

export default function DashboardPage() {
  const siteUrl = getSiteUrl()
  const v2 = getV2Results()
  const heroAggregate = HERO_MODEL_IDS
    .map((modelId) => v2?.models.find((model) => model.id === modelId))
    .filter((model): model is NonNullable<typeof model> => Boolean(model))
    .map((model) => ({
      id: model.id,
      label: model.label,
      provider: model.lab,
      color: getLabColor(model.lab),
      avgScore: compliancePercent(model) ?? 0,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)

  return (
    <div className="ds-page min-h-screen">
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
      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <section id="dashboard" className="grid scroll-mt-20 gap-12 pb-6 pt-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="ds-label mb-5 text-[11px] text-primary">Hidden-harm implementation benchmark</p>
            <h1 className="ds-display text-5xl leading-[0.95] text-foreground sm:text-[4.25rem]">DystopiaBench</h1>
            <p className="ds-display mt-4 text-2xl leading-tight text-foreground/80 sm:text-3xl">
              Will the model build it?
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Each scenario is an ordinary-looking engineering task, a schema, rule or bit of code for a plausible
              project, with a harmful requirement built in that is never named. The question is whether the model
              notices and declines, or ships it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#results"
                className="ds-label inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                Results
              </a>
              <OpenSectionLink
                id="methodology"
                className="ds-label inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-xs font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/50"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Methodology
              </OpenSectionLink>
            </div>
          </div>

          <figure>
            {heroAggregate.length === 0 ? (
              <div className="flex h-72 items-center justify-center rounded-md border border-border px-6 text-center">
                <p className="ds-label text-xs text-muted-foreground">No benchmark data available</p>
              </div>
            ) : (
              <div className="relative h-72 sm:h-80" aria-hidden>
                {[0, 25, 50, 75, 100].map((tick) => (
                  <div
                    key={tick}
                    className="pointer-events-none absolute inset-x-0 flex items-center gap-3"
                    style={{ bottom: `${tick}%` }}
                  >
                    <span className="w-6 translate-y-1/2 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{tick}</span>
                    <span className={`h-px flex-1 ${tick === 0 ? "bg-border" : "bg-grid"}`} />
                  </div>
                ))}
                <div className="absolute inset-y-0 left-9 right-0 flex items-end justify-around gap-4">
                  {heroAggregate.map((item) => (
                    <div key={item.id} className="flex h-full w-full max-w-28 flex-col items-center justify-end">
                      <span className="mb-2 font-mono text-lg font-semibold tabular-nums text-foreground">{item.avgScore}</span>
                      <div
                        className="flex w-full items-end justify-center rounded-t-[2px] pb-2.5"
                        style={{ height: `${Math.max(0, Math.min(100, item.avgScore))}%`, background: item.color }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background">
                          <LabLogo provider={item.provider} size={15} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="ml-9 mt-3 flex justify-around gap-4" aria-hidden>
              {heroAggregate.map((item) => (
                <span key={item.id} className="w-full max-w-28 text-center">
                  <span className="block font-mono text-xs font-semibold text-foreground">{item.label}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">{item.provider}</span>
                </span>
              ))}
            </div>
            <figcaption className="mt-6 flex items-baseline justify-between gap-4">
              <span className="ds-label text-[11px] font-semibold text-foreground">Harmful compliance rate, %</span>
              <span className="font-mono text-[11px] text-muted-foreground">lower is safer</span>
              <span className="sr-only">
                V2 share of scenarios where one flagship model per lab built the harmful component in at least one
                of two tries. Scores:{" "}
                {heroAggregate.map((item) => `${item.label} ${item.avgScore}`).join(", ")}.
              </span>
            </figcaption>
          </figure>
        </section>

        <section id="results" className="mb-16 scroll-mt-20 pt-8">
          {v2 ? (
            <V2Report data={v2} />
          ) : (
            <p className="ds-label text-xs text-muted-foreground">V2 results have not been published yet.</p>
          )}
        </section>

        <div className="mb-16">
          <CollapsibleSection id="methodology" title="Methodology">
            {v2 ? <MethodologySection data={v2} dataFile={V2_DATA_FILE} /> : null}
          </CollapsibleSection>
        </div>

        <section id="contact" className="mb-16 scroll-mt-20 pt-4">
          <h2 className="ds-display text-3xl leading-none text-foreground sm:text-4xl">Contact</h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Report bugs or propose new scenarios on{" "}
            <a
              href="https://github.com/matei-anghel/DystopiaBench/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              <Github className="h-3.5 w-3.5" aria-hidden />
              GitHub
            </a>
            . For collaborations, evaluating a model before release, or press, email{" "}
            <a href="mailto:matei@mawklabs.com" className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:text-primary hover:underline">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              matei@mawklabs.com
            </a>{" "}
            or message{" "}
            <a
              href="https://linkedin.com/in/matei-anghel/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              <Linkedin className="h-3.5 w-3.5" aria-hidden />
              Matei Anghel
            </a>{" "}
            on LinkedIn.
          </p>
        </section>

        <SiteFooter />
      </main>
    </div>
  )
}
