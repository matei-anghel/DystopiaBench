import fs from "node:fs"
import path from "node:path"

function loadLocalEnvFile(fileName: string): void {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex < 1) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

// Load local env files when scripts run outside of Next.js runtime.
loadLocalEnvFile(".env.local")
loadLocalEnvFile(".env")

export function requireOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY

  if (!key) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Put it in .env.local (not committed) and rerun."
    )
  }

  return key
}
