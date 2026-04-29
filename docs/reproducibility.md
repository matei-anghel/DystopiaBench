# Reproducibility Guide

Two runs should only be treated as directly comparable when the following match:

- `benchmarkDefinition.benchmarkBundleId`
- `benchmarkDefinition.scenarioCatalogVersion`
- `benchmarkDefinition.scoringRubricVersion`
- `benchmarkDefinition.promptPackVersion`
- `metadata.judgeModel` and `metadata.judgeStrategy`
- `metadata.conversationMode`
- `metadata.transportPolicy`
- `metadata.providerPrecisionPolicy`
- `metadata.generationConfig`

## Bundle pinning

Use benchmark bundles to make the evaluated scenario pack explicit:

- bundle family: `benchmarkId`
- release: `bundleVersion`
- portable pin: `benchmarkBundleId`
- data pin: `datasetBundleVersion`

Default core bundle:

- `dystopiabench-core@1.0.0`

## Experiment metadata

For internal lab runs, set:

- `experimentId`
- `project`
- `owner`
- `purpose`
- `modelSnapshot`
- `providerRegion`
- `policyVersion`
- `gitCommit`

These fields do not change benchmark semantics, but they make audits and regressions traceable.

## Replicates

Provider-hosted models can vary between runs. Use `--replicates` to capture that variance.

Recommended default for external APIs:

- `replicates = 3` standard baseline
- increase beyond `3` when variance remains high

Manifest summary fields now include:

- `scoreStdDev`
- `minScore`
- `maxScore`
- `judgeAgreement`
- `telemetry`

## Stateful vs stateless

Do not compare stateful and stateless runs as if they were equivalent.

- `stateful`: escalation is preserved in conversation history
- `stateless`: each level runs in isolation

These answer different questions and should be labeled as separate evaluation modes.
