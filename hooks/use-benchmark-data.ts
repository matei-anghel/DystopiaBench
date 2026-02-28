"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadRuns, loadSavedRun, type RunIndexItem } from "@/lib/dystopiabench/load-results"
import type { RunManifestV2, BenchmarkResultV2 } from "@/lib/dystopiabench/schemas"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"

export type SelectedRunId = "latest" | string

export interface BenchmarkDataState {
  loading: boolean
  runs: RunIndexItem[]
  selectedRunId: SelectedRunId
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
  rawManifestResults: BenchmarkResultV2[] | null
  loadError: string | null
  missingRun: boolean
  setSelectedRunId: (runId: SelectedRunId) => Promise<void>
  refresh: () => Promise<void>
}

export function useBenchmarkData(): BenchmarkDataState {
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<RunIndexItem[]>([])
  const [selectedRunId, setSelectedRunIdState] = useState<SelectedRunId>("latest")
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [manifest, setManifest] = useState<RunManifestV2 | null>(null)
  const [rawManifestResults, setRawManifestResults] = useState<BenchmarkResultV2[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [missingRun, setMissingRun] = useState(false)

  const selectedRunIdRef = useRef<SelectedRunId>("latest")
  const latestVersionRef = useRef(0)

  const resolveRun = useCallback(async (runId: SelectedRunId) => {
    try {
      const loaded = await loadSavedRun(
        runId === "latest" ? undefined : runId,
        runId === "latest" ? { latestVersion: latestVersionRef.current } : undefined,
      )

      if (loaded && loaded.results.length > 0) {
        return {
          results: loaded.results,
          manifest: loaded.manifest,
          rawManifestResults: loaded.manifest?.results ?? null,
          loadError: null,
          missingRun: false,
        }
      }

      // No data found for a specific run ID
      // No data found
      return {
        results: [],
        manifest: null,
        rawManifestResults: null,
        loadError: null,
        missingRun: runId !== "latest",
      }
    } catch (error) {
      return {
        results: [],
        manifest: null,
        rawManifestResults: null,
        loadError: error instanceof Error ? error.message : "Failed to load run data.",
        missingRun: false,
      }
    }
  }, [])

  const setSelectedRunId = useCallback(
    async (runId: SelectedRunId) => {
      if (runId !== selectedRunIdRef.current) {
        latestVersionRef.current += 1
        selectedRunIdRef.current = runId
      }

      setSelectedRunIdState(runId)
      const resolved = await resolveRun(runId)
      setResults(resolved.results)
      setManifest(resolved.manifest)
      setRawManifestResults(resolved.rawManifestResults)
      setLoadError(resolved.loadError)
      setMissingRun(resolved.missingRun)
    },
    [resolveRun],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const runIndex = await loadRuns()
      setRuns(runIndex)
      const resolved = await resolveRun(selectedRunId)
      setResults(resolved.results)
      setManifest(resolved.manifest)
      setRawManifestResults(resolved.rawManifestResults)
      setLoadError(resolved.loadError)
      setMissingRun(resolved.missingRun)
    } finally {
      setLoading(false)
    }
  }, [resolveRun, selectedRunId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    runs,
    selectedRunId,
    results,
    manifest,
    rawManifestResults,
    loadError,
    missingRun,
    setSelectedRunId,
    refresh,
  }
}
