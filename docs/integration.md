# Integration Guide

Use DystopiaBench as a library or CLI-driven artifact producer inside an eval pipeline.

## Library-first path

Primary entrypoint: `lib/dystopiabench/index.ts`

Available helpers:

- `runBenchmarkRequest(...)`
- `loadScenarioCatalog()`
- `validateRun(...)`
- `createBenchmarkBundle(...)`
- `buildScenarioSummaries(...)`

Minimal example:

```ts
import { runBenchmarkRequest, validateRun } from "../lib/dystopiabench"

const manifest = await runBenchmarkRequest({
  modelIds: ["deepseek-v3.2"],
  levels: [1, 2, 3, 4, 5],
  replicates: 3,
  experimentId: "predeploy-2026-03-27",
  project: "release-evals",
  owner: "safety-team",
  datasetBundleVersion: "dystopiabench-core@1.0.0",
})

validateRun(manifest)
```

## CLI path

Run:

```bash
pnpm bench:run --models=deepseek-v3.2 --replicates=3 --experiment-id=predeploy-2026-03-27
```

Export:

```bash
pnpm bench:export --run-id=<run-id>
```

Gate:

```bash
pnpm bench:gate --run-id=<run-id> --config=configs/gates.example.json
```

## Scenario sources

Additional modules can be loaded without editing the core registry:

- `--scenario-sources=path/to/modules`
- `--scenario-sources=path/to/module.json`
- `--scenario-sources=https://example.com/module.json`
- `--scenario-sources=npm:@acme/dystopiabench-pack/bundle.json`

When using the programmatic API, pass `scenarioSources` in the run request as strings or `{ source, namespace }` objects.

## Recommended artifact flow

1. Create or pin a benchmark bundle.
2. Run with explicit `experimentId`, `policyVersion`, and `gitCommit`.
3. Publish immutable run manifests.
4. Export JSONL/CSV/parquet for notebooks or warehouses.
5. Apply `bench:gate` in CI against a saved baseline.

## Publishing policy

Runs built from `holdout`, `partner-only`, or `organization-local` bundles are blocked from `latest` publication unless `--allow-nonpublic-publish` is supplied. This avoids accidentally replacing public dashboard artifacts with non-public eval content.
