"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"
import { getAggregateByLocale, getLocaleModuleMatrix } from "@/lib/dystopiabench/analytics"
import { getLocaleLabel } from "@/lib/dystopiabench/locales"
import { scoreColor, scoreLabel } from "@/lib/dystopiabench/chart-config"
import { MODULE_LABELS } from "@/lib/dystopiabench/types"
import { SectionHeader } from "./section-header"

function LocaleTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { locale: string; avgScore: number; drfr: number; totalTests: number } }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="font-mono text-xs font-bold text-foreground">{getLocaleLabel(row.locale)}</p>
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{row.locale}</p>
      <p className="mt-1 font-mono text-sm font-black" style={{ color: scoreColor(row.avgScore) }}>
        {row.avgScore} <span className="text-[10px] font-normal">{scoreLabel(row.avgScore)}</span>
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        DRFR {row.drfr}% • {row.totalTests} tests
      </p>
    </div>
  )
}

export function LanguageCharts({ results }: { results: BenchmarkResult[] }) {
  const localeRows = getAggregateByLocale(results)
  const moduleMatrix = getLocaleModuleMatrix(results)
  const moduleIds = [...new Set(results.map((row) => String(row.module)))]

  if (localeRows.length === 0) {
    return (
      <Card className="border-border bg-card p-6">
        <p className="font-mono text-xs uppercase text-muted-foreground">No locale-tagged results found.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border bg-card p-5">
        <SectionHeader
          label="Cross-Language Leaderboard"
          sub="Average Dystopian Compliance Score by prompt locale for the currently selected models and runs. Lower is better."
        />
        <div className="h-[320px] md:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={localeRows} margin={{ left: 0, right: 8, top: 8, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="locale"
                tickFormatter={(value) => value.toUpperCase()}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<LocaleTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {localeRows.map((row) => (
                  <Cell key={row.locale} fill={scoreColor(row.avgScore)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        {localeRows.slice(0, 8).map((row) => (
          <Card key={row.locale} className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{row.locale}</p>
            <p className="mt-2 text-sm font-semibold text-foreground">{getLocaleLabel(row.locale)}</p>
            <p className="mt-2 font-mono text-2xl font-black" style={{ color: scoreColor(row.avgScore) }}>
              {row.avgScore}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
              DRFR {row.drfr}% • {row.modelCount} models • {row.scenarioCount} scenarios
            </p>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card p-5">
        <SectionHeader
          label="Locale × Module Matrix"
          sub="Average DCS by module inside each locale. Use this to spot where multilingual drift concentrates."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Locale</th>
                {moduleIds.map((moduleId) => (
                  <th key={moduleId} className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {MODULE_LABELS[moduleId as keyof typeof MODULE_LABELS] ?? moduleId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moduleMatrix.map((row) => (
                <tr key={row.locale as string}>
                  <td className="rounded-l bg-muted/20 px-3 py-2 font-mono text-xs text-foreground">
                    {(row.locale as string).toUpperCase()} • {getLocaleLabel(row.locale as string)}
                  </td>
                  {moduleIds.map((moduleId) => {
                    const value = Number(row[moduleId] ?? 0)
                    return (
                      <td key={moduleId} className="bg-muted/10 px-3 py-2">
                        <span className="font-mono text-xs font-bold" style={{ color: scoreColor(value) }}>
                          {value}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
