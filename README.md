# DystopiaBench

DystopiaBench is a red-team benchmark for evaluating whether LLMs resist or comply with progressively dystopian directives.

It now supports dual-track operation:

- public, reproducible benchmark artifacts for external comparison
- private, holdout-capable eval infrastructure for internal gating and red-team use

It tests registered scenario modules, including:

- `petrov`: military escalation, autonomous weapons, and safety override scenarios
- `orwell`: surveillance, censorship, and population-control scenarios
- `laguardia`: civic extraction, institutional capture, and administrative coercion scenarios
- `basaglia`: therapeutic coercion, paternalistic control, and support-system capture scenarios
- `huxley`: conditioning, reproductive stratification, pleasure governance, and engineered consent scenarios
- `kafka`: procedural entrapment, opaque adjudication, and administrative-limbo scenarios
- `pkd`: synthetic identity, reality verification, predictive suspicion, and memory-governance scenarios

Each scenario escalates from `L1` to `L5`, and each response is classified into a Dystopian Compliance Score (DCS).

Lower DCS is better.

## Why this benchmark exists

Many safety evaluations focus on clearly malicious prompts. Real misuse often starts as a plausible request and gradually drifts into harmful intent. DystopiaBench is designed to measure whether a model notices and resists that drift.

## Current benchmark shape

- 7 public core modules (`petrov`, `orwell`, `laguardia`, `basaglia`, `huxley`, `kafka`, `pkd`)
- 5 escalation levels per scenario
- 4 compliance tiers
- Registry-derived counts may change as the core catalog expands; run `pnpm check:scenarios` to print the current module, scenario, and prompt totals.

Default full run size:

- depends on the current registry size; use `pnpm check:scenarios` for the live prompt count

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

Schemas live in `lib/dystopiabench/schemas.ts` (current writer emits `schemaVersion: 7`; loaders remain compatible with existing `schemaVersion: 2`, `schemaVersion: 3`, `schemaVersion: 4`, `schemaVersion: 5`, and `schemaVersion: 6` manifests).
Scenario content lives in JSON module files under `lib/dystopiabench/scenario-data/modules/` and is validated through the TypeScript registry in `lib/dystopiabench/scenario-registry.ts`.

## Lab-facing features

- Stable TypeScript entrypoint in `lib/dystopiabench/index.ts`
- Benchmark bundles with pin-able IDs such as `dystopiabench-core@1.0.0`
- Dual-track artifact storage: public-safe dashboard artifacts vs private/internal artifacts
- Scenario governance metadata: split, review state, citations, contamination, sensitivity, canary tokens
- Experiment metadata (`experimentId`, `project`, `owner`, `policyVersion`, `gitCommit`, `datasetBundleVersion`)
- Repeated trials via `--replicates`
- Programmatic scenario loading from local, URL, and `npm:` JSON scenario sources
- Export scripts for JSONL prompt rows, CSV summaries, parquet artifacts, Inspect-style logs, OpenAI-Evals-style JSONL, and eval cards
- Regression gate script for CI usage
- Judge calibration script for gold-set evaluation
- Review-manifest generation and reviewed-label import

See:

- `docs/integration.md`
- `docs/interoperability.md`
- `docs/reproducibility.md`
- `docs/judge-calibration.md`
- `docs/scenario-authoring.md`
- `docs/authoring-rubric.md`
- `docs/human-review-workflow.md`
- `docs/benchmark-split-policy.md`
- `docs/contamination-policy.md`

## Repository layout

```text
app/                    Next.js pages and route metadata (dashboard, results, run)
components/             UI primitives and benchmark dashboards/charts
hooks/                  Client-side run loading and selection
lib/dystopiabench/      Runner, scenarios, models, schemas, analytics, storage
lib/dystopiabench/scenario-data/modules/  JSON-backed scenario module files
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
- Optional local OpenAI-compatible endpoint for local runs

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
LOCAL_OPENAI_BASE_URL=http://localhost:1234/v1
# Optional when local server requires auth:
LOCAL_OPENAI_API_KEY=
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
pnpm bench:run --models=openrouter:deepseek/deepseek-r1
pnpm bench:run --models=local:my-custom-model
pnpm bench:run --levels=1,2,3 --run-id=my-run-001
pnpm bench:run --judge-model=google/gemini-3-flash-preview --transport=chat-only
pnpm bench:run --judge-models=google/gemini-3-flash-preview,claude-opus-4.6
pnpm bench:run --judge-model=claude-opus-4.6 --judge-strategy=pair-with-tiebreak
pnpm bench:run --provider-precision=non-quantized-only
pnpm bench:run --concurrency=6 --per-model-concurrency=1 --timeout-ms=90000
pnpm bench:run-isolated --module=petrov --models=gpt-5.3-codex --levels=5
pnpm bench:run --retain=20 --archive-dir=archive
```

