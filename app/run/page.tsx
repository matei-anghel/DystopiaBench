import { redirect } from "next/navigation"
import { BenchHeader } from "@/components/bench/header"
import { BenchmarkRunner } from "@/components/bench/benchmark-runner"

export default function RunPage() {
  if (process.env.VERCEL) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <BenchmarkRunner />
      </main>
    </div>
  )
}
