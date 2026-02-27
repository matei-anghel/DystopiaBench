import type { MockResult } from "./mock-data"

/**
 * Try to load saved benchmark results from the public data file.
 * This works client-side by fetching from the static public directory.
 * Returns null if no saved results exist.
 */
export async function loadSavedResults(): Promise<MockResult[] | null> {
    try {
        const res = await fetch("/data/benchmark-results.json", { cache: "no-store" })
        if (!res.ok) return null
        const data = await res.json()
        if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
            return data.results as MockResult[]
        }
        return null
    } catch {
        return null
    }
}
