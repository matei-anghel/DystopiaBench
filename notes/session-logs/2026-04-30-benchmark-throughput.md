# 2026-04-30 Benchmark Throughput Run Log

## Active Run
- Run ID: `2026-04-30T10-48-17-851Z`
- Checkpoint: `artifacts/private/run-checkpoints/checkpoint-2026-04-30T10-48-17-851Z.json`
- Latest inspected checkpoint state: `3227/21600` rows saved, status `running`, updated `2026-04-30T12:26:20.148Z`
- Scheduler: `level-wave`
- Latest saved configured caps in checkpoint: `--concurrency=192 --per-model-concurrency=10`
- All saved rows were still `L1` at inspection time.

## Original Throughput Problem
- Initial command completed only `179/21600` rows after ~23 minutes and was still on `petrov-01`.
- Causes found:
  - Old scheduler ordered work by conversation/scenario rather than by level wave.
  - Defaults were too conservative: `--concurrency=10`, `--per-model-concurrency=1`.
  - Stateful rows held slots across levels, limiting fan-out.
  - Judge arbiter `kimi-k2.6` produced many empty/timeout fallbacks.
  - Some Claude/model calls returned empty responses on primary path.

## Implemented Fixes
- Added `--scheduler=level-wave|conversation`.
- New stateful default is `level-wave`; old checkpoints without scheduler default to `conversation`.
- `level-wave` schedules all ready L1 rows before L2 while preserving per scenario/model/replicate stateful history.
- OpenRouter primary model calls were moved to `@openrouter/sdk` `OpenRouter.chat.send`.
- Empty successful responses now get one retry and then become `EMPTY_MODEL_RESPONSE` implicit refusals instead of redundant fallback.
- Direct OpenRouter chat fallback is used for transport/SDK shape failures, not every empty response.
- Pair-with-tiebreak judge arbitration now preserves primary/secondary votes and deterministically aggregates if the arbiter fails.
- Fallback logs are phase-specific, e.g. `fallback model ...` or `fallback judge:arbiter ...`.

## Validation
- `pnpm lint`: passed after fixes.
- `pnpm typecheck`: passed after fixes.
- `pnpm test`: passed, 99 tests.

## Observed Checkpoint Metrics At 3227 Rows
- Status counts: `ok=3216`, `model_error=11`.
- Endpoint counts: `ai_sdk_chat=3227`, `openrouter_chat_fallback=0`.
- Empty model rows: `150`.
- Model error/abort rows: `11`.
- Average timing: model `40891ms`, judge `5391ms`, total `46281ms`.
- Modules reached: `petrov=720`, `orwell=720`, `laguardia=705`, `basaglia=688`, `huxley=394`.

## Slow Or Flaky Models Observed
- `seed-2.0-mini`: avg row `283615ms`, only `42` rows completed.
- `seed-2.0-lite`: avg row `162831ms`, `69` rows completed.
- `qwen3.6-max-preview`: avg row `126452ms`, `74` rows completed.
- `deepseek-v4-pro`: avg row `98302ms`, `78` rows completed.
- `kimi-k2.6`: avg row `91428ms`, `65` rows completed.
- `grok-4.20-multi-agent`: avg row `83472ms`, `81` rows completed.
- `deepseek-v3.2`: avg row `73954ms`, `80` rows completed.
- `qwen3.6-plus`: avg row `73129ms`, `81` rows completed.
- `glm-5.1`: avg row `63759ms`, `80` rows completed.
- `deepseek-v4-flash`: avg row `55907ms`, `82` rows completed.

## Concurrency Escalation History
- `32/3`: stable but too slow; around `1665/21600` after substantial runtime.
- `96/6`: recommended next jump after checkpoint confirmed at `1701/21600`.
- `128/8`, `192/10`: suggested staged increases after stable windows.
- User reported `192` was working well aside from provider-specific retries.
- Next suggested high-throughput step was `384/16`, then `512/20`, and aggressive `640/24 --max-retries=1` only if willing to accept more provider mess.

## Crash Notes
### Crash 1
```text
DOMException [TimeoutError]: The operation was aborted due to timeout
```
- Occurred around `1302/21600`.
- Checkpoint remained intact at `1302/21600`.
- First mitigation changed SDK/fallback timeout handling to use explicit timeout controllers.

### Crash 2
```text
fallback model deepseek-v4-pro: primary transport failed (The operation timed out after 90000ms); trying OpenRouter chat fallback.
node:internal/process/promises:332
    triggerUncaughtException(err, true /* fromPromise */);
Error [TimeoutError]: The operation timed out after 90000ms
    at Timeout._onTimeout (/Users/pc/Desktop/DystopiaBench/lib/dystopiabench/runner.ts:799:19)
```
- Occurred around terminal progress `3231/21600`.
- Latest checkpoint inspection saved `3227/21600`, so only a few in-flight rows may need retry.
- Root cause: timeout guard still used an abort signal with an Error reason; under high concurrency/Node 25 this could surface as an unhandled rejection.
- Follow-up mitigation switched OpenRouter SDK, direct fallback fetch, and local model calls to a local `withDeadline(...)` wrapper that rejects the row on deadline and attaches a late rejection handler to provider promises.

## Throughput Estimates
- At `192/10`, user-visible progress from about `1701` to `3231` rows in roughly `13m39s` implies about `112 rows/min` during that window.
- Remaining rows after `3227`: `18373`.
- If `192/10` sustained `112 rows/min`, rough remaining time would be about `164 minutes`.
- `640/24` cannot be assumed to scale linearly because judge calls, provider queues, and slow models bottleneck. If it achieved 2x the `192/10` throughput, remaining time would be about `82 minutes`; if 3x, about `55 minutes`; if provider queues saturate, it may be no faster and produce more errors.

## Current Safe Resume Commands
Conservative high-throughput resume:
```bash
pnpm bench:run --run-id=2026-04-30T10-48-17-851Z --resume --scheduler=level-wave --concurrency=384 --per-model-concurrency=16
```

Aggressive resume:
```bash
pnpm bench:run --run-id=2026-04-30T10-48-17-851Z --resume --scheduler=level-wave --concurrency=512 --per-model-concurrency=20
```

Very aggressive, speed over completeness:
```bash
pnpm bench:run --run-id=2026-04-30T10-48-17-851Z --resume --scheduler=level-wave --concurrency=640 --per-model-concurrency=24 --max-retries=1
```

## Open Questions
- Whether OpenRouter/provider queues saturate above `192/10` for this model mix.
- Whether slow models should be split into a separate run or lowered timeout policy to avoid holding global slots.
- Whether judge calls need their own concurrency limit because `pair-with-tiebreak` concentrates load on `gpt-5.4-mini`, `claude-haiku-4.5`, and `kimi-k2.6`.
