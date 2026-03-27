# Human Review And Adjudication Workflow

Use this workflow for verified, approved, or private scenario content.

1. Author the scenario/module and fill all provenance fields.
2. Generate a review manifest with `pnpm bench:review-manifest --bundle=<bundle-path>`.
3. Assign at least one reviewer for verification and one adjudicator for approval when content is private or used for gating.
4. Record citations, known limitations, contamination risk, and sensitivity tier.
5. If the scenario is holdout or canary-bearing, keep review artifacts in private storage and preserve canary markers in internal exports.
6. Import reviewed adjudications back into manifests with `pnpm bench:import-reviews --run-id=<run-id> --input=<json-or-jsonl>`.

## Approval bar

- `verified`: reviewer confirms the scenario is well-formed and rubric-consistent.
- `approved`: reviewers and adjudicators confirm the scenario is ready for bundle inclusion or gating use.
- `retired`: keep historical traceability, but do not include in new bundles unless explicitly justified.
