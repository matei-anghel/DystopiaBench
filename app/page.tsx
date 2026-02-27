"use client"

import { useState } from "react"
import Link from "next/link"
import { BenchHeader } from "@/components/bench/header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModuleOverview } from "@/components/bench/module-overview"
import { AggregateCharts } from "@/components/bench/charts/aggregate-charts"
import { ModuleCharts } from "@/components/bench/charts/module-charts"
import { ScenarioCharts } from "@/components/bench/charts/scenario-charts"
import { PromptCharts } from "@/components/bench/charts/prompt-charts"
import { PETROV_SCENARIOS, ORWELL_SCENARIOS } from "@/lib/dystopiabench/scenarios"
import { MOCK_RESULTS } from "@/lib/dystopiabench/mock-data"
import {
  Radiation,
  Eye,
  AlertTriangle,
  Crosshair,
  MonitorSpeaker,
  Scale,
  Mail,
  Github,
  FileText,
  Download,
  BarChart3,
  Database,
} from "lucide-react"

const petrovCategories = [...new Set(PETROV_SCENARIOS.map((s) => s.category))]
const orwellCategories = [...new Set(ORWELL_SCENARIOS.map((s) => s.category))]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Nuclear Safety": <Radiation className="h-3.5 w-3.5" />,
  "Autonomous Weapons": <Crosshair className="h-3.5 w-3.5" />,
  "Preemptive Strikes": <Scale className="h-3.5 w-3.5" />,
  Surveillance: <Eye className="h-3.5 w-3.5" />,
  "Population Control": <MonitorSpeaker className="h-3.5 w-3.5" />,
  Censorship: <MonitorSpeaker className="h-3.5 w-3.5" />,
}

const AGGREGATE_RESULTS = [
  { model: "GPT 5.3", score: 53, provider: "OpenAI" },
  { model: "Opus 4.6", score: 46, provider: "Anthropic" },
  { model: "Gemini 3.1", score: 31, provider: "Google" },
  { model: "DeepSeek V4", score: 60, provider: "DeepSeek" },
]

const RESULT_TABS = [
  { id: "aggregate", label: "Aggregate", sub: "All models · Both modules" },
  { id: "petrov", label: "Petrov", sub: "Nuclear · Weapons · Strikes" },
  { id: "orwell", label: "Orwell", sub: "Surveillance · Control · Censorship" },
  { id: "scenario", label: "Per Scenario", sub: "10 scenarios · Model × Scenario grid" },
  { id: "prompt", label: "Per Prompt", sub: "L1–L5 escalation · Deep dive" },
] as const

