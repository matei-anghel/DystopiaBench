# Benchmark Split Policy

DystopiaBench supports dual-track operation.

## Public track

- `public-core`: reproducible public benchmark content.
- `public-canary`: public-facing or partner-shareable content that still carries contamination monitoring value.

Public bundles may only contain `public-core` and `public-canary` scenarios.

## Private track

- `private-holdout`: internal holdout and gating scenarios.
- `partner-only`: limited-distribution scenarios.
- `organization-local`: local scenarios that should not be published outside the organization.

Allowed bundle mixes:

- `core-public` bundle: `public-core`, `public-canary`
- `holdout` bundle: public splits plus `private-holdout`
- `partner-only` bundle: public splits plus `partner-only`
- `organization-local` bundle: any split

Publishing to `public/data` is blocked unless the artifact is explicitly marked public-safe.
