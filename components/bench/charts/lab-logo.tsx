import type { DisplayModel } from "@/lib/dystopiabench/display-models"
import { getProviderColor } from "@/lib/dystopiabench/chart-config"
import { getLabLogo } from "@/lib/dystopiabench/lab-logos"

const MONO_LOGO_CLASS = "dark:invert"

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
        style={{ width: size * 0.6, height: size * 0.6, background: getProviderColor(provider) }}
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
export function SvgLabLogo({
  provider,
  cx,
  cy,
  size = 14,
}: {
  provider: string | undefined
  cx: number
  cy: number
  size?: number
}) {
  const logo = getLabLogo(provider)
  if (!logo) {
    return <circle cx={cx} cy={cy} r={size * 0.3} fill={getProviderColor(provider)} />
  }

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

/** Logo + model name, used in tables, grids and lists. */
export function ModelName({
  model,
  size = 12,
  className = "",
  labelClassName = "",
}: {
  model: Pick<DisplayModel, "label" | "provider">
  size?: number
  className?: string
  labelClassName?: string
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} title={`${model.provider} / ${model.label}`}>
      <LabLogo provider={model.provider} size={size} />
      <span className={`truncate ${labelClassName}`}>{model.label}</span>
    </span>
  )
}

/** Legend for line/radar charts: line swatch in the lab colour (dashed per model) + logo + name. */
export function ModelLegend({
  models,
  dashes,
  className = "",
}: {
  models: readonly DisplayModel[]
  dashes?: Map<string, string | undefined>
  className?: string
}) {
  if (models.length === 0) return null
  return (
    <ul className={`mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 ${className}`} aria-label="Legend">
      {models.map((model) => (
        <li key={model.id} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden className="shrink-0">
            <line
              x1="1"
              x2="17"
              y1="4"
              y2="4"
              stroke={model.color}
              strokeWidth="2"
              strokeDasharray={dashes?.get(model.id)}
            />
          </svg>
          <LabLogo provider={model.provider} size={12} />
          <span className="font-mono text-[11px] text-muted-foreground">{model.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface TickProps {
  x?: number
  y?: number
  payload?: { value: string | number }
}

/**
 * X-axis tick for vertical model bar charts (Artificial Analysis style): the lab logo sits at the
 * foot of the bar, with the angled model name underneath. Bind with `dataKey="modelId"`.
 */
export function ModelBarXAxisTick({
  x = 0,
  y = 0,
  payload,
  models,
  logoSize = 14,
  fontSize = 10,
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
        transform={`rotate(-40 ${x} ${y + logoSize + 14})`}
        fill="hsl(var(--muted-foreground))"
        fontSize={fontSize}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  )
}

/**
 * Y-axis tick for horizontal model bar charts: model name, then the lab logo between the name
 * and the start of the bar. Bind with `dataKey="modelId"`.
 */
export function ModelBarYAxisTick({
  x = 0,
  y = 0,
  payload,
  models,
  logoSize = 14,
  fontSize = 10,
}: TickProps & { models: Map<string, DisplayModel>; logoSize?: number; fontSize?: number }) {
  const modelId = String(payload?.value ?? "")
  const model = models.get(modelId)
  const label = model?.label ?? modelId
  return (
    <g>
      <title>{model ? `${model.provider} / ${label}` : label}</title>
      <SvgLabLogo provider={model?.provider} cx={x - logoSize / 2 - 2} cy={y} size={logoSize} />
      <text
        x={x - logoSize - 8}
        y={y}
        dy={3.5}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
        fontSize={fontSize}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  )
}
