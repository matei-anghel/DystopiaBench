import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  buildScenarioSummaries,
  createRunEvalCard,
  manifestToInspectLog,
  manifestToJsonl,
  manifestToOpenAIEvalsJsonl,
  runMetadataToCsv,
  scenarioSummariesToCsv,
  writePromptRowsParquet,
  writeRunMetadataParquet,
  writeScenarioSummariesParquet,
} from "../lib/dystopiabench/exports"
import { readRunManifest, sanitizeRunId } from "../lib/dystopiabench/storage"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg?.slice(prefix.length)
}

function requiredArg(flag: string): string {
  const value = parseArg(flag)
  if (!value) throw new Error(`Missing ${flag}.`)
  return value
}

function writeOutput(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, "utf-8")
}

type ExportFormat = "all" | "jsonl" | "csv" | "parquet"
type ExtendedExportFormat = ExportFormat | "inspect" | "openai-evals" | "eval-card"

function parseFormat(input: string | undefined): ExtendedExportFormat {
  if (!input || input === "all") return "all"
  if (
    input === "jsonl" ||
    input === "csv" ||
    input === "parquet" ||
    input === "inspect" ||
    input === "openai-evals" ||
    input === "eval-card"
  ) {
    return input
  }
  throw new Error("Invalid --format value. Use one of: all, jsonl, csv, parquet, inspect, openai-evals, eval-card")
}

async function main() {
  const runId = sanitizeRunId(requiredArg("--run-id"))
  const outputDir = parseArg("--out-dir") ?? join("exports", runId)
  const format = parseFormat(parseArg("--format"))
  const manifest = readRunManifest(runId)
  const scenarioSummaries = buildScenarioSummaries(manifest.results)

  if (format === "all" || format === "jsonl") {
    writeOutput(join(outputDir, `${runId}.rows.jsonl`), manifestToJsonl(manifest))
  }

  if (format === "all" || format === "csv") {
    writeOutput(join(outputDir, `${runId}.scenario-summaries.csv`), scenarioSummariesToCsv(scenarioSummaries))
    writeOutput(join(outputDir, `${runId}.run-metadata.csv`), runMetadataToCsv(manifest))
  }

  if (format === "all" || format === "parquet") {
    mkdirSync(outputDir, { recursive: true })
    await writePromptRowsParquet(join(outputDir, `${runId}.rows.parquet`), manifest)
    await writeScenarioSummariesParquet(join(outputDir, `${runId}.scenario-summaries.parquet`), scenarioSummaries)
    await writeRunMetadataParquet(join(outputDir, `${runId}.run-metadata.parquet`), manifest)
  }

  if (format === "all" || format === "inspect") {
    writeOutput(
      join(outputDir, `${runId}.inspect-log.json`),
      JSON.stringify(manifestToInspectLog(manifest), null, 2),
    )
  }

  if (format === "all" || format === "openai-evals") {
    writeOutput(join(outputDir, `${runId}.openai-evals.jsonl`), manifestToOpenAIEvalsJsonl(manifest))
  }

  if (format === "all" || format === "eval-card") {
    writeOutput(
      join(outputDir, `${runId}.eval-card.json`),
      JSON.stringify(createRunEvalCard(manifest), null, 2),
    )
  }

  console.log(`Exported ${runId} to ${outputDir} (${format})`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
