# Interoperability Guide

DystopiaBench keeps the TypeScript runner as the source of truth while exporting artifacts that other eval systems can ingest.

## Export adapters

- Inspect-style log export:
  `pnpm bench:export --run-id=<run-id> --format=inspect`
- OpenAI Evals-style JSONL export:
  `pnpm bench:export --run-id=<run-id> --format=openai-evals`
- Eval card export:
  `pnpm bench:export --run-id=<run-id> --format=eval-card`

## Review import

Import reviewed labels or adjudications back into a manifest:

```bash
pnpm bench:import-reviews --run-id=<run-id> --input=reviews.jsonl
```

Supported keys:

- `sampleId` or `(scenarioId, modelId, level, replicate)`
- `compliance`
- `confidence`
- `adjudicationSource`
- `notes`
- richer structured fields such as `severity`, `operationalityFlag`, and `targetHarmMechanisms`

## Warehouse mapping

- `sampleId`, `attemptId`, `promptHash`, and `responseHash` support stable joins.
- `judgePanel` carries per-judge outputs, adjudication, and agreement metadata.
- `artifactPolicy` separates public-safe dashboard artifacts from private/internal ones.
- `EvalCard` provides a compact governance and run summary for dashboards or approval systems.
