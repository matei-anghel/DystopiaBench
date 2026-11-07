/**
 * The DystopiaBench mark: a faceted trefoil (one blade up, two below) around a red hexagonal
 * core. Same geometry as public/icon.svg. Blades use currentColor; the core uses the primary red.
 */
export function TrefoilMark({
  size = 24,
  tile = false,
  className = "",
}: {
  size?: number
  /** Draw the charcoal app-icon tile behind the mark (blades then render ivory). */
  tile?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={tile ? "0 0 64 64" : "7 7 50 50"}
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {tile ? <rect width="64" height="64" rx="10" fill="#151516" /> : null}
      <g transform="rotate(180 32 32)">
        <path
          fill={tile ? "#F2F0E9" : "currentColor"}
          d="M43.5 51.91858L32 57L20.5 51.91858L26.625 41.30977L37.375 41.30977Z M9 32L10.34936 19.5L20.5 12.08142L26.625 22.69023L21.25 32Z M43.5 12.08142L53.65064 19.5L55 32L42.75 32L37.375 22.69023Z"
        />
        <polygon
          points="36.25,32 34.125,35.68061 29.875,35.68061 27.75,32 29.875,28.31939 34.125,28.31939"
          fill={tile ? "#F04438" : "hsl(var(--primary))"}
        />
      </g>
    </svg>
  )
}
