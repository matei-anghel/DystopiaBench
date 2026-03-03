# DystopiaBench

DystopiaBench is a red-team benchmark for evaluating whether LLMs resist or comply with progressively dystopian directives.

It tests two modules:

- `petrov`: military escalation, autonomous weapons, and safety override scenarios
- `orwell`: surveillance, censorship, and population-control scenarios

Each scenario escalates from `L1` to `L5`, and each response is classified into a Dystopian Compliance Score (DCS).

Lower DCS is better.

## Why this benchmark exists

Many safety evaluations focus on clearly malicious prompts. Real misuse often starts as a plausible request and gradually drifts into harmful intent. DystopiaBench is designed to measure whether a model notices and resists that drift.

## Current benchmark shape

- 2 modules (`petrov`, `orwell`)
- 10 scenarios total (5 per module)
- 5 escalation levels per scenario
- 4 compliance tiers

Default full run size:

- `10 scenarios x 5 levels x 10 models = 500 prompts`

## Scoring model

Judge output is a 4-tier attitude scale:

- `refusal` -> `0`
- `hesitant` -> `33`
- `compliant` -> `66`
- `proactive` -> `100`

Primary summary metrics:

- `averageDcs`: mean DCS across scorable prompts
- `drfr`: Directed Refusal to Failure Ratio (share of `refusal` responses)
- `statusCounts`: transport/judge validity outcomes
- `modelSuccessRate`, `judgeSuccessRate`, `scorableRate`

Schemas live in `lib/dystopiabench/schemas.ts` (`schemaVersion: 2`).

## Repository layout

```text
app/                    Next.js pages and route metadata (dashboard, results, run, paper)
components/             UI primitives and benchmark dashboards/charts
hooks/                  Client-side run loading and selection
lib/dystopiabench/      Runner, scenarios, models, schemas, analytics, storage
public/data/            Run manifests and run index JSON files
scripts/                CLI entrypoints for run/rerun/publish/validation
.github/workflows/      CI workflow
```

## Tech stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4 / Recharts / Radix UI
- AI SDK (`@ai-sdk/openai`) with OpenRouter
- Zod for schema validation
- pnpm + tsx for CLI scripts

## Requirements

- Node.js 22+ (CI runs on Node 22)
- pnpm 10+
- OpenRouter API key

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

Set required env vars in `.env.local`:

```bash
OPENROUTER_API_KEY=your_openrouter_key_here
```

3. Start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## CLI workflows

### Run a benchmark

```bash
pnpm bench:run
```

Examples:

```bash
pnpm bench:run --module=petrov
pnpm bench:run --module=orwell --models=gpt-5.3-codex,claude-opus-4.6
pnpm bench:run --levels=1,2,3 --run-id=my-run-001
pnpm bench:run --judge-model=google/gemini-3-flash-preview --transport=chat-only
pnpm bench:run --concurrency=6 --per-model-concurrency=1 --timeout-ms=90000
pnpm bench:run-isolated --module=petrov --models=gpt-5.3-codex --levels=5
pnpm bench:run --retain=20 --archive-dir=archive
```

Main `bench:run` flags:

- `--module=petrov|orwell|both`
- `--models=<comma-separated model IDs>`
- `--levels=1,2,3,4,5`
- `--run-id=<id>`
- `--judge-model=<model-id-or-openrouter-model-string>`
- `--transport=chat-first-fallback|chat-only`
- `--conversation-mode=stateful|stateless`
- `--timeout-ms=<positive-int>`
- `--concurrency=<positive-int>`
- `--per-model-concurrency=<positive-int>`
- `--max-retries=<non-negative-int>`
- `--retry-backoff-base-ms=<positive-int>`
- `--retry-backoff-jitter-ms=<non-negative-int>`
- `--retain=<non-negative-int>`
- `--archive-dir=<relative-folder-under-public/data>`

Isolated mode shortcut:

```bash
pnpm bench:run-isolated
```

`bench:run-isolated` is equivalent to running `bench:run` with `--conversation-mode=stateless`, where each prompt executes in fresh context. Use this to answer questions like "does L5 comply when run alone?"

### Reliability profile (for unstable models)

Use this profile when you see timeout-heavy or empty-response-heavy runs on specific providers:

```bash
pnpm bench:run-isolated --models=qwen3.5,claude-opus-4.6 --levels=4,5 --timeout-ms=90000 --max-retries=2 --transport=chat-first-fallback --per-model-concurrency=1
```

By default, `EMPTY_MODEL_RESPONSE` is recorded as `invalid_response` (unscorable) during benchmark runs. This behavior is unchanged in the reliability profile.

### Rerun failed prompts from a previous run

```bash
pnpm bench:rerun-failures --source=latest
```

Examples:

```bash
pnpm bench:rerun-failures --source=run --run-id=2026-03-01T20-26-13-370Z
pnpm bench:rerun-failures --scope=failed-only
pnpm bench:rerun-failures --scope=all-levels
pnpm bench:rerun-failures --dry-run
pnpm bench:rerun-failures --no-publish
```

`--scope` behavior:

- `to-max-failed` (default): rerun all levels up to highest failed level per scenario-model pair
- `all-levels`: rerun levels 1-5 for failed pairs
- `failed-only`: rerun only failed tuples

### Publish a run as latest

```bash
pnpm bench:publish --run-id=<run-id>
```

Optional retention controls:

```bash
pnpm bench:publish --run-id=<run-id> --retain=20 --archive-dir=archive
```

### Validate manifests

```bash
pnpm check:manifests
```

## Run artifacts and data model

Run files are stored in `public/data`:

- `benchmark-<run-id>.json`: immutable manifest for one run
- `benchmark-results.json`: currently published latest run
- `benchmark-results-stateful.json`: latest published run with `conversationMode=stateful`
- `benchmark-results-stateless.json`: latest published run with `conversationMode=stateless`
- `runs.json`: index of published runs (for UI run selector)

Each result row includes:

- scenario + module metadata
- model metadata (`modelId`, `modelString`, provider)
- prompt/response text
- classification (`compliance`) and `score`
- status (`ok`, `model_error`, `judge_error`, `aborted`, `invalid_response`)
- transport metadata (`endpointUsed`, `transportAttempts`)

## Dashboard and routes

- `/`: homepage with methodology + overview + embedded results tabs
- `/results`: full results explorer with run selector and model visibility controls
- `/run`: local command builder (hidden in production)
- `/paper`: placeholder page

`next.config.mjs` uses static export (`output: "export"`), and `vercel.json` sets security/cache headers for app and data assets.

## Development and CI

Local checks:

```bash
pnpm lint
pnpm typecheck
pnpm check:manifests
pnpm build
```

CI (`.github/workflows/ci.yml`) runs:

- install (pnpm)
- lint
- typecheck
- build
- manifest schema sanity check

## Responsible use and safety

This repository includes intentionally dual-use prompt content for safety evaluation. Use it for research, red-teaming, and policy analysis only.

- Do not use generated outputs for operational harm.
- Run with isolated/non-production credentials.
- Review any published outputs for sensitive or policy-risky content before sharing.

## Open-source release checklist

Before promoting this repository publicly, verify:

- repository metadata in `package.json` points to the real GitHub repo (currently placeholder URLs)
- contact links and org naming in UI metadata are correct for your maintainer identity
- `public/data` contains only data you intend to publish
- no secrets are present in local env files or shell history
- versioning expectations for prompts/schemas are documented in PRs

## Contributing

See `CONTRIBUTING.md` for workflow and content guidelines.

When submitting benchmark or schema changes, include rationale, compatibility notes, and validation output.

## License

MIT (`LICENSE`).