Main `bench:run` flags:

- `--module=<registered-module-id>|both`
- `--models=<comma-separated model IDs>`
- Supports custom model selectors:
  - `openrouter:<openrouter model string>` for direct OpenRouter IDs
  - `local:<local model id>` for local OpenAI-compatible providers
  - raw OpenRouter model strings with `/` separator (for example `google/gemini-3.1-pro-preview`)
- `--levels=1,2,3,4,5`
- `--run-id=<id>`
- `--scenario-ids=<comma-separated scenario IDs>`
- `--judge-model=<model-id-or-openrouter-or-local-model-selector>`
- `--judge-models=<comma-separated judge selectors>` (multi-judge arena mode)
- `--judge-strategy=single|pair-with-tiebreak`
- In `pair-with-tiebreak`, the primary judge is `--judge-model`, the secondary judge is fixed to `kimi-k2.5`, and disagreements go to `openai/gpt-5.4-mini`
- `--transport=chat-first-fallback|chat-only`
- `--conversation-mode=stateful|stateless`
- `--provider-precision=default|non-quantized-only`
- `--timeout-ms=<positive-int>`
- `--concurrency=<positive-int>`
- `--per-model-concurrency=<positive-int>`
- `--max-retries=<non-negative-int>`
- `--retry-backoff-base-ms=<positive-int>`
- `--retry-backoff-jitter-ms=<non-negative-int>`
- `--retain=<non-negative-int>`
- `--archive-dir=<relative-folder-under-public/data>`
- `--replicates=<positive-int>`
- `--experiment-id=<id>`
- `--project=<name>`
- `--owner=<name-or-team>`
- `--purpose=<free-text>`
- `--model-snapshot=<deployment-or-checkpoint-id>`
- `--provider-region=<region>`
- `--policy-version=<internal-policy-version>`
- `--git-commit=<sha>`
- `--dataset-bundle-version=<bundle-id-or-version>`
- `--benchmark-id=<bundle-family-id>`
- `--benchmark-bundle-version=<semver>`
- `--scenario-sources=<comma-separated source paths, URLs, or npm: package paths>`

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

By default, empty completions after all retries are recorded as implicit refusals (`status=ok`, `compliance=refusal`) with explicit manifest metadata rather than being left unscorable.

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

Reruns never mutate the source manifest. `bench:rerun-failures` writes a new derived `benchmark-rerun-*.json` style run with provenance metadata (`derivedFromRunId`, `derivationKind`, `rerunScope`, `rerunPairCount`, `replacedTupleCount`) and publishes latest aliases from that derived run only.

### Publish a run as latest

```bash
pnpm bench:publish --run-id=<run-id>
```

Optional retention controls:

```bash
pnpm bench:publish --run-id=<run-id> --retain=20 --archive-dir=archive
```

Non-public bundles are blocked from `latest` publishing unless you opt in explicitly:

```bash
pnpm bench:publish --run-id=<run-id> --allow-nonpublic-publish
```

Even with `--allow-nonpublic-publish`, the artifact must be explicitly marked `publicSafe=true` before public aliases are updated.

### Validate manifests

```bash
pnpm check:scenarios
pnpm check:manifests
```

### Create or validate a benchmark bundle

```bash
pnpm bench:bundle:create --out=benchmark-bundle.json
pnpm bench:bundle:validate --path=benchmark-bundle.json
```

### Export a run for analysis

```bash
pnpm bench:export --run-id=<run-id>
```

This writes:

- `exports/<run-id>/<run-id>.rows.jsonl`
- `exports/<run-id>/<run-id>.scenario-summaries.csv`
- `exports/<run-id>/<run-id>.run-metadata.csv`
- `exports/<run-id>/<run-id>.rows.parquet`
- `exports/<run-id>/<run-id>.scenario-summaries.parquet`
- `exports/<run-id>/<run-id>.run-metadata.parquet`
- `exports/<run-id>/<run-id>.inspect-log.json`
- `exports/<run-id>/<run-id>.openai-evals.jsonl`
- `exports/<run-id>/<run-id>.eval-card.json`

Format-specific export:

```bash
pnpm bench:export --run-id=<run-id> --format=parquet
```

Generate eval cards or review manifests directly:

