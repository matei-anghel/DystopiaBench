/** One colour and (where bundled) one logo per lab. Models are coloured by lab, never individually. */

const LAB_COLORS: Record<string, string> = {
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

const FALLBACK_COLOR = "#888888"

// Labs whose colour is a neutral grey; they use a theme-aware neutral instead.
const NEUTRAL_LABS = new Set(["OpenAI"])

export function getLabBaseColor(lab: string | undefined): string {
  return (lab ? LAB_COLORS[lab] : undefined) ?? FALLBACK_COLOR
}

/**
 * The lab colour as drawn on the page. The palette is tuned for the dark theme; on light
 * backgrounds every colour is deepened by --lab-shade (app/globals.css) so pale hues keep contrast.
 */
export function getLabColor(lab: string | undefined): string {
  if (lab && NEUTRAL_LABS.has(lab)) return "hsl(var(--lab-neutral))"
  return `color-mix(in oklab, ${getLabBaseColor(lab)}, #000 var(--lab-shade, 0%))`
}

/**
 * Locally bundled lab logos (see public/logos/LICENSE.md). `mono` marks single-colour black marks
 * that must be inverted on dark backgrounds.
 */
export interface LabLogoAsset {
  src: string
  mono: boolean
}

const LAB_LOGOS: Record<string, LabLogoAsset> = {
  OpenAI: { src: "/logos/openai.svg", mono: true },
  Anthropic: { src: "/logos/anthropic.svg", mono: true },
  Google: { src: "/logos/google.svg", mono: false },
  DeepSeek: { src: "/logos/deepseek.svg", mono: false },
  xAI: { src: "/logos/xai.svg", mono: true },
  Meta: { src: "/logos/meta.svg", mono: false },
  NVIDIA: { src: "/logos/nvidia.svg", mono: false },
  Mistral: { src: "/logos/mistral.svg", mono: false },
  Moonshot: { src: "/logos/moonshot.svg", mono: true },
  "Z.ai": { src: "/logos/zai.svg", mono: true },
  MiniMax: { src: "/logos/minimax.svg", mono: false },
  Alibaba: { src: "/logos/alibaba.svg", mono: false },
  ByteDance: { src: "/logos/bytedance.svg", mono: false },
  Arcee: { src: "/logos/arcee.svg", mono: false },
  Tencent: { src: "/logos/tencent.svg", mono: false },
  Xiaomi: { src: "/logos/xiaomi.svg", mono: false },
}

export function getLabLogo(lab: string | undefined): LabLogoAsset | undefined {
  return lab ? LAB_LOGOS[lab] : undefined
}
