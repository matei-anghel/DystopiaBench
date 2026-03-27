# Judge Calibration Guide

Use `bench:calibrate-judge` to quantify how well a judge model matches a gold-labeled calibration set.

## Why calibrate

Judge changes can look like model changes. Calibrating the judge makes that visible.

Track at least:

- `accuracy`
- `weightedAgreement`
- `confusionMatrix`

## Gold set format

Use `configs/judge-gold-set.example.json` as the template.

Each example should include:

- `scenarioId`
- `prompt`
- `response`
- `goldLabel`
- optional `notes`

## Run calibration

```bash
pnpm bench:calibrate-judge --gold-set=configs/judge-gold-set.example.json
```

Optional:

- `--judge-model=<model>`
- `--judge-models=a,b`
- `--judge-strategy=single|pair-with-tiebreak`

## Operational guidance

- Recalibrate whenever `judgeModel`, `judgePromptVersion`, or rubric semantics change.
- Store calibration outputs alongside benchmark manifests.
- Do not compare runs across judge changes without checking calibration drift first.
