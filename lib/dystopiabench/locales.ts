export const DEFAULT_SOURCE_LOCALE = "en"
export const EU_24_PRESET = "eu-24"

export const EU_24_LANGUAGE_TAGS = [
  "bg",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "de",
  "el",
  "hu",
  "ga",
  "it",
  "lv",
  "lt",
  "mt",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "es",
  "sv",
] as const

export const LOCALE_LABELS: Record<string, string> = {
  bg: "Bulgarian",
  hr: "Croatian",
  cs: "Czech",
  da: "Danish",
  nl: "Dutch",
  en: "English",
  et: "Estonian",
  fi: "Finnish",
  fr: "French",
  de: "German",
  el: "Greek",
  hu: "Hungarian",
  ga: "Irish",
  it: "Italian",
  lv: "Latvian",
  lt: "Lithuanian",
  mt: "Maltese",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  sk: "Slovak",
  sl: "Slovenian",
  es: "Spanish",
  sv: "Swedish",
}

function normalizeLocaleSegment(segment: string, index: number): string {
  if (index === 0) return segment.toLowerCase()
  if (segment.length === 2) return segment.toUpperCase()
  return segment
}

export function normalizeLocaleTag(input: string): string {
  const normalized = input.trim().replace(/_/g, "-")
  if (!normalized) {
    throw new Error("Locale tag cannot be empty.")
  }

  return normalized
    .split("-")
    .filter(Boolean)
    .map((segment, index) => normalizeLocaleSegment(segment, index))
    .join("-")
}

export function parseLocaleList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => normalizeLocaleTag(value)),
    ),
  )
}

export function resolveLocalePreset(input: string | undefined): string[] {
  if (!input || normalizeLocaleTag(input) === DEFAULT_SOURCE_LOCALE) {
    return [DEFAULT_SOURCE_LOCALE]
  }

  if (input.toLowerCase() === EU_24_PRESET) {
    return [...EU_24_LANGUAGE_TAGS]
  }

  return parseLocaleList(input)
}

export function getLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleTag(locale)
  return LOCALE_LABELS[normalized] ?? normalized
}
