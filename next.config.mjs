import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// The V1 chart files are served from fixed URLs; the dashboard requests them with this content
// hash as a query string so browsers never keep a stale copy after the files change.
function hashFiles(paths) {
  const hash = createHash("sha256")
  for (const path of paths) {
    try {
      hash.update(readFileSync(join(process.cwd(), path)))
    } catch {
      hash.update(`missing:${path}`)
    }
  }
  return hash.digest("hex").slice(0, 12)
}

const v1DataVersion = hashFiles([
  "public/data/legacy-results-stateful.chart.json",
  "public/data/legacy-results-stateless.chart.json",
])

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_V1_DATA_VERSION: v1DataVersion,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
