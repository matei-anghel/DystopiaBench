import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { resolveLocalePreset } from "../lib/dystopiabench/locales"

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function stripManagedFlags(argv: string[]): string[] {
  const managedFlags = new Set(["--locales", "--locale-pack-dir", "--locale-preset", "--locale", "--locale-pack"])
  const managedPrefixes = ["--locales=", "--locale-pack-dir=", "--locale-preset=", "--locale=", "--locale-pack="]
  const next: string[] = []

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (managedPrefixes.some((prefix) => value.startsWith(prefix))) continue
    if (managedFlags.has(value)) {
      index += 1
      continue
    }
    next.push(value)
  }

  return next
}

async function main() {
  const localesInput = parseArg("--locales") ?? "eu-24"
  const localePackDir = parseArg("--locale-pack-dir") ?? resolve(process.cwd(), "configs", "locale-packs")
  const localePreset = parseArg("--locale-preset") ?? localesInput
  const locales = resolveLocalePreset(localesInput)
  const baseArgs = stripManagedFlags(process.argv.slice(2))

  for (const locale of locales) {
    const localePackPath = resolve(localePackDir, `${locale}.json`)
    const args = [
      "exec",
      "tsx",
      "scripts/run-benchmark.ts",
      ...baseArgs,
      `--locale=${locale}`,
      `--locale-pack=${localePackPath}`,
      `--locale-preset=${localePreset}`,
    ]

    console.log(`\n[${locale}] pnpm ${args.join(" ")}`)
    const result = spawnSync("pnpm", args, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    })

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1
      return
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
