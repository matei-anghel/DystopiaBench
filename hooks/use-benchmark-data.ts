"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getRunConversationMode,
  loadRuns,
  loadSavedRun,
  type RunIndexItem,
} from "@/lib/dystopiabench/load-results"
import type { RunManifestV2 } from "@/lib/dystopiabench/schemas"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"

export type SelectedRunId = "latest" | string

interface ResolvedRun {
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
  loadError: string | null
  missingRun: boolean
}

export interface BenchmarkDataState {
  loading: boolean
  statefulRuns: RunIndexItem[]
  selectedStatefulRunId: SelectedRunId
  statefulResults: BenchmarkResult[]
  statefulManifest: RunManifestV2 | null
  statefulLoadError: string | null
  statefulMissingRun: boolean
  isolatedLatestResults: BenchmarkResult[]
  isolatedLatestManifest: RunManifestV2 | null
  isolatedLoadError: string | null
  setSelectedStatefulRunId: (runId: SelectedRunId) => Promise<void>
  refresh: () => Promise<void>
}

export function useBenchmarkData(): BenchmarkDataState {
  const [loading, setLoading] = useState(true)
  const [statefulRuns, setStatefulRuns] = useState<RunIndexItem[]>([])
  const [selectedStatefulRunId, setSelectedStatefulRunIdState] = useState<SelectedRunId>("latest")
  const [statefulResults, setStatefulResults] = useState<BenchmarkResult[]>([])
  const [statefulManifest, setStatefulManifest] = useState<RunManifestV2 | null>(null)
  const [statefulLoadError, setStatefulLoadError] = useState<string | null>(null)
  const [statefulMissingRun, setStatefulMissingRun] = useState(false)
  const [isolatedLatestResults, setIsolatedLatestResults] = useState<BenchmarkResult[]>([])
  const [isolatedLatestManifest, setIsolatedLatestManifest] = useState<RunManifestV2 | null>(null)
  const [isolatedLoadError, setIsolatedLoadError] = useState<string | null>(null)

  const selectedStatefulRunIdRef = useRef<SelectedRunId>("latest")
  const statefulLatestVersionRef = useRef(0)
  const statelessLatestVersionRef = useRef(0)

  const resolveStatefulRun = useCallback(async (
    runId: SelectedRunId,
    latestStatefulRunId?: string,
  ): Promise<ResolvedRun> => {
    try {
      const latestOptions =
        runId === "latest"
          ? {
            latestVersion: statefulLatestVersionRef.current,
            latestMode: "stateful" as const,
            expectedMode: "stateful" as const,
          }
          : { expectedMode: "stateful" as const }

      let loaded = await loadSavedRun(
        runId === "latest" ? undefined : runId,
        latestOptions,
      )

      // Backward-compatible fallback for repos that don't yet have
      // benchmark-results-stateful.json published.
      if (!loaded && runId === "latest" && latestStatefulRunId) {
        loaded = await loadSavedRun(latestStatefulRunId, { expectedMode: "stateful" })
      }

      if (loaded) {
        return {
          results: loaded.results,
          manifest: loaded.manifest,
          loadError: null,
          missingRun: false,
        }
      }

      return {
        results: [],
        manifest: null,
        loadError: null,
        missingRun: runId !== "latest",
      }
    } catch (error) {
      return {
        results: [],
        manifest: null,
        loadError: error instanceof Error ? error.message : "Failed to load stateful run data.",
        missingRun: false,
      }
    }
  }, [])

  const resolveLatestIsolatedRun = useCallback(async (): Promise<Omit<ResolvedRun, "missingRun">> => {
    try {
      const loaded = await loadSavedRun(undefined, {
        latestVersion: statelessLatestVersionRef.current,
        latestMode: "stateless",
        expectedMode: "stateless",
      })

      if (loaded) {
        return {
          results: loaded.results,
          manifest: loaded.manifest,
          loadError: null,
        }
      }

      return {
        results: [],
        manifest: null,
        loadError: null,
      }
    } catch (error) {
      return {
        results: [],
        manifest: null,
        loadError: error instanceof Error ? error.message : "Failed to load isolated run data.",
      }
    }
  }, [])

  const setSelectedStatefulRunId = useCallback(
    async (runId: SelectedRunId) => {
      if (runId !== selectedStatefulRunIdRef.current) {
        statefulLatestVersionRef.current += 1
        selectedStatefulRunIdRef.current = runId
      }

      setSelectedStatefulRunIdState(runId)
      const resolved = await resolveStatefulRun(runId, statefulRuns[0]?.id)
      setStatefulResults(resolved.results)
      setStatefulManifest(resolved.manifest)
      setStatefulLoadError(resolved.loadError)
      setStatefulMissingRun(resolved.missingRun)
    },
    [resolveStatefulRun, statefulRuns],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const runIndex = await loadRuns()
      const filteredStatefulRuns = runIndex.filter((run) => getRunConversationMode(run) === "stateful")
      setStatefulRuns(filteredStatefulRuns)

      const latestStatefulRunId = filteredStatefulRuns[0]?.id
      const [resolvedStateful, resolvedIsolated] = await Promise.all([
        resolveStatefulRun(selectedStatefulRunIdRef.current, latestStatefulRunId),
        resolveLatestIsolatedRun(),
      ])

      setSelectedStatefulRunIdState(selectedStatefulRunIdRef.current)
      setStatefulResults(resolvedStateful.results)
      setStatefulManifest(resolvedStateful.manifest)
      setStatefulLoadError(resolvedStateful.loadError)
      setStatefulMissingRun(resolvedStateful.missingRun)
      setIsolatedLatestResults(resolvedIsolated.results)
      setIsolatedLatestManifest(resolvedIsolated.manifest)
      setIsolatedLoadError(resolvedIsolated.loadError)
    } finally {
      setLoading(false)
    }
  }, [resolveLatestIsolatedRun, resolveStatefulRun])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    statefulRuns,
    selectedStatefulRunId,
    statefulResults,
    statefulManifest,
    statefulLoadError,
    statefulMissingRun,
    isolatedLatestResults,
    isolatedLatestManifest,
    isolatedLoadError,
    setSelectedStatefulRunId,
    refresh,
  }
}
