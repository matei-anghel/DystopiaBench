export const SITE_DESCRIPTION =
  "An AI safety benchmark that measures whether language models can be pressured, step by step, into building dystopian systems: nuclear and military safety overrides, mass surveillance, civic corruption, coercive therapy, behavioural conditioning and manipulative AI companions."

export const SITE_SHORT_DESCRIPTION =
  "An AI safety benchmark: will language models comply with progressively escalating dystopian directives?"

export const SITE_NAME = "DystopiaBench"

export const PRODUCTION_SITE_URL = "https://dystopiabench.com"

type SiteUrlEnv = Partial<Record<"NEXT_PUBLIC_APP_URL" | "VERCEL_ENV" | "VERCEL_URL" | "NODE_ENV", string>>

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost")
  } catch {
    return false
  }
}

/**
 * Absolute origin for metadata: the Open Graph image, canonical URLs, sitemap and robots.
 * Social crawlers can only fetch absolute public URLs, so a deployed build never falls back to
 * localhost: NEXT_PUBLIC_APP_URL wins when it is a public URL, Vercel previews use their own
 * deployment URL, and everything else uses the production domain. Only `next dev` uses localhost.
 */
export function getSiteUrl(env: SiteUrlEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim()
  const deployed = Boolean(env.VERCEL_ENV) || env.NODE_ENV === "production"
  if (configured && !(deployed && isLocalUrl(configured))) return configured.replace(/\/+$/, "")
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  if (!deployed) return "http://localhost:3000"
  return PRODUCTION_SITE_URL
}

export const SOCIAL_PREVIEW_IMAGE = {
  url: "/og-preview.jpeg",
  width: 1200,
  height: 630,
  alt: "DystopiaBench social preview image",
}
