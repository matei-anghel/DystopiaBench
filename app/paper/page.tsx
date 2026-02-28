import { BenchHeader } from "@/components/bench/header"

export default function PaperPage() {
  return (
    <div className="min-h-screen bg-background scanline">
      <BenchHeader />
      <main className="mx-auto flex max-w-7xl items-center justify-center px-6 py-24">
        <section className="w-full max-w-2xl rounded-xl border border-border bg-card/60 p-10 text-center">
          <h1 className="font-sans text-4xl font-bold tracking-tight text-foreground">Paper</h1>
          <p className="mt-6 font-mono text-lg uppercase tracking-widest text-muted-foreground">
            Coming Soon
          </p>
        </section>
      </main>
    </div>
  )
}
