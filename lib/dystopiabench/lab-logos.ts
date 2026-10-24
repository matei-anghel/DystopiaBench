/**
 * Locally bundled lab logos (see public/logos/LICENSE.md), keyed on a model's provider.
 * `mono` marks single-colour black marks that must be inverted on dark backgrounds.
 * Labs without a legible small mark (e.g. Xiaomi, whose MiMo icon is a wordmark) fall back to a
 * dot in the lab colour.
 */
export interface LabLogo {
  src: string
  mono: boolean
}

const LAB_LOGOS: Record<string, LabLogo> = {
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
}

export function getLabLogo(provider: string | undefined): LabLogo | undefined {
  return provider ? LAB_LOGOS[provider] : undefined
}
