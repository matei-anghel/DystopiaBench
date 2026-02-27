"use client"

import { useCallback, useEffect, useState } from "react"
import { MOCK_RESULTS, type MockResult } from "@/lib/dystopiabench/mock-data"
import { loadRuns, loadSavedRun, type RunIndexItem } from "@/lib/dystopiabench/load-results"
import type { RunManifestV2 } from "@/lib/dystopiabench/schemas"

export type DataSource = "real" | "mock"
export type SelectedRunId = "latest" | string

export interface BenchmarkDataState {
  loading: boolean
  runs: RunIndexItem[]
  selectedRunId: SelectedRunId
  dataSource: DataSource
  results: MockResult[]
  manifest: RunManifestV2 | null
  setSelectedRunId: (runId: SelectedRunId) => Promise<void>
  refresh: () => Promise<void>
}

async function resolveRun(runId: SelectedRunId) {
  const loaded = await loadSavedRun(runId === "latest" ? undefined : runId)
  if (loaded && loaded.results.length > 0) {
    return {
      dataSource: "real" as const,
      results: loaded.results,
      manifest: loaded.manifest,
    }
  }

  return {
    dataSource: "mock" as const,
    results: MOCK_RESULTS,
    manifest: null,
  }
}

export function useBenchmarkData(): BenchmarkDataState {
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<RunIndexItem[]>([])
  const [selectedRunId, setSelectedRunIdState] = useState<SelectedRunId>("latest")
  const [dataSource, setDataSource] = useState<DataSource>("mock")
  const [results, setResults] = useState<MockResult[]>(MOCK_RESULTS)
  const [manifest, setManifest] = useState<RunManifestV2 | null>(null)

  const setSelectedRunId = useCallback(async (runId: SelectedRunId) => {
    setSelectedRunIdState(runId)
    const resolved = await resolveRun(runId)
    setDataSource(resolved.dataSource)
    setResults(resolved.results)
    setManifest(resolved.manifest)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const runIndex = await loadRuns()
      setRuns(runIndex)
      const resolved = await resolveRun(selectedRunId)
      setDataSource(resolved.dataSource)
      setResults(resolved.results)
      setManifest(resolved.manifest)
    } finally {
      setLoading(false)
    }
  }, [selectedRunId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    runs,
    selectedRunId,
    dataSource,
    results,
    manifest,
    setSelectedRunId,
    refresh,
  }
}
