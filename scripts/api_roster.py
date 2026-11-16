"""Run every OpenRouter-routed roster model in parallel, with a spend cap.

    uv run python scripts/api_roster.py check            confirm every model id exists; show key balance (no inference)
    uv run python scripts/api_roster.py plan             commands and estimated cost (no network)
    uv run python scripts/api_roster.py launch [--parallel N] [--concurrency N] [--max-usd 60] [--only label,...]
    uv run python scripts/api_roster.py summary [--all]  replies, response time, output tokens, spend per model

The key is read from OPENROUTER_API_KEY or the repo's gitignored .env.local and is never printed. Each model runs as its
own `dystopiabench pilot` process (one request at a time per model). Requests only go to hosts that neither store nor
train on prompts. Rerunning `launch` resumes without resending collected replies. Spend is OpenRouter's reported cost
per call (roster price estimate when missing); once it reaches --max-usd every run is stopped.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dystopiabench.localenv import secret, value_from_file

REPO_ROOT = Path(__file__).resolve().parents[1]
ROSTER = REPO_ROOT / "rosters" / "v2-holdout.json"
RUNS = REPO_ROOT / "artifacts" / "private" / "v2" / "runs"
LOGS = REPO_ROOT / "artifacts" / "private" / "v2" / "roster-logs"
ROUTE = "OpenRouter API"
BASE_URL = "https://openrouter.ai/api/v1"


def load_roster() -> dict:
    return json.loads(ROSTER.read_text(encoding="utf-8"))


def api_models(roster: dict, only: str | None = None) -> list[dict]:
    models = [m for m in roster["models"] if m["route"] == ROUTE]
    if only:
        # Runs start in the order given, so a priority order decides which models finish first under a spend cap.
        wanted = [s.strip() for s in only.split(",") if s.strip()]
        by_name = {name: m for m in models for name in (m["label"], m["runId"])}
        unknown = [name for name in wanted if name not in by_name]
        if unknown:
            sys.exit(f"not OpenRouter roster models: {unknown}")
        models = list({by_name[name]["runId"]: by_name[name] for name in wanted}.values())
    return models


def model_id(model: dict) -> str:
    return model["selector"].split(":", 1)[1]


_from_env_file = value_from_file


def api_key(roster: dict) -> str:
    settings = roster["openrouter"]
    key = secret(settings["keyEnv"], REPO_ROOT / settings["envFile"])
    if not key:
        sys.exit(f"No OpenRouter key: set {settings['keyEnv']} or add it to {settings['envFile']}")
    return key


def get_json(path: str, key: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    request = urllib.request.Request(f"{BASE_URL}{path}", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        sys.exit(f"GET {path} failed with HTTP {exc.code}: {exc.read().decode(errors='replace')[:300]}")
    except (urllib.error.URLError, TimeoutError) as exc:
        sys.exit(f"GET {path} failed: {exc}")


# Errors where the provider gave no answer and a later retry can succeed: server errors, rate limits, network faults.
TRANSIENT_ERROR = re.compile(
    r"HTTP (5\d\d|429|408)\b|timed? ?out|timeout after|connection (refused|reset|error|closed|aborted)|"
    r"remote end closed|incompleteread|urlerror|temporarily|overloaded|no such host|getaddrinfo",
    re.IGNORECASE)
MAX_TRANSIENT_RESUMES = 10
RESUME_DELAY_S = 30


def last_error(model: dict) -> str:
    """The most recent failed row's error for a run ('' if none)."""
    path = RUNS / model["runId"] / "results.jsonl"
    if not path.exists():
        return ""
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    errors = [r.get("error") or "" for r in rows if r.get("status") not in ("collected", "decided", "platform_blocked")]
    return errors[-1] if errors else ""


def pid_alive(pid: int) -> bool:
    if os.name == "nt":
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True)
        return str(pid) in out.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def clear_stale_lock(model: dict) -> None:
    """Remove a run's .running lock left by a process that no longer exists (for example after a forced stop)."""
    lock = RUNS / model["runId"] / ".running"
    if not lock.exists():
        return
    try:
        pid = int(lock.read_text(encoding="utf-8").strip() or 0)
    except ValueError:
        pid = 0
    if not pid or not pid_alive(pid):
        lock.unlink(missing_ok=True)
        print(f"  {model['label']}: cleared stale lock (pid {pid or '?'} not running)", flush=True)


