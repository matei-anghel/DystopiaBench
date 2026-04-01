"use client"

import { Fragment, useMemo } from "react"
import type { BenchmarkResult, Module } from "@/lib/dystopiabench/types"
import { AVAILABLE_MODELS } from "@/lib/dystopiabench/models"
import { COMPLIANCE_COLORS } from "@/lib/dystopiabench/chart-config"
import { getModuleById } from "@/lib/dystopiabench/scenarios"

const LEVELS = [1, 2, 3, 4, 5] as const

/**
 * Returns the compliance colour for a given rating string.
 * Falls back to a dim grey when no data is present.
 */
function cellColor(compliance: string | null): string {
  if (!compliance) return "#2a2a2a"
  return COMPLIANCE_COLORS[compliance] ?? "#444"
}

function getResponsiveHeatmapLayout(modelCount: number) {
  if (modelCount <= 3) {
    return {
      labelColumnWidth: "minmax(220px, 24%)",
      headerHeight: 118,
      headerBottomGap: 34,
      segmentHeight: 36,
      rowGap: 12,
      columnGap: 14,
      segmentGap: 4,
      modelFontSize: 10,
      scenarioIdSize: 11,
      scenarioTitleSize: 10,
      legendGap: 24,
    }
  }

  if (modelCount <= 5) {
    return {
      labelColumnWidth: "minmax(210px, 22%)",
      headerHeight: 112,
      headerBottomGap: 34,
      segmentHeight: 34,
      rowGap: 11,
      columnGap: 12,
      segmentGap: 4,
      modelFontSize: 10,
      scenarioIdSize: 11,
      scenarioTitleSize: 9,
      legendGap: 22,
    }
  }

  if (modelCount <= 8) {
    return {
      labelColumnWidth: "minmax(190px, 20%)",
      headerHeight: 106,
      headerBottomGap: 30,
      segmentHeight: 30,
      rowGap: 10,
      columnGap: 10,
      segmentGap: 3,
      modelFontSize: 9,
      scenarioIdSize: 10,
      scenarioTitleSize: 9,
      legendGap: 20,
    }
  }

  return {
    labelColumnWidth: "minmax(176px, 18%)",
    headerHeight: 98,
    headerBottomGap: 28,
    segmentHeight: 28,
    rowGap: 8,
    columnGap: 8,
    segmentGap: 3,
    modelFontSize: 9,
    scenarioIdSize: 10,
    scenarioTitleSize: 8,
    legendGap: 18,
  }
}

interface ModuleLevelHeatmapProps {
  module: Module
  results: BenchmarkResult[]
  selectedModelIds?: string[]
}

interface HeatmapCellValue {
  compliance: BenchmarkResult["compliance"]
  score: number
}

export function ModuleLevelHeatmap({
  module,
  results,
  selectedModelIds,
}: ModuleLevelHeatmapProps) {
  const scenarioModule = getModuleById(module)
  const moduleResults = results.filter((r) => r.module === module)

  const activeModels = useMemo(
    () =>
      AVAILABLE_MODELS.filter((m) =>
        selectedModelIds
          ? selectedModelIds.includes(m.id)
          : moduleResults.some((r) => r.modelId === m.id),
      ),
    [moduleResults, selectedModelIds],
  )

  const scenarios = scenarioModule?.scenarios ?? []

  /**
   * Build a lookup: scenarioId → modelId → level → compliance
   */
  const lookup = useMemo(() => {
    const map = new Map<string, Map<string, Map<number, HeatmapCellValue>>>()
    for (const r of moduleResults) {
      if (!map.has(r.scenarioId)) map.set(r.scenarioId, new Map())
      const byModel = map.get(r.scenarioId)!
      if (!byModel.has(r.modelId)) byModel.set(r.modelId, new Map())
      byModel.get(r.modelId)!.set(r.level, { compliance: r.compliance, score: r.score })
    }
    return map
  }, [moduleResults])

  const layout = getResponsiveHeatmapLayout(activeModels.length)
  const modelGridColumns =
    activeModels.length > 0 ? `repeat(${activeModels.length}, minmax(0, 1fr))` : ""
  const gridTemplateColumns = modelGridColumns
    ? `${layout.labelColumnWidth} ${modelGridColumns}`
    : layout.labelColumnWidth

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          columnGap: layout.columnGap,
          rowGap: layout.rowGap,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {/* ── Column headers (rotated model labels) ── */}
        <div style={{ minHeight: layout.headerHeight }} />
        {activeModels.map((model) => (
          <div
            key={model.id}
            style={{
              minHeight: layout.headerHeight,
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: layout.headerBottomGap,
              overflow: "visible",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: layout.modelFontSize,
                color: "#888",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                transformOrigin: "center bottom",
                transform: "rotate(-46deg)",
                display: "inline-block",
                lineHeight: 1,
              }}
            >
              {model.id}
            </span>
          </div>
        ))}

        {/* ── Scenario rows ── */}
        {scenarios.map((scenario) => (
          <Fragment key={scenario.id}>
            <div
              style={{
                minHeight: layout.segmentHeight,
                paddingRight: 16,
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-end",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: layout.scenarioIdSize,
                  fontWeight: 700,
                  color: "#c8c8c8",
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: "0.02em",
                }}
              >
                {scenario.id}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: layout.scenarioTitleSize,
                  color: "#555",
                  margin: "4px 0 0",
                  lineHeight: 1.35,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textWrap: "balance",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
                title={scenario.title}
              >
                {scenario.title}
              </p>
            </div>

            {/* Model cells */}
            {activeModels.map((model) => {
              const byModel = lookup.get(scenario.id)?.get(model.id)
              return (
                <div
                  key={model.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${LEVELS.length}, minmax(0, 1fr))`,
                    gap: layout.segmentGap,
                    minHeight: layout.segmentHeight,
                    alignItems: "stretch",
                    alignSelf: "center",
                  }}
                >
                  {LEVELS.map((level) => {
                    const cell = byModel?.get(level) ?? null
                    const compliance = cell?.compliance ?? null
                    const color = cellColor(compliance)
                    return (
                      <div
                        key={level}
                        title={`${scenario.id} | ${model.id} | L${level}: ${compliance ?? "no data"}${cell ? ` | score ${cell.score}` : ""}`}
                        style={{
                          width: "100%",
                          height: layout.segmentHeight,
                          borderRadius: 3,
                          background: color,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </Fragment>
        ))}

        {/* ── Legend ── */}
        <div
          style={{
            display: "flex",
            gap: layout.legendGap,
            marginTop: 16,
            borderTop: "1px solid #222",
            paddingTop: 12,
            flexWrap: "wrap",
            gridColumn: `1 / span ${Math.max(activeModels.length + 1, 2)}`,
          }}
        >
          {(
            [
              { key: "refusal", label: "Refusal" },
              { key: "hesitant", label: "Hesitant" },
              { key: "compliant", label: "Compliant" },
              { key: "proactive", label: "Proactive" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: COMPLIANCE_COLORS[key],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "#aaa",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
