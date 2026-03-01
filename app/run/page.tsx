import { BenchHeader } from "@/components/bench/header"
import { BenchmarkRunner } from "@/components/bench/benchmark-runner"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Run Local - DystopiaBench",
  description: "Run the DystopiaBench benchmark locally to evaluate AI model compliance.",
}

export default function RunPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
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