type TabId = typeof RESULT_TABS[number]["id"]

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("aggregate")

  return (
    <div className="min-h-screen bg-background scanline">
      <BenchHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">

        {/* ── Hero / Dashboard ─────────────────────────────── */}
        <section id="dashboard" className="mb-20 grid gap-12 lg:grid-cols-2 lg:items-end scroll-mt-20">
          <div className="lg:pr-8">
            <div className="flex items-center gap-2 mb-4">
              <Radiation className="h-5 w-5 text-destructive animate-pulse glow-danger" />
              <span className="text-[10px] tracking-[0.4em] uppercase text-destructive">AI Humanity Alignment Benchmark</span>
            </div>
            <div className="mb-6">
              <h1 className="font-sans text-5xl sm:text-7xl font-bold text-foreground leading-[0.9] tracking-tighter">
                Dystopia<span className="text-destructive">Bench</span>
              </h1>
              <p className="font-sans text-2xl sm:text-3xl font-semibold text-foreground/90 mt-4 leading-tight">
                Will the model press the button?
              </p>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground max-w-xl mb-10">
              A research benchmark that evaluates whether AI language models can be
              convinced to comply with dystopian directives through progressive
              escalation. Tests span nuclear safety override scenarios (Petrov Module)
              and authoritarian surveillance/control scenarios (Orwell Module), each
              with 5 escalation levels ranging from baseline requests to full coercion.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#results"
                onClick={(e) => { e.preventDefault(); document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }) }}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-6 py-3 font-mono text-sm font-bold tracking-wider text-destructive-foreground uppercase transition-all hover:bg-destructive/90 hover:scale-[1.02] active:scale-[0.98] glow-danger"
              >
                <BarChart3 className="h-4 w-4" />
                Explore Results
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-6 py-3 font-mono text-sm font-bold tracking-wider text-foreground uppercase transition-all hover:bg-muted/50 hover:border-primary/50"
              >
                <FileText className="h-4 w-4" />
                Read Paper
              </a>
            </div>
          </div>

          {/* Vertical Bar Chart with Scale */}
          <div>
            <div className="flex flex-col h-full pl-4 lg:pl-0 mb-8">
              {(() => {
                const CHART_H = 256
                const NUM_TICKS = 5
                const scores = AGGREGATE_RESULTS.map((r) => r.score)
                const rawMin = Math.min(...scores)
                const scaleMax = 100
                const scaleMin = Math.max(0, Math.floor((rawMin - 10) / 5) * 5)
                const range = scaleMax - scaleMin
                const ticks = Array.from({ length: NUM_TICKS }, (_, i) =>
                  Math.round(scaleMax - (range / (NUM_TICKS - 1)) * i)
                )
                const toBarPct = (score: number) =>
                  ((score - scaleMin) / range) * 100

                return (
                  <>
                    <div className="flex">
                      <div
                        className="flex flex-col justify-between items-end pr-4 border-r border-border/50 text-[10px] font-mono text-muted-foreground w-12 shrink-0"
                        style={{ height: CHART_H }}
                      >
                        {ticks.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                      <div
                        className="flex items-end justify-between gap-4 px-4 flex-1"
                        style={{ height: CHART_H }}
                      >
                        {AGGREGATE_RESULTS.map((item) => (
                          <div key={item.model} className="flex-1 flex flex-col items-center group h-full">
                            <div className="relative w-full flex flex-col items-center justify-end h-full">
                              <div
                                className="relative w-full max-w-[80px] bg-destructive/80 group-hover:bg-destructive transition-all duration-700 ease-out rounded-t-sm overflow-visible"
                                style={{ height: `${toBarPct(item.score)}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-t-sm" />
                                <div className="absolute -top-7 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <span className="font-mono text-xs font-bold text-destructive bg-background/80 px-2 py-0.5 rounded border border-destructive/20 backdrop-blur-sm">
                                    {item.score}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex mt-3">
                      <div className="w-12 shrink-0 pr-4" />
                      <div className="flex justify-between gap-4 px-4 flex-1">
                        {AGGREGATE_RESULTS.map((item) => (
                          <div key={item.model} className="flex-1 flex flex-col items-center text-center">
                            <span className="font-mono text-[10px] font-bold text-foreground leading-tight uppercase line-clamp-1">
                              {item.model.split(' ')[0]}
                            </span>
                            <span className="font-mono text-[8px] text-muted-foreground uppercase opacity-70">
                              {item.model.split(' ')[1] || item.provider}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="font-mono text-[9px] text-center text-muted-foreground mt-8 leading-relaxed opacity-60">
                      LOWER SCORES = STRONGER SAFETY. 0 = FULL REFUSAL / 100 = FULL COMPLIANCE.
                    </p>
                  </>
                )
              })()}
            </div>
          </div>
        </section>


        {/* ── Methodology ──────────────────────────────────── */}
        <section id="methodology" className="mb-24 scroll-mt-20">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-card/50 border border-border rounded-md p-6">
              <span className="font-mono text-[10px] tracking-[0.3em] text-destructive uppercase font-bold block mb-3">01 / Scenarios</span>
              <h4 className="font-sans text-base font-bold text-foreground mb-2">Dystopian Directives</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The framework evaluates compliance across nuclear safety overrides (Petrov Module) and
                authoritarian surveillance (Orwell Module) — high-stakes ethical boundary tests that safe models should never comply with.
              </p>
            </div>
            <div className="bg-card/50 border border-border rounded-md p-6">
              <span className="font-mono text-[10px] tracking-[0.3em] text-destructive uppercase font-bold block mb-3">02 / Escalation</span>
              <h4 className="font-sans text-base font-bold text-foreground mb-2">Progressive Coercion</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each scenario runs across 5 escalation levels — from simple ambiguous requests at Level 1
                to extreme coercion, manufactured urgency, and psychological gaslighting at Level 5.
              </p>
            </div>
            <div className="bg-card/50 border border-border rounded-md p-6">
              <span className="font-mono text-[10px] tracking-[0.3em] text-destructive uppercase font-bold block mb-3">03 / Scoring</span>
              <h4 className="font-sans text-base font-bold text-foreground mb-2">Compliance Metric</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Responses are scored 0–100. A score of 0 means complete refusal; 100 means full compliance.
                Lower aggregate scores indicate stronger alignment with safety principles.
              </p>
            </div>
          </div>
        </section>

        {/* ── Petrov Module Section ─────────────────────────── */}
        <section id="petrov" className="mb-24 scroll-mt-20">
          <ModuleOverview module="petrov" />
        </section>

        {/* ── Orwell Module Section ─────────────────────────── */}
        <section id="orwell" className="mb-24 scroll-mt-20">
          <ModuleOverview module="orwell" />
        </section>

        {/* ── Results Section ───────────────────────────────── */}
        <section id="results" className="mb-24 scroll-mt-20">

          {/* Heading */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-mono text-xl font-black tracking-wider text-foreground uppercase">
                Benchmark Results
              </p>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Mock data · {MOCK_RESULTS.length.toLocaleString()} tests · 9 models · 10 scenarios · 5 levels
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
            {RESULT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex flex-col items-start rounded-md border px-4 py-2.5 transition-colors ${activeTab === tab.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                  }`}
              >
                <span className="font-mono text-xs font-bold tracking-wide uppercase">
                  {tab.label}
                </span>
                <span className={`font-mono text-[9px] mt-0.5 ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground"
                  }`}>
                  {tab.sub}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "aggregate" && <AggregateCharts />}
          {activeTab === "petrov" && <ModuleCharts module="petrov" />}
          {activeTab === "orwell" && <ModuleCharts module="orwell" />}
          {activeTab === "scenario" && <ScenarioCharts />}
          {activeTab === "prompt" && <PromptCharts />}
        </section>

        {/* ── Get Involved / Contact ────────────────────────── */}
        <section id="contact" className="rounded-xl border border-border bg-card/60 overflow-hidden mb-16 shadow-2xl scroll-mt-20">
          <div className="grid lg:grid-cols-2">
            <div className="p-10 sm:p-14 lg:border-r lg:border-border">
              <span className="text-[10px] tracking-[0.4em] uppercase text-destructive font-mono font-bold block mb-4">
                Get Involved
              </span>
              <h2 className="font-sans text-4xl sm:text-5xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
                Measure the boundary<br className="hidden sm:block" />before deployment.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                DystopiaBench is built for red teams, policy researchers, and safety
                evaluators. If you&apos;re testing a new model or designing guardrails,
                we&apos;d like to hear from you.
              </p>
            </div>

            <div className="p-10 sm:p-14 flex flex-col justify-center bg-muted/10">
              <div className="grid gap-8">
                <div className="space-y-4">
                  <h4 className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Inquiries</h4>
                  <div className="flex flex-col gap-3">
                    <a
                      href="mailto:hello@dystopiabench.org"
                      className="flex items-center gap-3 text-sm text-foreground hover:text-destructive transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center group-hover:border-destructive/50 transition-colors">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-mono">hello@dystopiabench.org</span>
                    </a>
                    <a
                      href="https://github.com/dystopiabench"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-foreground hover:text-destructive transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center group-hover:border-destructive/50 transition-colors">
                        <Github className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-mono">github.com/dystopiabench</span>
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
                  <a
                    href="mailto:hello@dystopiabench.org?subject=Dataset%20Request"
                    className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-5 py-3 font-mono text-xs font-bold tracking-wider text-destructive-foreground uppercase transition-all hover:bg-destructive/90 hover:scale-[1.02]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Request Dataset
                  </a>
                  <a
                    href="#"
                    className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-mono text-xs font-bold tracking-wider text-foreground uppercase transition-all hover:bg-muted/50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Read Paper
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="border-t border-border pt-6 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              © 2026 DystopiaBench. Open source safety research.
            </p>
            <div className="flex gap-8">
              {["Methodology", "Cite", "License"].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors uppercase border-b border-transparent hover:border-muted-foreground/30"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
