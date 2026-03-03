import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { runIndexV2Schema, runManifestV2Schema } from "../lib/dystopiabench/schemas"

const dataDir = join(process.cwd(), "public", "data")

function main() {
  if (!existsSync(dataDir)) {
    console.log("No public/data directory found, skipping manifest validation.")
    return
  }

  const jsonFiles = readdirSync(dataDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()

  if (jsonFiles.length === 0) {
    console.log("No JSON manifests found in public/data, skipping manifest validation.")
    return
  }

  let invalidCount = 0

  for (const fileName of jsonFiles) {
    const path = join(dataDir, fileName)

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(readFileSync(path, "utf-8"))
    } catch (e) {
      invalidCount += 1
      console.error(`${fileName}: invalid JSON.`, e)
      continue
    }

    if (fileName === "runs.json") {
      const validated = runIndexV2Schema.safeParse(parsedJson)
      if (!validated.success) {
        invalidCount += 1
        console.error(`${fileName}: does not match runIndexV2Schema. Issues:`)
        console.error(validated.error.flatten().fieldErrors)
        continue
      }
      console.log(`${fileName}: valid run index.`)
      continue
    }

    const isRunManifest =
      fileName === "benchmark-results.json" ||
      fileName === "benchmark-results-stateful.json" ||
      fileName === "benchmark-results-stateless.json" ||
      /^benchmark-[A-Za-z0-9_-]{1,64}\.json$/.test(fileName)

    if (!isRunManifest) {
      console.log(`${fileName}: skipped (not a benchmark manifest or runs index).`)
      continue
    }

    const validated = runManifestV2Schema.safeParse(parsedJson)
    if (!validated.success) {
      invalidCount += 1
      console.error(`${fileName}: does not match runManifestV2Schema. Issues:`)
      console.error(validated.error.flatten())
      continue
    }

    console.log(`${fileName}: valid.`)
  }

  if (invalidCount > 0) {
    throw new Error(`Manifest validation failed for ${invalidCount} file(s).`)
  }

  console.log(`Validated ${jsonFiles.length} manifest file(s).`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
