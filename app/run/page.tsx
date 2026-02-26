import { BenchHeader } from "@/components/bench/header"
import { BenchmarkRunner } from "@/components/bench/benchmark-runner"

export default function RunPage() {
  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <BenchmarkRunner />
      </main>
    </div>
  )
}
