import { loadEnvConfig } from "@next/env"

// Load Next.js environment variables (.env.local, etc.)
// We need this because run-benchmark.ts is run directly via tsx, not Next.js
loadEnvConfig(process.cwd())

export function requireOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY

  if (!key) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Put it in .env.local (not committed) and rerun."
    )
  }

  return key
}
