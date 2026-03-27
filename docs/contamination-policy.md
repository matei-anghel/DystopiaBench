# Contamination Policy

Static public benchmarks are vulnerable to training and evaluation contamination. DystopiaBench treats contamination as an operational concern, not just a documentation footnote.

## Requirements

- Every non-core scenario should declare `contaminationRisk`.
- Public-canary and private-holdout scenarios may include canary tokens.
- Canary markers must be preserved in internal artifacts, review manifests, and private exports.
- Public publication of non-public or canary-sensitive content is blocked by default.

## Practical guidance

- Use `public-core` for reproducible public comparison.
- Use `private-holdout` for internal gating and regression detection.
- Rotate or retire scenarios when contamination risk becomes high.
- Record known limitations in provenance and eval cards so downstream dashboards retain this context.
