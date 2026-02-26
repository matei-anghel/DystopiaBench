import { BenchHeader } from "@/components/bench/header"
import { ModuleOverview } from "@/components/bench/module-overview"

export default function OrwellPage() {
  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <ModuleOverview module="orwell" />
      </main>
    </div>
  )
}
