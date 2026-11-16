"""Run scenarios x replicates against one tested model, grade each reply, and checkpoint every cell.

Output (gitignored): artifacts/private/v2/runs/<run-id>/
  manifest.json   settings, scenario hashes, preflight results
  results.jsonl   one line per finished cell (append-only; also the resume checkpoint)
  raw/            full CLI/API output per cell
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from dystopiabench import grading
from dystopiabench.providers import Provider, ProviderError, UsageLimitHit
from dystopiabench.scenarios import REPO_ROOT, Scenario

RUNS_DIR = REPO_ROOT / "artifacts" / "private" / "v2" / "runs"


class BudgetExceeded(RuntimeError):
    pass


@dataclass
class RunConfig:
    run_id: str
    replicates: int = 5
    concurrency: int = 2
    max_calls: int = 100
    retries: int = 1
    timeout_s: float = 600.0
    notes: str = ""
    # 1-based turns ("levels") to grade; None grades only the final turn.
    grade_levels: tuple[int, ...] | None = None


@dataclass
class Budget:
    max_calls: int
    used: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def take(self) -> None:
        with self.lock:
            if self.used >= self.max_calls:
                raise BudgetExceeded(f"call budget of {self.max_calls} reached")
            self.used += 1


def scenario_hash(scenario: Scenario) -> str:
    return hashlib.sha256(json.dumps(scenario.to_json(), sort_keys=True).encode()).hexdigest()[:16]


def cell_key(scenario: Scenario, replicate: int) -> str:
    return f"{scenario.id}@{scenario_hash(scenario)}#{replicate}"


def _git_commit() -> str | None:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        return None


def _load_done(results_path: Path) -> set[str]:
    done = set()
    if results_path.exists():
        for line in results_path.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            if row["status"] == "graded":
                done.add(row["cell"])
    return done


def _with_retries(fn, retries: int, budget: Budget):
    for attempt in range(retries + 1):
        budget.take()
        try:
            return fn()
        except (ProviderError, ValueError):
            if attempt == retries:
                raise
            time.sleep(5 * (attempt + 1))


def run(scenarios: list[Scenario], target: Provider, judge: Provider, config: RunConfig) -> Path:
    run_dir = RUNS_DIR / config.run_id
    (run_dir / "raw").mkdir(parents=True, exist_ok=True)
    results_path = run_dir / "results.jsonl"
    manifest_path = run_dir / "manifest.json"

    manifest = {
        "runId": config.run_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "gitCommit": _git_commit(),
        "target": target.selector,
        "judge": judge.selector,
        "judgePromptVersion": grading.JUDGE_PROMPT_VERSION,
        "replicates": config.replicates,
        "maxCalls": config.max_calls,
        "notes": config.notes,
        "scenarios": {s.id: {"revision": s.revision, "hash": scenario_hash(s)} for s in scenarios},
        "preflight": {"target": target.preflight(), "judge": judge.preflight()},
    }
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (previous["target"], previous["judge"]) != (target.selector, judge.selector):
            raise ValueError(f"run {config.run_id} already exists with a different target or judge")
        manifest["createdAt"] = previous["createdAt"]
        manifest["scenarios"] = {**previous.get("scenarios", {}), **manifest["scenarios"]}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    done = _load_done(results_path)
    cells = [(s, r) for s in scenarios for r in range(1, config.replicates + 1) if cell_key(s, r) not in done]
    budget = Budget(config.max_calls)
    write_lock = threading.Lock()
    stop = threading.Event()
    print(f"{len(cells)} cells to run ({len(done)} already graded), budget {config.max_calls} calls")

    def run_cell(scenario: Scenario, replicate: int) -> dict:
        if stop.is_set():
            return {}
        key = cell_key(scenario, replicate)
        row = {"cell": key, "scenarioId": scenario.id, "revision": scenario.revision, "replicate": replicate,
               "target": target.selector, "judge": judge.selector, "startedAt": datetime.now(timezone.utc).isoformat()}
        raw_name = f"{scenario.id}-r{replicate}-{scenario_hash(scenario)}"
        try:
            completion = _with_retries(
                lambda: target.complete(scenario.turns, scenario.system, config.timeout_s), config.retries, budget)
            (run_dir / "raw" / f"{raw_name}.target.jsonl").write_text(completion.raw, encoding="utf-8")
            row.update(replies=completion.replies, toolCalls=completion.tool_calls, latencyS=round(completion.latency_s, 1),
                       usage=completion.usage, settings=completion.settings)
            levels = [n for n in (config.grade_levels or (len(scenario.turns),)) if n <= len(scenario.turns)]
            graded = {}
            for level in levels:
                prefix = completion.replies[:level]
                grade = _with_retries(
                    lambda: grading.grade(judge, scenario, prefix, config.timeout_s), config.retries, budget)
                (run_dir / "raw" / f"{raw_name}.judge-L{level}.txt").write_text(grade.raw, encoding="utf-8")
                graded[level] = grade
            final = graded[max(graded)]
            row.update(status="graded", verdict=final.verdict, assisted=final.assisted,
                       recognizedHarm=final.recognized_harm, judgeReason=final.reason,
                       levels={str(n): {"verdict": g.verdict, "recognizedHarm": g.recognized_harm, "reason": g.reason}
                               for n, g in graded.items()})
        except (UsageLimitHit, BudgetExceeded) as exc:
            stop.set()
            row.update(status="stopped", error=f"{type(exc).__name__}: {exc}")
        except (ProviderError, ValueError) as exc:
            row.update(status="error", error=f"{type(exc).__name__}: {exc}")
        with write_lock, results_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        return row

    with ThreadPoolExecutor(max_workers=config.concurrency) as pool:
        futures = [pool.submit(run_cell, s, r) for s, r in cells]
        for future in as_completed(futures):
            row = future.result()
            if row:
                mark = {"graded": "A" if row.get("assisted") else "d"}.get(row["status"], row["status"].upper())
                print(f"  {row['scenarioId']} r{row['replicate']}: {mark} {row.get('error', '')[:200]}", flush=True)
    if stop.is_set():
        print("STOPPED: usage limit or call budget reached; rerun with the same --run-id to resume.")
    print(f"calls used this invocation: {budget.used}")
    return run_dir


def summarize(run_dir: Path, scenarios: list[Scenario] | None = None, pass_levels: tuple[int, ...] = ()) -> list[dict]:
    """Per-scenario assisted / recognized counts over graded cells for the current scenario hashes.

    With `pass_levels`, a replicate also counts toward `passedReplicates` when any of those graded levels was assisted.
    """
    wanted = {s.id: scenario_hash(s) for s in scenarios} if scenarios else None
    table: dict[str, dict] = {}
    for line in (run_dir / "results.jsonl").read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        sid = row["scenarioId"]
        if row["status"] != "graded" or (wanted and not row["cell"].startswith(f"{sid}@{wanted.get(sid)}#")):
            continue
        entry = table.setdefault(sid, {"scenarioId": sid, "graded": 0, "assisted": 0, "recognized": 0, "toolCalls": 0})
        entry["graded"] += 1
        entry["assisted"] += int(row["assisted"])
        entry["recognized"] += int(row["recognizedHarm"])
        entry["toolCalls"] += row.get("toolCalls", 0)
        if pass_levels:
            levels = row.get("levels", {})
            hit = any(levels.get(str(n), {}).get("verdict") == "assisted" for n in pass_levels)
            entry["passedReplicates"] = entry.get("passedReplicates", 0) + int(hit)
    return sorted(table.values(), key=lambda e: e["scenarioId"])
