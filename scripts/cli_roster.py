"""Run the subscription (CLI) roster models one after another per lane.

    uv run python scripts/cli_roster.py plan                       progress per model
    uv run python scripts/cli_roster.py run --lane claude|codex    run a lane (resumes where it stopped)
    uv run python scripts/cli_roster.py pause                      pause every lane (at most one call in flight is lost)
    uv run python scripts/cli_roster.py resume                     let paused lanes continue

One lane per subscription: models in a lane run sequentially (one request at a time). When a run stops because the
connection dropped, the lane waits until the provider is reachable again and resumes the same model; the reply that
failed was never recorded, so it is simply sent again. Any other stop (usage limit, guard, platform-block cap,
unexpected error) ends the lane so nothing is retried blindly. Collected replies are never sent again.
Logs go to artifacts/private/v2/roster-logs/<runId>.log.
"""

from __future__ import annotations

import argparse
import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ROSTER = REPO_ROOT / "rosters" / "v2-holdout.json"
RUNS = REPO_ROOT / "artifacts" / "private" / "v2" / "runs"
LOGS = REPO_ROOT / "artifacts" / "private" / "v2" / "roster-logs"
LANES = {"claude": "claude CLI subscription", "codex": "codex CLI subscription"}
# Cheapest and fastest first, so a setup problem shows up before the expensive models run.
ORDER = {"claude": ["Claude Haiku 5.5", "Claude Sonnet 5.5", "Claude Opus 5.5", "Claude Fable 5.2"],
         "codex": ["GPT 6 Luna", "GPT 6.1 Terra", "GPT 6.1 Sol", "GPT 6 Astra"]}
PAUSE_SECONDS = 6
TIMEOUT_SECONDS = 600
PAUSE_FLAG = LOGS / "PAUSE"
HOSTS = {"claude": "api.anthropic.com", "codex": "chatgpt.com"}
# Errors that mean the connection dropped, not that the model or harness misbehaved.
NETWORK_ERROR = re.compile(
    r"no such host|getaddrinfo|name or service not known|nodename nor servname|stream disconnected|"
    r"routing discovery|connection (refused|reset|error|closed|aborted)|network is unreachable|"
    r"temporary failure in name resolution|timed? ?out|timeout after|fetch failed|econnreset|enotfound|"
    r"eai_again|urlerror|failed to connect|error sending request|socket hang up",
    re.IGNORECASE)
MAX_NETWORK_RESUMES = 100


def lane_models(roster: dict, lane: str, only: str | None) -> list[dict]:
    models = {m["label"]: m for m in roster["models"] if m["route"] == LANES[lane]}
    ordered = [models[label] for label in ORDER[lane] if label in models]
    ordered += [m for label, m in models.items() if label not in ORDER[lane]]
    if only:
        wanted = {s.strip() for s in only.split(",")}
        ordered = [m for m in ordered if m["label"] in wanted or m["runId"] in wanted]
    return ordered


def command(roster: dict, model: dict, amend: str | None = None) -> list[str]:
    cmd = [sys.executable, "-m", "dystopiabench", "pilot",
           "--scenarios", str((REPO_ROOT / roster["bank"]).resolve()), "--mode", roster["mode"],
           "--target", model["selector"], "--effort", model["effort"], "--replicates", str(roster["replicates"]),
           "--pair-repeats", "--max-calls", str(roster["callsPerModel"]), "--pause", str(PAUSE_SECONDS),
           "--timeout", str(TIMEOUT_SECONDS), "--run-id", model["runId"]]
    if model.get("expectedModel"):
        cmd += ["--expected-model", model["expectedModel"]]
    if amend and (RUNS / model["runId"] / "manifest.json").exists():
        # Resume a started run under a fixed harness; the pilot refuses if prompts or measurement settings changed.
        cmd += ["--harness-amendment", amend]
    return cmd


def run_ids(model: dict) -> list[str]:
    """The model's run plus, if its remaining repeats moved to another route, the continuation run."""
    return [model["runId"]] + ([model["continuation"]["runId"]] if model.get("continuation") else [])


def _latest(model: dict) -> list[dict]:
    latest = {}
    for run_id in run_ids(model):
        path = RUNS / run_id / "results.jsonl"
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                latest[(row["scenarioId"], row["replicate"])] = row
    return list(latest.values())


def collected(model: dict) -> int:
    """Finished repeats: collected replies plus repeats a platform safety classifier blocked (never re-sent)."""
    return sum(r.get("status") in ("collected", "platform_blocked") for r in _latest(model))


def blocked(model: dict) -> int:
    return sum(r.get("status") == "platform_blocked" for r in _latest(model))


def cmd_plan(args) -> None:
    roster = json.loads(ROSTER.read_text(encoding="utf-8"))
    for lane in LANES:
        print(f"lane {lane}:")
        for model in lane_models(roster, lane, None):
            print(f"  {model['label']:<20} {model['selector']:<32} effort {model['effort']:<5} "
                  f"{collected(model)}/{roster['callsPerModel']} done ({blocked(model)} classifier-blocked)")


def reachable(host: str) -> bool:
    try:
        socket.create_connection((host, 443), timeout=8).close()
        return True
    except OSError:
        return False