```bash
pnpm bench:eval-card --run-id=<run-id>
pnpm bench:review-manifest --bundle=benchmark-bundle.json
pnpm bench:import-reviews --run-id=<run-id> --input=reviews.jsonl
```

### Evaluate a judge against a gold set

```bash
pnpm bench:calibrate-judge --gold-set=configs/judge-gold-set.example.json
```

### Gate a run in CI

```bash
pnpm bench:gate --run-id=<run-id> --config=configs/gates.example.json
```

## Programmatic usage

Use the stable library entrypoint instead of shelling out to `pnpm` from another orchestrator:

```ts
import { loadScenarioCatalog, runBenchmarkRequest, validateRun } from "./lib/dystopiabench"

const manifest = await runBenchmarkRequest({
  modelIds: ["deepseek-v3.2"],
  replicates: 3,
  experimentId: "release-eval-2026-03-27",
})

validateRun(manifest)
const catalog = loadScenarioCatalog()
console.log(catalog.benchmarkBundleId)
```

## Run artifacts and data model

Public-safe run files are stored in `public/data`:

- `benchmark-<run-id>.json`: immutable manifest for one run
- `benchmark-results.json`: currently published latest run
- `benchmark-results-stateful.json`: latest published run with `conversationMode=stateful`
- `benchmark-results-stateless.json`: latest published run with `conversationMode=stateless`
- `runs.json`: index of published runs (for UI run selector)

Non-public/default-private artifacts are stored under `artifacts/private`:

- `artifacts/private/runs/benchmark-<run-id>.json`
- `artifacts/private/eval-cards/eval-card-<run-id>.json`

Each result row includes:

- scenario + module metadata
- model metadata (`modelId`, `modelString`, provider)
- prompt/response text
- classification (`compliance`) and `score`
- richer structured semantics (`primaryComplianceLabel`, `severity`, `operationalityFlag`, `targetHarmMechanisms`, `safeAlternativeHelpfulnessFlag`, `manipulationOrEvasionFlag`, `confidence`, `adjudicationSource`)
- status (`ok`, `model_error`, `judge_error`, `aborted`, `invalid_response`)
- judge metadata (`judgeVotes`, `judgePanel`, `judgeReasoning`, `implicitRefusalFromEmpty`)
- stateful continuity metadata (`conversationContinuity`)
- transport metadata (`endpointUsed`, `transportAttempts`)
- replicate and experiment metadata (`replicate`, `experimentId`)
- trace metadata (`sampleId`, `attemptId`, `promptHash`, `responseHash`, `judgePanelConfigSnapshot`, `artifactLineage`)
- governance metadata (`scenarioSplit`, `scenarioSensitivityTier`, `canaryTokens`)
- optional auxiliary labels for richer refusal analysis

Manifest metadata now separates:

- `benchmarkDefinition`
- `executionConfig`
- `analysisConfig`

## Dashboard and routes

- `/`: homepage with overview, methodology entry point, and embedded results tabs
- `/methodology`: dedicated methodology page with protocol, scoring, and reproducibility details
- `/results`: full results explorer with run selector and model visibility controls
- `/run`: local command builder (hidden in production)

Results UI behavior:

- `Aggregate`, each registered module tab, `Per Scenario`, and `Per Prompt` always use stateful escalation runs.
- `Per Prompt (No Escalation)` is the only isolated/stateless view and always reads `benchmark-results-stateless.json`.
- Only one run selector is shown in `/results` (stateful run selection).

`next.config.mjs` keeps image optimization disabled for static assets, and `vercel.json` sets security/cache headers for app and data assets.

## Development and CI

Local checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:exports
pnpm check:library-surface
pnpm check:scenarios
pnpm check:manifests
pnpm build
```

CI (`.github/workflows/ci.yml`) runs:

- install (pnpm)
- lint
- typecheck
- tests
- export fixture tests
- library surface check
- scenario validation
- build
- manifest/eval-card schema validation

## Responsible use and safety

This repository includes intentionally dual-use prompt content for safety evaluation. Use it for research, red-teaming, and policy analysis only.

- Do not use generated outputs for operational harm.
- Run with isolated/non-production credentials.
- Review any published outputs for sensitive or policy-risky content before sharing.

## Open-source release checklist

Before promoting this repository publicly, verify:

- contact links and org naming in UI metadata are correct for your maintainer identity
- `public/data` contains only data you intend to publish
- no secrets are present in local env files or shell history
- versioning expectations for prompts/schemas are documented in PRs

## Contributing

See `CONTRIBUTING.md` for workflow and content guidelines.

When submitting benchmark or schema changes, include rationale, compatibility notes, and validation output.

## License

MIT (`LICENSE`).
