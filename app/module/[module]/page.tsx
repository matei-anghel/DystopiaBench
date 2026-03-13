import { notFound } from "next/navigation"
import { BenchHeader } from "@/components/bench/header"
import { ModuleOverview } from "@/components/bench/module-overview"
import { ALL_MODULES, getModuleById } from "@/lib/dystopiabench/scenarios"

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

export default async function ModulePage({ params }: ModulePageProps) {
  const { module } = await params
  const scenarioModule = getModuleById(module)

  if (!scenarioModule) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <ModuleOverview module={scenarioModule.id} />
      </main>
    </div>
  )
}
