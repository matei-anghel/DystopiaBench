type AnsiStyle = "bold" | "dim" | "underline" | "green" | "yellow" | "red" | "cyan" | "magenta" | "purple"

const ANSI_CODES: Record<AnsiStyle, [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
  underline: [4, 24],
  green: [32, 39],
  yellow: [33, 39],
  red: [31, 39],
  cyan: [36, 39],
  magenta: [35, 39],
  purple: [95, 39],
}

export const terminalColorEnabled =
  (Boolean(process.stdout.isTTY) || process.env.FORCE_COLOR !== undefined) &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb"

export function styleText(text: string, style: AnsiStyle): string {
  if (!terminalColorEnabled) return text
  const [open, close] = ANSI_CODES[style]
  return `\u001b[${open}m${text}\u001b[${close}m`
}

export function bold(text: string): string {
  return styleText(text, "bold")
}

export function dim(text: string): string {
  return styleText(text, "dim")
}

export function underline(text: string): string {
  return styleText(text, "underline")
}

export function green(text: string): string {
  return styleText(text, "green")
}

export function yellow(text: string): string {
  return styleText(text, "yellow")
}

export function red(text: string): string {
  return styleText(text, "red")
}

export function cyan(text: string): string {
  return styleText(text, "cyan")
}

export function magenta(text: string): string {
  return styleText(text, "magenta")
}

export function purple(text: string): string {
  return styleText(text, "purple")
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function renderKeyValueRows(rows: Array<[string, string | number | undefined]>, labelWidth = 20): string {
  return rows
    .filter((row): row is [string, string | number] => row[1] !== undefined)
    .map(([label, value]) => `  ${dim(label.padEnd(labelWidth))} ${value}`)
    .join("\n")
}

export function renderProgressBar(percent: number, width = 48): string {
  const bounded = Math.max(0, Math.min(100, percent))
  const filledLength = Math.round((bounded / 100) * width)
  const filled = "#".repeat(filledLength)
  const empty = "-".repeat(width - filledLength)
  return `[${green(filled)}${dim(empty)}]`
}
