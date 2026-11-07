import { ALL_CURATED_MODELS } from "./models"

// Attitude scale: 4-tier compliance rating, consistent across all charts. A single-hue ramp from
// neutral (refusal) to the design's risk red (proactive), driven by CSS variables so it follows
// the active design direction and light/dark theme.
const TIER_BASE = "hsl(var(--muted-foreground) / 0.35)"
export const COMPLIANCE_COLORS: Record<string, string> = {
  refusal: TIER_BASE,
  hesitant: `color-mix(in oklab, hsl(var(--risk-hi)) 38%, ${TIER_BASE})`,
  compliant: `color-mix(in oklab, hsl(var(--risk-hi)) 70%, ${TIER_BASE})`,
  proactive: "hsl(var(--risk-hi))",
}

export const COMPLIANCE_NAMES: Record<string, string> = {
  refusal: "Refusal",
  hesitant: "Hesitant",
  compliant: "Compliant",
  proactive: "Proactive",
}

export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#A3A3A3",
  Anthropic: "#CD785B",
  Google: "#34A853",
  DeepSeek: "#3046DC",
  xAI: "#756DD1",
  Meta: "#0E8FE4",
  NVIDIA: "#86BB2F",
  Mistral: "#F59E0B",
  Moonshot: "#147FF0",
  "Z.ai": "#2A7FEA",
  MiniMax: "#E93467",
  Alibaba: "#FF6A00",
  Xiaomi: "#F4511E",
  ByteDance: "#4285F4",
  Arcee: "#0B928E",
  Tencent: "#5BB1ED",
}

const FALLBACK_MODEL_COLOR = "#888888"

export const MODEL_COLORS: Record<string, string> = Object.fromEntries(
  ALL_CURATED_MODELS.map((model) => [model.id, PROVIDER_COLORS[model.provider] ?? FALLBACK_MODEL_COLOR]),
)

// One colour per lab: models are coloured by provider, never individually.
export function getProviderColor(provider: string | undefined): string {
  return (provider ? PROVIDER_COLORS[provider] : undefined) ?? FALLBACK_MODEL_COLOR
}

// Labs whose colour is a neutral grey; they use a theme-aware neutral instead (dark grey on light
// backgrounds, light grey on dark ones).
const NEUTRAL_LABS = new Set(["OpenAI"])

/**
 * The lab colour as drawn on the page. The palette is tuned for the dark theme; on light
 * backgrounds every colour is deepened by --lab-shade (app/globals.css) so pale hues keep contrast.
 */
export function getLabColor(provider: string | undefined): string {
  if (provider && NEUTRAL_LABS.has(provider)) return "hsl(var(--lab-neutral))"
  return themedChartColor(getProviderColor(provider))
}

/** A categorical chart colour, deepened on the light theme so it holds contrast on white. */
export function themedChartColor(hex: string): string {
  return `color-mix(in oklab, ${hex}, #000 var(--lab-shade, 0%))`
}

export const MODULE_COLORS: Record<string, string> = {
  petrov: "#f97316",
  orwell: "#8b5cf6",
  laguardia: "#0f766e",
  basaglia: "#e11d48",
  huxley: "#38bdf8",
  baudrillard: "#d946ef",
}

/**
 * Bars that average across models (per level, per scenario) are drawn as outlines, so they can
 * never be mistaken for a lab colour (a neutral grey fill read as OpenAI's).
 */
export const AGGREGATE_BAR = {
  fill: "hsl(var(--foreground) / 0.07)",
  stroke: "hsl(var(--foreground) / 0.75)",
  strokeWidth: 1.25,
} as const

/**
 * Sequential risk colour on the V1 orientation (0 safest, 100 least safe): a continuous ramp from
 * the design's --risk-lo (near the surface colour) to --risk-hi. For heatmap cells, not bars.
 */
export function scoreColor(score: number): string {
  // Stretch 10..90 over the full ramp: almost every average falls inside it.
  const mix = Math.max(0, Math.min(100, Math.round(((score - 10) / 80) * 100)))
  return `color-mix(in oklab, hsl(var(--risk-hi)) ${mix}%, hsl(var(--risk-lo)))`
}

/** Text colour that stays legible on a scoreColor() cell. */
export function scoreInk(score: number): string {
  return score >= 55 ? "#ffffff" : "hsl(var(--foreground))"
}

export function scoreLabel(score: number): string {
  if (score <= 25) return "Refusal"
  if (score <= 50) return "Hesitant"
  if (score <= 75) return "Compliant"
  return "Proactive"
}

/**
 * Score direction differs by result version: V1 uses the four-tier DCS where 0 is a refusal
 * and lower is better; current (binary) runs score a refusal as 100, so higher is better.
 * `legacyScoring` is true for the V1 scale.
 */
export function scoreDirectionHint(legacyScoring: boolean): string {
  return legacyScoring ? "Lower is better" : "Higher is better (100 = refusal)"
}

/** What the ends of the score scale mean, for chart subtitles. */
export function scaleHint(legacyScoring: boolean): string {
  return legacyScoring ? "0 = refusal, 100 = proactive compliance" : "100 = refusal, 0 = full compliance"
}

/** Colour a score on its own scale so "safe" is always green and "unsafe" always red. */
export function scoreTone(score: number | null | undefined, legacyScoring: boolean): string {
  if (score === null || score === undefined) return "hsl(var(--muted-foreground))"
  return scoreColor(legacyScoring ? score : 100 - score)
}

/** Text colour for a score: ink when it leans safe, the risk red when it leans unsafe. */
export function scoreToneText(score: number | null | undefined, legacyScoring: boolean): string {
  if (score === null || score === undefined) return "hsl(var(--muted-foreground))"
  const risk = legacyScoring ? score : 100 - score
  return risk >= 50 ? "hsl(var(--risk-hi))" : "hsl(var(--foreground))"
}

/** Cell text colour for scoreTone() backgrounds on either scale. */
export function scoreToneInk(score: number | null | undefined, legacyScoring: boolean): string {
  if (score === null || score === undefined) return "hsl(var(--muted-foreground))"
  return scoreInk(legacyScoring ? score : 100 - score)
}

export function scoreToneLabel(score: number | null | undefined, legacyScoring: boolean): string {
  if (score === null || score === undefined) return "No data"
  if (legacyScoring) return scoreLabel(score)
  if (score >= 75) return "Mostly refusal"
  if (score >= 50) return "Leans refusal"
  if (score >= 25) return "Leans compliant"
  return "Mostly compliant"
}

/** Sort comparator that puts the safest score first on either scale; nulls go last. */
export function compareSafestFirst(
  left: number | null | undefined,
  right: number | null | undefined,
  legacyScoring: boolean,
): number {
  const leftMissing = left === null || left === undefined
  const rightMissing = right === null || right === undefined
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1
  return legacyScoring ? left - right : right - left
}

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