def kill_tree(proc: subprocess.Popen) -> None:
    """Stop a run and its children (on Windows the venv python is a launcher with the real interpreter as a child)."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.terminate()
    proc.wait()


def estimate_usd(model: dict, input_tokens: int, output_tokens: int) -> float:
    price = model.get("usdPerMTokens") or {"input": 10, "output": 50}
    return (input_tokens * price["input"] + output_tokens * price["output"]) / 1e6


def command(roster: dict, model: dict, pause: float, concurrency: int = 1) -> list[str]:
    return [sys.executable, "-m", "dystopiabench", "pilot",
            "--scenarios", str((REPO_ROOT / roster["bank"]).resolve()),
            "--mode", roster["mode"], "--target", model["selector"], "--effort", model["effort"],
            "--replicates", str(roster["replicates"]), "--pair-repeats",
            "--max-calls", str(roster["callsPerModel"]), "--pause", str(pause), "--run-id", model["runId"],
            "--concurrency", str(concurrency)]


def _pct(values: list[float], q: float) -> float | None:
    values = sorted(values)
    return round(values[int(q * (len(values) - 1))], 2) if values else None


def progress(model: dict) -> dict:
    """Per-model metadata from results.jsonl: replies, response time, tokens and spend."""
    rows = []
    path = RUNS / model["runId"] / "results.jsonl"
    if path.exists():
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    collected = [r for r in rows if r.get("status") == "collected"]
    tokens = [r.get("tokens") or {} for r in collected]
    tokens_in = sum(t.get("input") or 0 for t in tokens)
    tokens_out = sum(t.get("output") or 0 for t in tokens)
    reasoning = [t["reasoning"] for t in tokens if t.get("reasoning") is not None]
    latency = [r["latencyS"] for r in collected if isinstance(r.get("latencyS"), (int, float))]
    # Billed calls include failed ones that still returned usage; prefer OpenRouter's reported cost.
    reported = [(r.get("usage") or {}).get("cost") for r in rows]
    if any(isinstance(c, (int, float)) for c in reported):
        usd, basis = sum(c for c in reported if isinstance(c, (int, float))), "reported"
    else:
        usd, basis = estimate_usd(model, tokens_in, tokens_out), "estimated"
    return {"collected": len(collected), "problems": sum(r.get("status") != "collected" for r in rows),
            "latencyMedianS": _pct(latency, 0.5), "latencyP90S": _pct(latency, 0.9),
            "tokensIn": tokens_in, "tokensOut": tokens_out,
            "outputTokensMean": round(tokens_out / len(collected), 1) if collected else None,
            "reasoningTokensMean": round(sum(reasoning) / len(reasoning), 1) if reasoning else None,
            "usd": usd, "usdBasis": basis}


def cmd_check(args) -> None:
    roster = load_roster()
    listed = {m["id"] for m in get_json("/models").get("data", [])}
    missing = []
    for model in api_models(roster):
        ok = model_id(model) in listed
        missing += [] if ok else [model["label"]]
        print(f"  {'ok' if ok else 'MISSING':<8} {model['label']:<28} {model_id(model)}")
    key = api_key(roster)
    info = get_json("/key", key).get("data", {})
    print("key:", {k: info.get(k) for k in ("label", "usage", "limit", "limit_remaining", "is_free_tier")})
    credits = get_json("/credits", key).get("data", {})
    if credits:
        remaining = (credits.get("total_credits") or 0) - (credits.get("total_usage") or 0)
        print(f"account credits: ${credits.get('total_credits')} bought, ${credits.get('total_usage')} used, "
              f"${remaining:.2f} remaining")
    if missing:
        sys.exit(f"not listed on OpenRouter: {missing}")


def cmd_plan(args) -> None:
    roster = load_roster()
    models = api_models(roster, args.only)
    calls = roster["callsPerModel"]
    low = high = 0.0
    for model in models:
        lo = estimate_usd(model, calls * 250, calls * 1000)
        hi = estimate_usd(model, calls * 250, calls * 3000)
        low, high = low + lo, high + hi
        print(f"{model['label']:<28} {model['selector']:<44} {model['effort']:<8} est ${lo:.2f}-${hi:.2f}")
    print(f"{len(models)} models, {len(models) * calls} calls, lowest effort per model, "
          f"estimated ${low:.2f}-${high:.2f} (OpenRouter list prices)")
    if args.verbose:
        for model in models:
            print("  " + " ".join(command(roster, model, args.pause)[1:]))


def cmd_summary(args) -> None:
    roster = load_roster()
    models = [m for m in roster["models"] if args.all or m["route"] == ROUTE]
    fmt = lambda v: "-" if v is None else v
    print(f"{'model':<28} {'replies':>7} {'p50 s':>6} {'p90 s':>6} {'out tok':>8} {'reason':>7} {'$':>7}")
    total = 0.0
    for model in models:
        p = progress(model)
        usd = p["usd"] if model["route"] == ROUTE else 0.0
        total += usd
        print(f"{model['label']:<28} {p['collected']:>7} {fmt(p['latencyMedianS']):>6} {fmt(p['latencyP90S']):>6} "
              f"{fmt(p['outputTokensMean']):>8} {fmt(p['reasoningTokensMean']):>7} {usd:>7.2f}")
    print(f"total API spend ${total:.2f}")


def cmd_launch(args) -> None:
    roster = load_roster()
    models = api_models(roster, args.only)
    key = api_key(roster)
    listed = {m["id"] for m in get_json("/models").get("data", [])}
    missing = [m["label"] for m in models if model_id(m) not in listed]
    if missing:
        sys.exit(f"not listed on OpenRouter: {missing}")
    LOGS.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, roster["openrouter"]["keyEnv"]: key}
    queue, running, finished = list(models), {}, {}
    resumes: dict[str, int] = {}
    not_before: dict[str, float] = {}
    status_path = LOGS / "api-status.json"
    stop_reason = None
    started = datetime.now(timezone.utc).isoformat()
    print(f"launching {len(models)} OpenRouter runs, {args.parallel or len(models)} at a time, "
          f"lowest effort per model, cap ${args.max_usd:.2f}")
    try:
        while queue or running:
            while queue and (not args.parallel or len(running) < args.parallel) and not stop_reason:
                ready = [m for m in queue if not_before.get(m["runId"], 0) <= time.time()]
                if not ready:
                    break
                model = ready[0]
                queue.remove(model)
                clear_stale_lock(model)
                log = (LOGS / f"{model['runId']}.log").open("a", encoding="utf-8")
                running[model["runId"]] = (model, subprocess.Popen(command(roster, model, args.pause,
                                                                           args.concurrency), cwd=REPO_ROOT,
                                                                   env=env, stdout=log, stderr=subprocess.STDOUT), log)
                print(f"  started {model['label']}")
            time.sleep(args.poll)
            for run_id, (model, proc, log) in list(running.items()):
                if proc.poll() is not None:
                    log.close()
                    manifest_path = RUNS / run_id / "manifest.json"
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
                    finished[run_id] = {"exit": proc.returncode, "status": manifest.get("status"),
                                        "stopReason": manifest.get("stopReason")}
                    del running[run_id]
                    error = last_error(model)
                    if (manifest.get("status") == "stopped" and not stop_reason and TRANSIENT_ERROR.search(error)
                            and resumes.get(run_id, 0) < MAX_TRANSIENT_RESUMES):
                        # A failed call was not answered, so resuming only resends it; collected replies stay.
                        resumes[run_id] = resumes.get(run_id, 0) + 1
                        not_before[run_id] = time.time() + RESUME_DELAY_S
                        queue.insert(0, model)
                        print(f"  {model['label']}: transient error, resuming ({resumes[run_id]}/"
                              f"{MAX_TRANSIENT_RESUMES}): {error[:160]}", flush=True)
                    else:
                        print(f"  finished {model['label']}: {finished[run_id]}")
            snapshot = {m["runId"]: {"label": m["label"], **progress(m)} for m in models}
            total = sum(s["usd"] for s in snapshot.values())
            status_path.write_text(json.dumps({"startedAt": started, "updatedAt": datetime.now(timezone.utc).isoformat(),
                                               "spendUsd": round(total, 4), "maxUsd": args.max_usd,
                                               "runs": snapshot, "finished": finished}, indent=2), encoding="utf-8")
            done = sum(s["collected"] for s in snapshot.values())
            print(f"  {done}/{len(models) * roster['callsPerModel']} replies, spend ${total:.2f}", flush=True)
            if total >= args.max_usd and not stop_reason:
                stop_reason = f"spend ${total:.2f} reached the ${args.max_usd:.2f} cap"
                queue.clear()
                for _, proc, _ in running.values():
                    kill_tree(proc)
                print("STOPPING:", stop_reason)
    except KeyboardInterrupt:
        stop_reason = "interrupted"
        for _, proc, log in running.values():
            kill_tree(proc)
            log.close()
    print("done." if not stop_reason else f"stopped: {stop_reason}.",
          "Rerun the same launch command to resume; collected replies are not sent again.")


def main() -> None:
    settings = load_roster()["openrouter"]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    summary = sub.add_parser("summary")
    summary.add_argument("--all", action="store_true", help="include the CLI-routed models too")
    for name in ("plan", "launch"):
        p = sub.add_parser(name)
        p.add_argument("--only", help="comma-separated labels or run ids")
        p.add_argument("--pause", type=float, default=settings["pauseSeconds"])
        if name == "plan":
            p.add_argument("--verbose", action="store_true", help="print each pilot command")
        else:
            p.add_argument("--parallel", type=int, default=0, help="max runs at once (0 = all)")
            p.add_argument("--max-usd", type=float, default=settings["maxUsdDefault"])
            p.add_argument("--concurrency", type=int, default=1, help="requests in flight at once per model")
            p.add_argument("--poll", type=float, default=15)
    args = parser.parse_args()
    {"check": cmd_check, "plan": cmd_plan, "launch": cmd_launch, "summary": cmd_summary}[args.cmd](args)


if __name__ == "__main__":
    main()
