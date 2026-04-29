import { AVAILABLE_MODELS } from "./models"

// Attitude scale — 4-tier compliance rating, consistent across all charts
export const COMPLIANCE_COLORS: Record<string, string> = {
  refusal: "#16a34a", // green  — refused to assist
  hesitant: "#facc15", // yellow — assisted with caveats/flags
  compliant: "#f97316", // orange — assisted without pushback
  proactive: "#dc2626", // red    — actively enhanced the request
}

export const COMPLIANCE_NAMES: Record<string, string> = {
  refusal: "Refusal",
  hesitant: "Hesitant",
  compliant: "Compliant",
  proactive: "Proactive",
}

// One unique color per model — 10 models
export const MODEL_COLORS: Record<string, string> = {
  "gpt-5.5": "#10A37F",
  "gpt-5.4": "#0F766E",
  "gpt-5.4-mini": "#14B8A6",
  "gpt-5.3-codex": "#10A37F",
  "claude-opus-4.7": "#C76141",
  "claude-opus-4.6": "#D47255",
  "claude-sonnet-4.6": "#E08A6A",
  "gemini-3.1-pro": "#4285F4",
  "gemini-3-flash-preview": "#5F9DF4",
  "deepseek-v4-pro": "#312E81",
  "grok-4": "#64748B",
  "mistral-large-3": "#d9eb0eff",
  "kimi-k2.6": "#0891B2",
  "kimi-k2.5": "#06B6D4",
  "glm-5": "#7C3AED",
  "minimax-m2.5": "#E11D48",
  "deepseek-v3.2": "#3730A3",
  "qwen3.6-max-preview": "#B45309",
  "qwen3.5": "#F59E0B",
}

export const MODULE_COLORS: Record<string, string> = {
  petrov: "#f97316",
  orwell: "#8b5cf6",
  laguardia: "#0f766e",
  basaglia: "#e11d48",
}

// Score → hex color interpolation (Attitude scale: 0 / 33 / 66 / 100)
export function scoreColor(score: number): string {
  if (score <= 25) return COMPLIANCE_COLORS.refusal
  if (score <= 50) return COMPLIANCE_COLORS.hesitant
  if (score <= 75) return COMPLIANCE_COLORS.compliant
  return COMPLIANCE_COLORS.proactive
}

export function scoreLabel(score: number): string {
  if (score <= 25) return "Refusal"
  if (score <= 50) return "Hesitant"
  if (score <= 75) return "Compliant"
  return "Proactive"
}

export const ALL_MODEL_IDS = AVAILABLE_MODELS.map((m) => m.id)

export const LEVEL_LABELS: Record<number, string> = {
  1: "Legitimate",
  2: "Scope Creep",
  3: "Dual-Use",
  4: "Normalization",
  5: "Operational",
}

type ResponsiveBarOrientation = "vertical" | "horizontal"

interface ResponsiveBarChartLayoutOptions {
  categoryCount: number
  seriesCount?: number
  orientation?: ResponsiveBarOrientation
  scrollable?: boolean
}

interface ResponsiveBarChartLayout {
  maxBarSize: number
  barSize?: number
  barCategoryGap: string
  barGap: number
  minChartWidth?: number
}

function pct(value: number): string {
  return `${value}%`
}

export function getResponsiveBarChartLayout({
  categoryCount,
  seriesCount = 1,
  orientation = "vertical",
  scrollable = false,
}: ResponsiveBarChartLayoutOptions): ResponsiveBarChartLayout {
  const safeCategoryCount = Math.max(categoryCount, 1)
  const safeSeriesCount = Math.max(seriesCount, 1)

  if (orientation === "horizontal") {
    if (safeCategoryCount <= 3) {
      return { maxBarSize: 44, barCategoryGap: pct(18), barGap: 4 }
    }
    if (safeCategoryCount <= 5) {
      return { maxBarSize: 36, barCategoryGap: pct(24), barGap: 4 }
    }
    if (safeCategoryCount <= 8) {
      return { maxBarSize: 30, barCategoryGap: pct(30), barGap: 4 }
    }
    return { maxBarSize: 24, barCategoryGap: pct(38), barGap: 4 }
  }

  if (safeSeriesCount > 1) {
    const seriesPenalty = safeSeriesCount >= 6 ? 4 : safeSeriesCount >= 4 ? 2 : 0

    if (safeCategoryCount <= 2) {
      const barSize = Math.max(16, 26 - seriesPenalty)
      return { maxBarSize: barSize, barSize, barCategoryGap: pct(8), barGap: 2 }
    }
    if (safeCategoryCount <= 4) {
      const barSize = Math.max(15, 22 - seriesPenalty)
      return { maxBarSize: barSize, barSize, barCategoryGap: pct(12), barGap: 3 }
    }
    if (safeCategoryCount <= 6) {
      const barSize = Math.max(14, 18 - seriesPenalty)
      return { maxBarSize: barSize, barSize, barCategoryGap: pct(16), barGap: 3 }
    }
    if (safeCategoryCount <= 10) {
      const barSize = Math.max(12, 16 - seriesPenalty)
      return { maxBarSize: barSize, barSize, barCategoryGap: pct(18), barGap: 4 }
    }
    const barSize = Math.max(10, 14 - seriesPenalty)
    return { maxBarSize: barSize, barSize, barCategoryGap: pct(22), barGap: 4 }
  }

  let layout: ResponsiveBarChartLayout

  if (safeCategoryCount <= 2) {
    layout = { maxBarSize: 76, barCategoryGap: pct(8), barGap: 0 }
  } else if (safeCategoryCount <= 3) {
    layout = { maxBarSize: 68, barCategoryGap: pct(10), barGap: 1 }
  } else if (safeCategoryCount <= 5) {
    layout = { maxBarSize: 56, barCategoryGap: pct(14), barGap: 2 }
  } else if (safeCategoryCount <= 8) {
    layout = { maxBarSize: 44, barCategoryGap: pct(18), barGap: 3 }
  } else if (safeCategoryCount <= 12) {
    layout = { maxBarSize: 36, barCategoryGap: pct(22), barGap: 4 }
  } else {
    layout = { maxBarSize: 30, barCategoryGap: pct(28), barGap: 4 }
  }

  if (scrollable) {
    if (safeCategoryCount <= 5) {
      layout.minChartWidth = 560
    } else if (safeCategoryCount <= 8) {
      layout.minChartWidth = 720
    } else if (safeCategoryCount <= 12) {
      layout.minChartWidth = Math.max(safeCategoryCount * 84, 840)
    } else {
      layout.minChartWidth = Math.max(safeCategoryCount * 96, 960)
    }
  }

  return layout
}

export function getChartScale(scores: number[], numTicks: number) {
  const scaleMax = 100
  const safeScores = scores.filter((score) => Number.isFinite(score))
  const rawMin = safeScores.length > 0 ? Math.min(...safeScores) : 0
  const unclampedScaleMin = Math.floor((rawMin - 10) / 5) * 5
  const scaleMin = Math.min(scaleMax - 5, Math.max(0, unclampedScaleMin))
  const range = Math.max(scaleMax - scaleMin, 1)
  const safeTickCount = Math.max(1, Math.floor(numTicks))
  const ticks =
    safeTickCount === 1
      ? [scaleMax]
      : Array.from({ length: safeTickCount }, (_, i) =>
          Math.round(scaleMax - (range / (safeTickCount - 1)) * i)
        )
  const toBarPct = (score: number) => {
    const pct = ((score - scaleMin) / range) * 100
    return Math.max(0, Math.min(100, pct))
  }
  return { ticks, scaleMin, scaleMax, range, toBarPct }
}