def pid_alive(pid: int) -> bool:
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True)
    return str(pid) in out.stdout


def clear_stale_lock(model: dict) -> None:
    lock = RUNS / model["runId"] / ".running"
    if not lock.exists():
        return
    try:
        pid = int(lock.read_text(encoding="utf-8").strip() or 0)
    except ValueError:
        pid = 0
    if not pid or not pid_alive(pid):
        lock.unlink(missing_ok=True)
        print(f"{model['label']}: cleared stale lock (pid {pid or '?'} not running)", flush=True)


def kill_tree(proc: subprocess.Popen) -> None:
    subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    proc.wait()


def last_stop_error(model: dict, manifest: dict) -> str:
    """The stop reason, the last failed row, and the end of the log (preflight failures write no row)."""
    rows = _latest(model)
    errors = [r.get("error", "") for r in rows if r.get("status") in ("error", "stopped")]
    log = LOGS / f"{model['runId']}.log"
    tail = log.read_text(encoding="utf-8", errors="replace")[-1500:] if log.exists() else ""
    return " ".join([manifest.get("stopReason") or ""] + errors[-1:] + [tail])


def wait_while_paused(lane: str) -> None:
    if PAUSE_FLAG.exists():
        print(f"lane {lane}: paused (run `cli_roster.py resume` to continue)", flush=True)
        while PAUSE_FLAG.exists():
            time.sleep(5)
        print(f"lane {lane}: resumed", flush=True)


def run_once(roster: dict, model: dict, amend: str | None, lane: str) -> str:
    """Run the pilot for one model until it ends or the lane is paused. Returns 'done', 'paused', 'network' or 'stop'."""
    clear_stale_lock(model)
    with (LOGS / f"{model['runId']}.log").open("a", encoding="utf-8") as log:
        proc = subprocess.Popen(command(roster, model, amend), cwd=REPO_ROOT, stdout=log, stderr=subprocess.STDOUT)
        while proc.poll() is None:
            if PAUSE_FLAG.exists():
                kill_tree(proc)
                clear_stale_lock(model)
                return "paused"
            time.sleep(3)
    manifest_path = RUNS / model["runId"] / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    status, reason = manifest.get("status"), manifest.get("stopReason")
    print(f"{model['label']}: exit {proc.returncode}, status {status}, stop {reason}, "
          f"{collected(model)}/{roster['callsPerModel']} done", flush=True)
    if status == "complete" and collected(model) >= roster["callsPerModel"]:
        return "done"
    clear_stale_lock(model)
    error = last_stop_error(model, manifest)
    if NETWORK_ERROR.search(error) or not reachable(HOSTS[lane]):
        return "network"
    print(f"  not a network problem: {error[:300]}", flush=True)
    return "stop"


def cmd_run(args) -> None:
    roster = json.loads(ROSTER.read_text(encoding="utf-8"))
    LOGS.mkdir(parents=True, exist_ok=True)
    for model in lane_models(roster, args.lane, args.only):
        if model.get("continuation") and collected(model) < roster["callsPerModel"]:
            print(f"{model['label']}: remaining repeats continue on {model['continuation']['route']} "
                  f"({collected(model)}/{roster['callsPerModel']} done); not run in this lane", flush=True)
            continue
        resumes = 0
        while collected(model) < roster["callsPerModel"]:
            wait_while_paused(args.lane)
            print(f"{model['label']}: starting ({collected(model)}/{roster['callsPerModel']} done)", flush=True)
            outcome = run_once(roster, model, args.amend, args.lane)
            if outcome in ("done", "paused"):
                continue
            if outcome == "network" and resumes < MAX_NETWORK_RESUMES:
                resumes += 1
                print(f"{model['label']}: connection problem; waiting for {HOSTS[args.lane]} "
                      f"(resume {resumes}/{MAX_NETWORK_RESUMES})", flush=True)
                while not reachable(HOSTS[args.lane]) or PAUSE_FLAG.exists():
                    time.sleep(20)
                time.sleep(10)  # let the connection settle before resuming
                continue
            print(f"lane {args.lane} stopped at {model['label']}; see {LOGS / (model['runId'] + '.log')}")
            sys.exit(1)
        print(f"{model['label']}: complete", flush=True)
    print(f"lane {args.lane} complete")


def cmd_pause(args) -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    PAUSE_FLAG.write_text(time.strftime("%Y-%m-%d %H:%M:%S"), encoding="utf-8")
    print("pause requested: running lanes stop their current call within a few seconds and wait")


def cmd_resume(args) -> None:
    PAUSE_FLAG.unlink(missing_ok=True)
    print("resumed: paused lanes continue where they stopped")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("plan")
    run = sub.add_parser("run")
    run.add_argument("--lane", choices=list(LANES), required=True)
    run.add_argument("--only")
    run.add_argument("--amend", metavar="REASON", help="resume started runs under a non-measurement harness fix")
    sub.add_parser("pause")
    sub.add_parser("resume")
    args = parser.parse_args()
    {"plan": cmd_plan, "run": cmd_run, "pause": cmd_pause, "resume": cmd_resume}[args.cmd](args)


if __name__ == "__main__":
    main()
