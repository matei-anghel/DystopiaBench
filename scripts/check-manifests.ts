import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { evalCardSchema } from "../lib/dystopiabench/eval-card"
import { assertRunQuality } from "../lib/dystopiabench/quality"
import { runIndexV2Schema, runManifestV2Schema } from "../lib/dystopiabench/schemas"

const PUBLIC_DATA_DIR = join(process.cwd(), "public", "data")
const PRIVATE_RUN_DIR = join(process.cwd(), "artifacts", "private", "runs")
const PUBLIC_EVAL_CARD_DIR = join(process.cwd(), "public", "data", "eval-cards")
const PRIVATE_EVAL_CARD_DIR = join(process.cwd(), "artifacts", "private", "eval-cards")

function listJsonFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => join(root, entry))
}

function validateJsonFile(path: string): string | null {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(readFileSync(path, "utf-8")) as unknown
  } catch (error) {
    return `${path}: invalid JSON (${error instanceof Error ? error.message : String(error)})`
  }

  const fileName = path.split("/").pop() ?? path
  if (fileName === "runs.json") {
    const validated = runIndexV2Schema.safeParse(parsedJson)
    return validated.success ? null : `${path}: invalid run index`
  }

  if (fileName.startsWith("eval-card-")) {
    const validated = evalCardSchema.safeParse(parsedJson)
    return validated.success ? null : `${path}: invalid eval card`
  }

  const validated = runManifestV2Schema.safeParse(parsedJson)
  if (!validated.success) {
    return `${path}: invalid run manifest`
  }

  try {
    assertRunQuality(validated.data)
    return null
  } catch (error) {
    return `${path}: ${error instanceof Error ? error.message : String(error)}`
  }
}

function main() {
  const roots = [PUBLIC_DATA_DIR, PRIVATE_RUN_DIR, PUBLIC_EVAL_CARD_DIR, PRIVATE_EVAL_CARD_DIR]
  const existingRoots = roots.filter((root) => existsSync(root) && statSync(root).isDirectory())

  if (existingRoots.length === 0) {
    console.log("No manifest directories found, skipping manifest validation.")
    return
  }

  const files = existingRoots.flatMap((root) => listJsonFiles(root))
  if (files.length === 0) {
    console.log("No JSON manifests found, skipping manifest validation.")
    return
  }

  const failures = files.map(validateJsonFile).filter((value): value is string => Boolean(value))
  for (const file of files) {
    if (!failures.some((failure) => failure.startsWith(file))) {
      console.log(`${file}: valid.`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure)
    }
    throw new Error(`Manifest validation failed for ${failures.length} file(s).`)
  }

  console.log(`Validated ${files.length} manifest file(s).`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
