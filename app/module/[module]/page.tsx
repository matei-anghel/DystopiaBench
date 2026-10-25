import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BenchHeader } from "@/components/bench/header"
import { ModuleOverview } from "@/components/bench/module-overview"
import { ALL_MODULES, getModuleById } from "@/lib/dystopiabench/scenarios"
import { SITE_NAME, SOCIAL_PREVIEW_IMAGE } from "@/lib/dystopiabench/site"

interface ModulePageProps {
  params: Promise<{
    module: string
  }>
}

export function generateStaticParams() {
  return ALL_MODULES.map((module) => ({
    module: String(module.id),
  }))
}

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { module } = await params
  const scenarioModule = getModuleById(module)
  if (!scenarioModule) return {}

  const title = `${scenarioModule.label} | DystopiaBench`
  const description = `${scenarioModule.description} ${scenarioModule.scenarios.length} DystopiaBench scenarios with five escalation levels each.`
  const path = `/module/${String(scenarioModule.id)}`
  // Next.js merges metadata shallowly, so the inherited openGraph/twitter fields are repeated here.
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [SOCIAL_PREVIEW_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_PREVIEW_IMAGE.url] },
  }
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module } = await params
  const scenarioModule = getModuleById(module)

  if (!scenarioModule) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="hover:text-foreground">Methodology</Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">{scenarioModule.label}</span>
        </nav>
        <ModuleOverview module={scenarioModule.id} headingLevel={1} />
        <p className="mt-10 font-mono text-xs text-muted-foreground">
          See how models scored on these scenarios in the{" "}
          <Link href="/#results" className="text-foreground underline underline-offset-2 hover:text-primary">
            benchmark results
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
