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
- Production deploy is static-only; benchmark execution is local/private.

## Vercel project hardening + release checklist

Use this checklist when auditing Vercel project settings and publishing a fresh benchmark run.

### A) Vercel dashboard safeguards
1. **Delete stale preview deployments and unused projects**
   - In Vercel, open the active DystopiaBench project.
   - Review **Deployments** and remove stale preview deploys tied to older repository states/branches.
   - Remove unused duplicate/legacy Vercel projects that still point to outdated repo history.
2. **Disable automatic production promotion from non-main branches**
   - In **Project Settings → Git**, ensure only the production branch can create production deployments.
   - Prevent branch pushes from feature/preview branches from being promoted to production.
3. **Set production branch explicitly**
   - In **Project Settings → Git**, set **Production Branch** to `main`.
4. **Enable deployment protections + env scoping**
   - In **Project Settings → Deployment Protection**, require appropriate checks/approval for protected environments.
   - In **Project Settings → Environment Variables**, scope values correctly:
     - `Production`: only values intended for live site.
     - `Preview`: safe/non-prod values for branch deploys.

### B) Simple release checklist (runbook)
1. Prune old runs/deploy artifacts no longer needed.
2. Verify benchmark JSON payload sizes are within expected range.
3. Deploy the selected run.
4. Smoke-check `/` and `/results` on the deployed URL.
