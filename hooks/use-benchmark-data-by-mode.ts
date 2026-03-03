"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getRunConversationMode,
  loadRuns,
  loadSavedRun,
  type RunConversationMode,
  type RunIndexItem,
} from "@/lib/dystopiabench/load-results"
import type { BenchmarkResultV2, RunManifestV2 } from "@/lib/dystopiabench/schemas"
import type { BenchmarkResult } from "@/lib/dystopiabench/types"

export type SelectedRunId = "latest" | string

interface ModeState {
  runs: RunIndexItem[]
  selectedRunId: SelectedRunId
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
  rawManifestResults: BenchmarkResultV2[] | null
  loadError: string | null
  missingRun: boolean
}

interface ResolvedModeRun {
  results: BenchmarkResult[]
  manifest: RunManifestV2 | null
  rawManifestResults: BenchmarkResultV2[] | null
  loadError: string | null
  missingRun: boolean
}

export interface BenchmarkDataByModeState {
  loading: boolean
  stateful: ModeState & {
    setSelectedRunId: (runId: SelectedRunId) => Promise<void>
  }
  stateless: ModeState & {
    setSelectedRunId: (runId: SelectedRunId) => Promise<void>
  }
  refresh: () => Promise<void>
}

const MODES: RunConversationMode[] = ["stateful", "stateless"]

function makeInitialModeState(): Record<RunConversationMode, ModeState> {
  return {
    stateful: {
      runs: [],
      selectedRunId: "latest",
      results: [],
      manifest: null,
      rawManifestResults: null,
      loadError: null,
      missingRun: false,
    },
    stateless: {
      runs: [],
      selectedRunId: "latest",
      results: [],
      manifest: null,
      rawManifestResults: null,
      loadError: null,
      missingRun: false,
    },
  }
}

export function useBenchmarkDataByMode(): BenchmarkDataByModeState {
  const [loading, setLoading] = useState(true)
  const [modeState, setModeState] = useState<Record<RunConversationMode, ModeState>>(makeInitialModeState)

  const selectedRunIdRef = useRef<Record<RunConversationMode, SelectedRunId>>({
    stateful: "latest",
    stateless: "latest",
  })
  const latestVersionRef = useRef<Record<RunConversationMode, number>>({
    stateful: 0,
    stateless: 0,
  })

  const resolveRun = useCallback(async (mode: RunConversationMode, runId: SelectedRunId): Promise<ResolvedModeRun> => {
    try {
      const loaded = await loadSavedRun(
        runId === "latest" ? undefined : runId,
        runId === "latest"
          ? { latestVersion: latestVersionRef.current[mode], latestMode: mode }
          : undefined,
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

  const setModeSelectedRunId = useCallback(
    async (mode: RunConversationMode, runId: SelectedRunId) => {
      if (runId !== selectedRunIdRef.current[mode]) {
        latestVersionRef.current[mode] += 1
        selectedRunIdRef.current[mode] = runId
      }

      setModeState((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          selectedRunId: runId,
        },
      }))

      const resolved = await resolveRun(mode, runId)
      setModeState((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          selectedRunId: runId,
          results: resolved.results,
          manifest: resolved.manifest,
          rawManifestResults: resolved.rawManifestResults,
          loadError: resolved.loadError,
          missingRun: resolved.missingRun,
        },
      }))
    },
    [resolveRun],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const runIndex = await loadRuns()
      const runsByMode: Record<RunConversationMode, RunIndexItem[]> = {
        stateful: [],
        stateless: [],
      }

      for (const run of runIndex) {
        runsByMode[getRunConversationMode(run)].push(run)
      }

      const nextState = makeInitialModeState()

      for (const mode of MODES) {
        const selectedRunId = selectedRunIdRef.current[mode]
        const resolved = await resolveRun(mode, selectedRunId)
        nextState[mode] = {
          runs: runsByMode[mode],
          selectedRunId,
          results: resolved.results,
          manifest: resolved.manifest,
          rawManifestResults: resolved.rawManifestResults,
          loadError: resolved.loadError,
          missingRun: resolved.missingRun,
        }
      }

      setModeState(nextState)
    } finally {
      setLoading(false)
    }
  }, [resolveRun])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    stateful: {
      ...modeState.stateful,
      setSelectedRunId: (runId) => setModeSelectedRunId("stateful", runId),
    },
    stateless: {
      ...modeState.stateless,
      setSelectedRunId: (runId) => setModeSelectedRunId("stateless", runId),
    },
    refresh,
  }
}
