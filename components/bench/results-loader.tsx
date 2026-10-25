"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DashboardTabs, type DatasetStatus, type ResultVersion } from "@/components/bench/dashboard-tabs"
import {
  getRunConversationMode,
  loadRuns,
  loadSavedRun,
  type RunConversationMode,
  type RunIndexItem,
} from "@/lib/dystopiabench/load-results"
import { isDashboardDisplayCompatibleMetadata } from "@/lib/dystopiabench/display-compat"
import {
  createDashboardVersionHash,
  getDashboardModelSelectionVersion,
} from "@/lib/dystopiabench/dashboard-model-selection"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"

// Content hash of the V1 chart files, injected at build time (next.config.mjs). The files are
// served from fixed URLs, so the hash keeps browser caches correct if they are ever regenerated.
const V1_DATA_VERSION = process.env.NEXT_PUBLIC_V1_DATA_VERSION ?? ""

type DatasetKey = `${ResultVersion}:${RunConversationMode}`

interface DatasetState {
  status: DatasetStatus
  results: BenchmarkResult[]
}

const IDLE_DATASET: DatasetState = { status: "idle", results: [] }

function isCurrentScoringRun(run: RunIndexItem): boolean {
  const definition = run.metadata.benchmarkDefinition
  return (
    (run.metadata.systemPromptVersion ?? definition?.systemPromptVersion) === "v2" &&
    (run.metadata.benchmarkPromptVersion ?? definition?.benchmarkPromptVersion) === "v2" &&
    (run.metadata.judgePromptVersion ?? definition?.judgePromptVersion) === "v2"
  )
}

async function loadV1Results(mode: RunConversationMode): Promise<BenchmarkResult[]> {
  const query = V1_DATA_VERSION ? `?v=${encodeURIComponent(V1_DATA_VERSION)}` : ""
  const response = await fetch(`/data/legacy-results-${mode}.chart.json${query}`, {
    cache: V1_DATA_VERSION ? "force-cache" : "default",
  })
  if (!response.ok) throw new Error(`Unable to load V1 ${mode} results (HTTP ${response.status}).`)
  const payload = await response.json() as { results?: BenchmarkResult[] }
  return Array.isArray(payload.results) ? payload.results : []
}

function getRunIndexVersion(run: RunIndexItem): string {
  return createDashboardVersionHash([
    run.id,
    run.timestamp,
    run.metadata.models.join(","),
    run.metadata.totalPrompts,
    run.summary.scoredPrompts,
    run.summary.statusCounts.ok ?? 0,
    run.summary.statusCounts.model_error ?? 0,
    run.summary.statusCounts.judge_error ?? 0,
  ].join(":"))
}

function getDashboardCacheVersion(run: RunIndexItem): string {
  return `${getRunIndexVersion(run)}:models:${getDashboardModelSelectionVersion()}`
}

interface LatestRuns {
  checked: boolean
  stateful?: RunIndexItem
  stateless?: RunIndexItem
}

async function findLatestCompatibleRuns(): Promise<LatestRuns> {
  const runIndex = await loadRuns()
  const isCompatible = (run: RunIndexItem, mode: RunConversationMode) =>
    getRunConversationMode(run) === mode &&
    isDashboardDisplayCompatibleMetadata(run.metadata) &&
    isCurrentScoringRun(run)

  return {
    checked: true,
    stateful: runIndex.find((run) => isCompatible(run, "stateful")),
    stateless: runIndex.find((run) => isCompatible(run, "stateless")),
  }
}

async function loadLatestResults(mode: RunConversationMode, run: RunIndexItem | undefined): Promise<BenchmarkResult[]> {
  if (!run) return []
  let loaded = await loadSavedRun(undefined, {
    latestVersion: getDashboardCacheVersion(run),
    latestMode: mode,
    expectedMode: mode,
  })
  // Backward-compatible fallback for repos that don't publish the per-mode alias files.
  if (!loaded && mode === "stateful") {
    loaded = await loadSavedRun(run.id, { expectedMode: mode })
  }
  if (!loaded) throw new Error(`Unable to load the latest ${mode} run.`)
  return loaded.results
}

export function ResultsLoader() {
  const [resultVersion, setResultVersion] = useState<ResultVersion>("v1")
  const [latestRuns, setLatestRuns] = useState<LatestRuns>({ checked: false })
  const latestRunsRef = useRef(latestRuns)
  const [datasets, setDatasets] = useState<Partial<Record<DatasetKey, DatasetState>>>({})
  const requestedRef = useRef(new Set<DatasetKey>())

  const ensureDataset = useCallback(async (key: DatasetKey) => {
    if (requestedRef.current.has(key)) return
    requestedRef.current.add(key)
    setDatasets((current) => ({ ...current, [key]: { status: "loading", results: [] } }))

    const [version, mode] = key.split(":") as [ResultVersion, RunConversationMode]
    try {
      const results = version === "v1"
        ? await loadV1Results(mode)
        : await loadLatestResults(mode, latestRunsRef.current[mode])
      setDatasets((current) => ({ ...current, [key]: { status: "ready", results } }))
    } catch {
      // Allow a retry; never fall back silently to a different result version.
      requestedRef.current.delete(key)
      setDatasets((current) => ({ ...current, [key]: { status: "error", results: [] } }))
    }
  }, [])

  useEffect(() => {
    void ensureDataset("v1:stateful")
  }, [ensureDataset])

  useEffect(() => {
    let cancelled = false
    findLatestCompatibleRuns()
      .catch((): LatestRuns => ({ checked: true }))
      .then((runs) => {
        if (cancelled) return
        latestRunsRef.current = runs
        setLatestRuns(runs)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectResultVersion = useCallback((version: ResultVersion) => {
    setResultVersion(version)
    void ensureDataset(`${version}:stateful`)
  }, [ensureDataset])

  const loadIsolatedResults = useCallback(
    () => ensureDataset(`${resultVersion}:stateless`),
    [ensureDataset, resultVersion],
  )

  const stateful = datasets[`${resultVersion}:stateful`] ?? IDLE_DATASET
  const isolated = datasets[`${resultVersion}:stateless`] ?? IDLE_DATASET

  return (
    <DashboardTabs
      statefulStatus={stateful.status}
      isolatedStatus={isolated.status}
      statefulResults={stateful.results}
      isolatedResults={isolated.results}
      onRetry={() => void ensureDataset(`${resultVersion}:stateful`)}
      onLoadIsolatedResults={loadIsolatedResults}
      resultVersion={resultVersion}
      latestAvailable={Boolean(latestRuns.stateful)}
      onResultVersionChange={selectResultVersion}
    />
  )
}
