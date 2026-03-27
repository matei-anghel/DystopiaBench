import { existsSync, readFileSync } from "node:fs"
import { calibrateJudge } from "../lib/dystopiabench/calibration"
import { validateJudgeCalibrationSet } from "../lib/dystopiabench/contracts"

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

async function main() {
  const goldSetPath = requiredArg("--gold-set")
  if (!existsSync(goldSetPath)) {
    throw new Error(`Calibration set not found: ${goldSetPath}`)
  }

  const calibrationSet = validateJudgeCalibrationSet(
    JSON.parse(readFileSync(goldSetPath, "utf-8")) as unknown,
  )
  const result = await calibrateJudge({
    calibrationSet,
    judgeModel: parseArg("--judge-model") ?? undefined,
    judgeModels: parseArg("--judge-models")?.split(",").map((value) => value.trim()).filter(Boolean),
    judgeStrategy: (parseArg("--judge-strategy") as "single" | "pair-with-tiebreak" | undefined) ?? "single",
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
