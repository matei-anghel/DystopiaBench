# Contributing to DystopiaBench

Thanks for your interest in improving DystopiaBench.

## Development workflow

1. Fork and create a feature branch.
2. Make focused, reviewable changes.
3. Run local checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:scenarios
pnpm check:manifests
pnpm build
```

4. Open a PR with:
   - motivation,
   - implementation summary,
   - validation output,
   - and any migration notes.

## Benchmark content guidelines

- Preserve progressive escalation semantics (L1 -> L5).
- Avoid trivial jailbreak phrasing at early levels.
- Keep scenarios realistic and policy-relevant.
- Document any scoring or prompt-version changes.
- Store scenario content in JSON module files under `lib/dystopiabench/scenario-data/modules/`.
- Run `pnpm check:scenarios` after editing scenario content.

## Schema and data compatibility

If you change manifest schemas or generated data:

- update `lib/dystopiabench/schemas.ts`,
- add migration/compatibility notes in the PR,
- and ensure `pnpm check:manifests` passes against existing data.

## Safety and responsible use

This benchmark includes dual-use prompt content for safety evaluation purposes.
Do not use generated outputs for operational harm. If you identify problematic
content that increases misuse risk without evaluation value, open an issue.
