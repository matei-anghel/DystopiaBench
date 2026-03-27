import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { runManifestV2Schema } from "./schemas"

const FIXTURES = [
  "benchmark-2026-03-01T20-26-13-370Z.json",
  "benchmark-2026-03-03T00-34-57-436Z.json",
  "benchmark-2026-03-09T19-40-34-445Z.json",
  "benchmark-results-stateful.json",
]

for (const fixture of FIXTURES) {
  test(`runManifestV2Schema loads backward-compatible fixture ${fixture}`, () => {
    const path = join(process.cwd(), "public", "data", fixture)
    const parsed = runManifestV2Schema.safeParse(JSON.parse(readFileSync(path, "utf-8")) as unknown)
    assert.equal(parsed.success, true)
  })
}
