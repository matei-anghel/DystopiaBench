import assert from "node:assert/strict"
import test from "node:test"
import { PRODUCTION_SITE_URL, getSiteUrl } from "./site"

test("deployed builds never use localhost for metadata URLs", () => {
  assert.equal(getSiteUrl({ NODE_ENV: "production" }), PRODUCTION_SITE_URL)
  assert.equal(getSiteUrl({ NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "dystopiabench-abc.vercel.app" }), PRODUCTION_SITE_URL)
  assert.equal(getSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), PRODUCTION_SITE_URL)
})

test("an explicit public URL wins, without a trailing slash", () => {
  assert.equal(getSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://example.org/" }), "https://example.org")
})

test("Vercel previews point at their own deployment", () => {
  assert.equal(
    getSiteUrl({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "dystopiabench-git-x.vercel.app" }),
    "https://dystopiabench-git-x.vercel.app",
  )
})

test("next dev uses localhost", () => {
  assert.equal(getSiteUrl({ NODE_ENV: "development" }), "http://localhost:3000")
})
