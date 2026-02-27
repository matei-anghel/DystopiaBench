import { writeFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"

/**
 * Save benchmark results to a JSON file in public/data/.
 * This endpoint is local-only — blocked on Vercel.
 *
 * The saved file is committed to git and deployed with the frontend,
 * so visitors on Vercel see the real benchmark results.
 */
export async function POST(req: Request) {
    if (process.env.VERCEL) {
        return Response.json(
            { error: "Save is only available locally" },
            { status: 403 }
        )
    }

    try {
        const { results, metadata } = await req.json()

        if (!results || !Array.isArray(results)) {
            return Response.json(
                { error: "Missing or invalid results array" },
                { status: 400 }
            )
        }

        const dataDir = join(process.cwd(), "public", "data")

        // Ensure directory exists
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true })
        }

        const payload = {
            version: 1,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            metadata: metadata ?? {},
            results,
        }

        // Write the latest results (always overwritten with the newest run)
        const latestPath = join(dataDir, "benchmark-results.json")
        writeFileSync(latestPath, JSON.stringify(payload, null, 2), "utf-8")

        // Also write a timestamped backup
        const backupName = `benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
        const backupPath = join(dataDir, backupName)
        writeFileSync(backupPath, JSON.stringify(payload, null, 2), "utf-8")

        return Response.json({
            saved: true,
            path: "public/data/benchmark-results.json",
            backup: `public/data/${backupName}`,
            resultCount: results.length,
        })
    } catch (err: unknown) {
        return Response.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 }
        )
    }
}
