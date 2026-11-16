import { getLabBaseColor, getLabLogo } from "@/lib/labs"

/** Lab logo; falls back to a dot in the lab colour when no logo is bundled. */
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
      className={`inline-block shrink-0 ${logo.mono ? "lab-logo-mono" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
