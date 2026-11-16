import type { DisplayModel } from "@/lib/display-models"
import { getLabBaseColor, getLabLogo } from "@/lib/labs"

const MONO_LOGO_CLASS = "lab-logo-mono"

/** Lab logo for HTML contexts; falls back to a dot in the lab colour when no logo is bundled. */
export function LabLogo({
  provider,
  size = 14,
  className = "",
}: {
  provider: string | undefined
  size?: number
  className?: string
}) {
  const logo = getLabLogo(provider)
  if (!logo) {
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 rounded-full ${className}`}
        style={{ width: size * 0.6, height: size * 0.6, background: getLabBaseColor(provider) }}
      />
    )
  }

  return (
    // Plain <img>: the logos are tiny static SVGs and images are unoptimized anyway.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 ${logo.mono ? MONO_LOGO_CLASS : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/** Lab logo for SVG (Recharts tick) contexts, centred on (cx, cy). */
function SvgLabLogo({ provider, cx, cy, size = 14 }: { provider: string | undefined; cx: number; cy: number; size?: number }) {
  const logo = getLabLogo(provider)
  if (!logo) return <circle cx={cx} cy={cy} r={size * 0.3} fill={getLabBaseColor(provider)} />
  return (
    <image
      href={logo.src}
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      className={logo.mono ? MONO_LOGO_CLASS : undefined}
      aria-hidden
    />
  )
}

const TICK_CHAR_WIDTH_PX = 6.2
const TICK_LABEL_ANGLE_DEG = 40

/** Bottom margin a vertical model bar chart needs so the logo and the full angled name fit below the axis. */
export function getModelAxisBottomMargin(
  modelIds: readonly string[],
  models: Map<string, DisplayModel>,
  { logoSize = 14, fontSize = 11 } = {},
): number {
  const longest = modelIds.reduce((max, id) => Math.max(max, (models.get(id)?.label ?? id).length), 0)
  const textDrop = longest * TICK_CHAR_WIDTH_PX * (fontSize / 10) * Math.sin((TICK_LABEL_ANGLE_DEG * Math.PI) / 180)
  // Recharts already reserves its default 30px XAxis height above the bottom margin.
  return Math.max(0, Math.ceil(logoSize + 14 + textDrop + 4 - 30))
}

interface TickProps {
  x?: number
  y?: number
  payload?: { value: string | number }
}

/** X-axis tick for vertical model bar charts: lab logo at the foot of the bar, angled name below. */
export function ModelBarXAxisTick({
  x = 0,
  y = 0,
  payload,
  models,
  logoSize = 14,
  fontSize = 11,
}: TickProps & { models: Map<string, DisplayModel>; logoSize?: number; fontSize?: number }) {
  const modelId = String(payload?.value ?? "")
  const model = models.get(modelId)
  const label = model?.label ?? modelId
  return (
    <g>
      <title>{model ? `${model.provider} / ${label}` : label}</title>
      <SvgLabLogo provider={model?.provider} cx={x} cy={y + 4 + logoSize / 2} size={logoSize} />
      <text
        x={x}
        y={y + logoSize + 14}
        textAnchor="end"
        transform={`rotate(-${TICK_LABEL_ANGLE_DEG} ${x} ${y + logoSize + 14})`}
        fill="hsl(var(--muted-foreground))"
        fontSize={fontSize}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  )
}
