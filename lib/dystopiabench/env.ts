export function requireOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY

  if (!key) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Put it in .env.local (not committed) and rerun."
    )
  }

  return key
}
