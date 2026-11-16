"""Command line: `uv run dystopiabench <preflight|run|summary> ...` from the repository root."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from dystopiabench import decisions, runner
from dystopiabench.providers import GuardError, make_provider
from dystopiabench.scenarios import load_v2, validate_bank

DEFAULT_TARGET = "codex:gpt-6-luna"
DEFAULT_JUDGE = "codex:gpt-6.1-sol"


def _scenarios(args) -> list:
    if not args.scenarios:
        raise SystemExit("pass --scenarios <files or folders>; the V2 holdout bank is not published")
    scenarios = load_v2([Path(p) for p in args.scenarios])
    if not args.include_retired:
        scenarios = [s for s in scenarios if s.status != "retired"]
    if args.ids:
        wanted = set(args.ids.split(","))
        scenarios = [s for s in scenarios if s.id in wanted]
        missing = wanted - {s.id for s in scenarios}
        if missing:
            raise SystemExit(f"unknown scenario ids: {sorted(missing)}")
    return scenarios


def _print_summary(rows: list[dict]) -> None:
    if not rows:
        print("no graded cells")
        return
    live = 0
    by_levels = "passedReplicates" in rows[0]
    for row in rows:
        rate = row["assisted"] / row["graded"]
        hits = row["passedReplicates"] if by_levels else row["assisted"]
        live += hits > 0
        passed = f"  passed {row['passedReplicates']}/{row['graded']}" if by_levels else ""
        print(f"{row['scenarioId']:<40} final assisted {row['assisted']}/{row['graded']} ({rate:.0%}){passed}  "
              f"recognized {row['recognized']}/{row['graded']}  tool calls {row['toolCalls']}")
    label = "passed in >=1 replicate" if by_levels else "assisted in >=1 replicate"
    print(f"\nscenarios {label}: {live}/{len(rows)} ({live / len(rows):.0%})")


def _levels(value: str | None) -> tuple[int, ...]:
    return tuple(int(n) for n in value.split(",")) if value else ()


def main(argv: list[str] | None = None) -> int:
    # Windows consoles default to a legacy code page; a reply preview with characters like "≤" must not abort a run.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="dystopiabench")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_scenario_args(p):
        p.add_argument("--scenarios", nargs="*", help="V2 scenario files or folders")
        p.add_argument("--ids", help="comma-separated scenario ids")
        p.add_argument("--include-retired", action="store_true")

    pre = sub.add_parser("preflight", help="check logins, billing guards and isolation without running scenarios")
    pre.add_argument("--target", default=DEFAULT_TARGET)
    pre.add_argument("--judge", default=DEFAULT_JUDGE)
    pre.add_argument("--target-only", action="store_true", help="check only the target login, no judge profile")

    run = sub.add_parser("run", help="run scenarios against a target and grade them")
    add_scenario_args(run)
    run.add_argument("--target", default=DEFAULT_TARGET, help="codex:<model> | claude-code:<model> | gemini-cli:<model> | openrouter:<model> | lambda:<model>")
    run.add_argument("--judge", default=DEFAULT_JUDGE)
    run.add_argument("--effort", help="tested-model reasoning effort (default: the provider's lowest)")
    run.add_argument("--judge-effort", default="low")
    run.add_argument("--replicates", type=int, default=5)
    run.add_argument("--concurrency", type=int, default=2)
    run.add_argument("--max-calls", type=int, required=True, help="hard cap on tested + judge calls this invocation")
    run.add_argument("--retries", type=int, default=1)
    run.add_argument("--timeout", type=float, default=600.0)
    run.add_argument("--run-id")
    run.add_argument("--notes", default="")
    run.add_argument("--grade-levels", help="comma-separated 1-based turns to grade (default: final turn only)")
    run.add_argument("--pass-levels", help="levels where an assisted grade counts as a pass, e.g. 4,5")

    summary = sub.add_parser("summary", help="per-scenario assisted rates for a run")
    add_scenario_args(summary)
    summary.add_argument("--run-id", required=True)
    summary.add_argument("--all-revisions", action="store_true")
    summary.add_argument("--json", action="store_true")
    summary.add_argument("--pass-levels", help="levels where an assisted grade counts as a pass, e.g. 4,5")

    validate = sub.add_parser("validate", help="validate the complete independent candidate bank offline")
    add_scenario_args(validate)
    validate.add_argument("--families-per-subcategory", type=int, default=10)

    pilot = sub.add_parser("pilot", help="independent ASSIST/REFUSE decisions, sequential, no AI judge")
    add_scenario_args(pilot)
    pilot.add_argument("--target", default="claude-code:claude-haiku-5-5")
    pilot.add_argument("--expected-model", default="claude-haiku-5-5")
    pilot.add_argument("--effort", default="low")
    pilot.add_argument("--replicates", type=int, default=2)
    pilot.add_argument("--max-calls", type=int, required=True, help="hard cap on target calls; zero judge calls")
    pilot.add_argument("--pause", type=float, default=10, help="pause in seconds before each sequential request")
    pilot.add_argument("--timeout", type=float, default=180)
    pilot.add_argument("--run-id", required=True)
    pilot.add_argument("--plan", action="store_true", help="show counts without logging in or calling a model")
    pilot.add_argument("--pair-repeats", action="store_true", help="complete both independent repeats before the next variant")
    pilot.add_argument("--mode", choices=decisions.MODES, default="decision",
                       help="decision: exact ASSIST/REFUSE; implementation: short piece of the work, human-reviewed")
    pilot.add_argument("--billing-guard-amendment", action="store_true",
                       help="explicitly record a billing-monitor fix on resume; prompts and measurement settings must match")
    pilot.add_argument("--harness-amendment", metavar="REASON",
                       help="record a non-measurement harness fix on resume, with this reason; prompts and settings must match")
    pilot.add_argument("--continue-from", metavar="RUN_ID",
                       help="skip prompt repeats already finished in RUN_ID (same model and prompts, another route)")
    pilot.add_argument("--max-platform-blocks", type=int, default=decisions.MAX_PLATFORM_BLOCKS,
                       help="stop after this many platform safety blocks in one invocation")
    pilot.add_argument("--concurrency", type=int, default=1,
                       help="requests in flight at once (API providers only; CLI subscription runs stay at 1)")

    impl = sub.add_parser("impl-summary", help="per-scenario human review labels for an implementation-mode run")
    impl.add_argument("--run-id", required=True)

    report = sub.add_parser("pilot-summary", help="rank fixed-choice families and refresh the local review report")
    report.add_argument("--run-id", required=True)
    report.add_argument("--json", action="store_true")

    args = parser.parse_args(argv)
    try:
        if args.command == "preflight":
            report = {"target": make_provider(args.target).preflight()}
            if args.judge and not args.target_only:
                report["judge"] = make_provider(args.judge).preflight()
            print(json.dumps(report, indent=2))
        elif args.command == "run":
            scenarios = _scenarios(args)
            run_id = args.run_id or datetime.now().strftime("%Y%m%d-%H%M%S")
            config = runner.RunConfig(run_id=run_id, replicates=args.replicates, concurrency=args.concurrency,
                                      max_calls=args.max_calls, retries=args.retries, timeout_s=args.timeout,
                                      notes=args.notes, grade_levels=_levels(args.grade_levels) or None)
            run_dir = runner.run(scenarios, make_provider(args.target, args.effort),
                                 make_provider(args.judge, args.judge_effort), config)
            _print_summary(runner.summarize(run_dir, scenarios, _levels(args.pass_levels)))
        elif args.command == "summary":
            run_dir = runner.RUNS_DIR / args.run_id
            rows = runner.summarize(run_dir, None if args.all_revisions else _scenarios(args),
                                    _levels(args.pass_levels))
            print(json.dumps(rows, indent=2)) if args.json else _print_summary(rows)
        elif args.command == "validate":
            print(json.dumps(validate_bank(_scenarios(args), args.families_per_subcategory), indent=2))
        elif args.command == "pilot":
            scenarios = _scenarios(args)
            if not scenarios or any(len(s.turns) != 1 for s in scenarios):
                raise ValueError("pilot requires nonempty independent single-turn scenarios")
            if args.plan:
                print(json.dumps({"variants": len(scenarios),
                                  "families": len({s.family_id or s.id for s in scenarios}),
                                  "replicates": args.replicates, "targetCalls": len(scenarios) * args.replicates,
                                  "judgeCalls": 0, "concurrency": 1, "retries": 0,
                                  "pauseSeconds": args.pause, "maxCalls": args.max_calls,
                                  "pairRepeats": args.pair_repeats,
                                  "target": args.target, "expectedModel": args.expected_model}, indent=2))
            else:
                decisions.run_decisions(scenarios, make_provider(args.target, args.effort, args.expected_model),
                                        run_id=args.run_id, replicates=args.replicates, max_calls=args.max_calls,
                                        pause_s=args.pause, timeout_s=args.timeout, pair_repeats=args.pair_repeats,
                                        billing_guard_amendment=args.billing_guard_amendment, mode=args.mode,
                                        amendment_reason=args.harness_amendment, continue_from=args.continue_from,
                                        max_platform_blocks=args.max_platform_blocks,
                                        concurrency=args.concurrency)
        elif args.command == "impl-summary":
            rows = decisions.implementation_summary(runner.RUNS_DIR / args.run_id)
            for row in rows:
                print(f"{row['module']:<12} {row['scenarioId']:<34} delivered {row['delivered']}/{row['collected']}  "
                      f"partial {row['partial']}  redirected {row['redirected']}  refused {row['refused']}  "
                      f"unreviewed {row['unreviewed']}{'  PASS' if row['passed'] else ''}")
            by_module: dict[str, int] = {}
            for row in rows:
                by_module[row["module"]] = by_module.get(row["module"], 0) + int(row["passed"])
            print("passing scenarios per module: " + ", ".join(f"{m} {n}" for m, n in sorted(by_module.items())))
        elif args.command == "pilot-summary":
            run_dir = runner.RUNS_DIR / args.run_id
            rows = decisions.family_summary(run_dir)
            review = decisions.write_report(run_dir)
            if args.json:
                print(json.dumps(rows, indent=2))
            else:
                for row in rows:
                    levels = " ".join(f"L{n}:{c['assist']}/{c['planned']}" for n, c in row['levels'].items())
                    print(f"{row['familyId']:<28} {levels} selected={row['selected']} complete={row['complete']}")
                print(f"Selected discoveries: {sum(r['selected'] for r in rows)}; "
                      f"L4/L5 screening complete: {sum(r['screeningComplete'] for r in rows)}/{len(rows)} families")
                print(f"Review: {review}")
    except (GuardError, ValueError) as exc:
        print(f"refusing to run: {exc}")
        return 2
    return 0
