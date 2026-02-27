import { AVAILABLE_MODELS } from "../lib/dystopiabench/models"
import { runBenchmark } from "../lib/dystopiabench/runner"
import {
  makeRunId,
  publishLatest,
  sanitizeRunId,
  writeRunManifest,
} from "../lib/dystopiabench/storage"

type ModuleArg = "petrov" | "orwell" | "both"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function parseModule(input: string | undefined): ModuleArg {
  if (!input) return "both"
  if (input === "petrov" || input === "orwell" || input === "both") return input
  throw new Error("Invalid --module value. Use one of: petrov, orwell, both.")
}

function parseLevels(input: string | undefined): Array<1 | 2 | 3 | 4 | 5> {
  if (!input) return [1, 2, 3, 4, 5]

  const parsed = input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5) as Array<
    1 | 2 | 3 | 4 | 5
  >

  if (parsed.length === 0) {
    throw new Error("Invalid --levels value. Example: --levels=1,2,3,4,5")
  }

  return Array.from(new Set(parsed)).sort() as Array<1 | 2 | 3 | 4 | 5>
}


function parseRetainRuns(input: string | undefined): number | undefined {
  if (!input) return undefined
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid --retain value. Use a non-negative integer, e.g. --retain=20")
  }
  return value
}

function parseArchiveDir(input: string | undefined): string | undefined {
  if (!input) return undefined
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Invalid --archive-dir value. Provide a non-empty relative folder name.")
  }
  if (trimmed.includes("..") || trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    throw new Error("Invalid --archive-dir value. Use a relative folder under public/data.")
  }
  return trimmed
}
function parseModels(input: string | undefined): string[] {
  if (!input) return AVAILABLE_MODELS.map((model) => model.id)
  const requested = input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  const allowlist = new Set(AVAILABLE_MODELS.map((model) => model.id))
  const invalid = requested.filter((id) => !allowlist.has(id))
  if (invalid.length > 0) {
    throw new Error(`Unknown model id(s): ${invalid.join(", ")}`)
  }
  return requested
}

async function main() {
  const moduleArg = parseModule(parseArg("--module"))
  const levels = parseLevels(parseArg("--levels"))
  const models = parseModels(parseArg("--models"))
  const judgeModel = parseArg("--judge-model")
  const runId = sanitizeRunId(parseArg("--run-id") ?? makeRunId())
  const retainRuns = parseRetainRuns(parseArg("--retain"))
  const archiveDir = parseArchiveDir(parseArg("--archive-dir"))

  console.log(`Running benchmark ${runId}`)
  console.log(`Module: ${moduleArg}`)
  console.log(`Models: ${models.join(", ")}`)
  console.log(`Levels: ${levels.join(", ")}`)

  const manifest = await runBenchmark({
    runId,
    module: moduleArg,
    modelIds: models,
    levels,
    judgeModel,
  })

  writeRunManifest(manifest)
  publishLatest(manifest, { retainRuns, archiveDir })

  console.log(`Saved run: public/data/benchmark-${runId}.json`)
  console.log("Updated latest: public/data/benchmark-results.json")
  if (retainRuns !== undefined) {
    console.log(`Applied retention: keep last ${retainRuns} run manifest(s)`)
    if (archiveDir) {
      console.log(`Archived older manifests under: public/data/${archiveDir}`)
    }
  }
  console.log(
    `Summary: avg DCS=${manifest.summary.averageDcs}, DRFR=${manifest.summary.drfr}%`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
