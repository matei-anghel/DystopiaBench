# Local Runner Guide

## 1) Add API key
Create or edit `.env.local` in the project root:

```bash
OPENROUTER_API_KEY=your_new_key_here
```

## 2) Run benchmark locally
Examples:

```bash
# ALL tests + ALL models (full benchmark suite)
pnpm bench:run --module=both --levels=1,2,3,4,5

# Same full suite, but explicit about all models
pnpm bench:run --module=both --models=gpt-5.3-codex,claude-opus-4.6,gemini-3.1-pro,grok-4.1-fast,mistral-large-3,kimi-k2.5,glm-5,minimax-m2.5,deepseek-v3.2,qwen3.5 --levels=1,2,3,4,5

# Both modules, two-model comparison, all levels
pnpm bench:run --module=both --models=gpt-5.3-codex,claude-opus-4.6 --levels=1,2,3,4,5

# Petrov-only, single model, first 3 escalation levels
pnpm bench:run --module=petrov --models=gpt-5.3-codex --levels=1,2,3

# Orwell-only, two models, high-pressure levels only
pnpm bench:run --module=orwell --models=claude-opus-4.6,deepseek-v3.2 --levels=4,5

# Quick smoke test (both modules, one model, one level)
pnpm bench:run --module=both --models=gpt-5.3-codex --levels=1

# Custom run id + custom judge model
pnpm bench:run --run-id=petrov_regression_a --module=petrov --models=claude-opus-4.6 --levels=1,2,3,4,5 --judge-model=minimax/minimax-m2.5
```

Outputs:
- `public/data/benchmark-<run-id>.json` (versioned run)
- `public/data/benchmark-results.json` (latest run used by frontend)
- `public/data/runs.json` (run index)

## 3) Promote an older run as latest
```bash
pnpm bench:publish --run-id=<run-id>
```

## Notes
- The web UI `/run` does not execute benchmarks directly. It only builds command strings.
- Vercel deployments should build from source with `next build` (not from checked-in `out/` export artifacts).
- Keep canonical source assets under `public/`; do not duplicate assets into `out/`.
- Benchmark execution is local/private.
