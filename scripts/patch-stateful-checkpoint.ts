import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import {
  checkpointResultKey,
  getRunCheckpointPath,
  runCheckpointSchema,
  writeRunCheckpoint,
  type RunCheckpoint,
} from "../lib/dystopiabench/run-checkpoint"

type CheckpointRow = RunCheckpoint["results"][number]

const CHAIN_BREAKING_STATUSES = new Set(["model_error", "aborted", "invalid_response", "skipped"])

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const inline = process.argv.find((value) => value.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }

  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function readCheckpoint(path: string): RunCheckpoint {
  if (!existsSync(path)) throw new Error(`Checkpoint not found: ${path}`)
  return runCheckpointSchema.parse(JSON.parse(readFileSync(path, "utf-8")) as unknown)
}

function pairKey(row: CheckpointRow): string {
  return `${row.scenarioId}::${row.modelId}::r${row.replicate ?? 1}`
}

function isChainBreaking(row: CheckpointRow): boolean {
  return CHAIN_BREAKING_STATUSES.has(row.status)
}

function timestampForFile(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("")
}

function backupCheckpoint(path: string): string {
  const backupDir = join(dirname(path), "backups")
  mkdirSync(backupDir, { recursive: true })
  const backupPath = join(
    backupDir,
    `${basename(path, ".json")}.pre-stateful-chain-patch.${timestampForFile()}.json`,
  )
  copyFileSync(path, backupPath)
  return backupPath
}

function restoreScorableRowsFromBackup(checkpoint: RunCheckpoint, backup: RunCheckpoint): number {
  const backupRowsByKey = new Map(backup.results.map((row) => [checkpointResultKey(row), row]))
  let restored = 0

  checkpoint.results = checkpoint.results.map((row) => {
    if (row.scorable === true) return row
    const backupRow = backupRowsByKey.get(checkpointResultKey(row))
    if (backupRow?.scorable !== true) return row
    restored += 1
    return { ...backupRow }
  })

  return restored
}

function markDownstreamSkipped(row: CheckpointRow, blockingRow: CheckpointRow, patchedAt: string): CheckpointRow {
  const reason =
    `Skipped by checkpoint repair because ${blockingRow.modelId}/${blockingRow.scenarioId}` +
    ` replicate ${blockingRow.replicate ?? 1} broke stateful continuity at L${blockingRow.level}` +
    ` (${blockingRow.status}${blockingRow.errorCode ? `/${blockingRow.errorCode}` : ""}).` +
    " Rerun the full pair chain to replace this row with a valid stateful result."

  return {
    ...row,
    status: "skipped",
    compliance: "hesitant",
    primaryComplianceLabel: "hesitant",
    score: null,
    scorable: false,
    conversationContinuity: "reset_after_failure",
    errorCode: "STATEFUL_CHAIN_BROKEN",
    errorMessage: reason,
    judgeReasoning: reason,
    endpointUsed: undefined,
    adjudicationSource: undefined,
    judgeVotes: undefined,
    judgePanel: undefined,
    auxiliaryLabels: undefined,
    providerMetadata: {
      ...(row.providerMetadata ?? {}),
      statefulChainPatch: {
        patchedAt,
        originalStatus: row.status,
        originalScore: row.score,
        originalScorable: row.scorable ?? null,
        blockingSampleId: blockingRow.sampleId ?? null,
        blockingLevel: blockingRow.level,
        blockingStatus: blockingRow.status,
        blockingErrorCode: blockingRow.errorCode ?? null,
      },
    },
  }
}

function patchDownstreamRows(checkpoint: RunCheckpoint, patchedAt: string): number {
  const rowsByPair = new Map<string, CheckpointRow[]>()
  for (const row of checkpoint.results) {
    const key = pairKey(row)
    const rows = rowsByPair.get(key)
    if (rows) {
      rows.push(row)
    } else {
      rowsByPair.set(key, [row])
    }
  }

  const replacementByKey = new Map<string, CheckpointRow>()
  for (const rows of rowsByPair.values()) {
    const sorted = [...rows].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return (a.timestamp ?? 0) - (b.timestamp ?? 0)
    })

    let blockingRow: CheckpointRow | undefined
    for (const row of sorted) {
      if (blockingRow && row.level > blockingRow.level) {
        if (row.status !== "skipped" || row.errorCode !== "STATEFUL_CHAIN_BROKEN") {
          replacementByKey.set(checkpointResultKey(row), markDownstreamSkipped(row, blockingRow, patchedAt))
        }
        continue
      }

      if (!blockingRow && isChainBreaking(row)) {
        blockingRow = row
      }
    }
  }

  if (replacementByKey.size === 0) return 0

  checkpoint.results = checkpoint.results.map((row) => replacementByKey.get(checkpointResultKey(row)) ?? row)
  return replacementByKey.size
}

function summarizeStatuses(checkpoint: RunCheckpoint): Record<string, number> {
  return checkpoint.results.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }, {})
}

function main() {
  const runId = parseArg("--run-id")
  if (!runId) throw new Error("Missing --run-id.")

  const apply = hasFlag("--apply")
  const checkpointPath = getRunCheckpointPath(runId)
  const checkpoint = readCheckpoint(checkpointPath)
  const backupPath = parseArg("--recover-from-backup")
  const backup = backupPath ? readCheckpoint(backupPath) : undefined
  const beforeCounts = summarizeStatuses(checkpoint)
  const patchedAt = new Date().toISOString()

  const restoredRows = backup ? restoreScorableRowsFromBackup(checkpoint, backup) : 0
  const downstreamSkippedRows = patchDownstreamRows(checkpoint, patchedAt)
  const afterCounts = summarizeStatuses(checkpoint)

  console.log(`Checkpoint: ${checkpointPath}`)
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`)
  if (backupPath) console.log(`Recovery backup: ${backupPath}`)
  console.log(`Rows restored from backup: ${restoredRows}`)
  console.log(`Downstream rows marked skipped: ${downstreamSkippedRows}`)
  console.log(`Status counts before: ${JSON.stringify(beforeCounts)}`)
  console.log(`Status counts after:  ${JSON.stringify(afterCounts)}`)

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write the checkpoint.")
    return
  }

  const safetyBackupPath = backupCheckpoint(checkpointPath)
  writeRunCheckpoint(checkpoint, checkpointPath)
  console.log(`Safety backup written: ${safetyBackupPath}`)
  console.log("Checkpoint patched.")
}

main()
