"""Offline tests for the OpenRouter launcher helpers and token metadata. No network, no model calls."""

import importlib.util
import json

import pytest
from pathlib import Path

from dystopiabench.providers import token_summary

spec = importlib.util.spec_from_file_location(
    "api_roster", Path(__file__).resolve().parents[1] / "scripts" / "api_roster.py")
lr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lr)


def test_env_file_key_is_read_without_quotes(tmp_path):
    env = tmp_path / ".env.local"
    env.write_text('OTHER=1\nexport LAMBDA_API_KEY="secret_abc"\n', encoding="utf-8")
    assert lr._from_env_file(env, "LAMBDA_API_KEY") == "secret_abc"
    assert lr._from_env_file(tmp_path / "missing", "LAMBDA_API_KEY") == ""


def test_progress_prefers_reported_cost(tmp_path, monkeypatch):
    monkeypatch.setattr(lr, "RUNS", tmp_path)
    run = tmp_path / "r1"
    run.mkdir()
    rows = [{"status": "collected", "latencyS": 2.0, "tokens": {"input": 250, "output": 900, "reasoning": 300},
             "usage": {"cost": 0.01}},
            {"status": "collected", "latencyS": 4.0, "tokens": {"input": 250, "output": 1100, "reasoning": None},
             "usage": {"cost": 0.02}}]
    (run / "results.jsonl").write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    p = lr.progress({"runId": "r1", "usdPerMTokens": {"input": 2, "output": 10}})
    assert p["usdBasis"] == "reported" and abs(p["usd"] - 0.03) < 1e-9
    assert p["collected"] == 2 and p["outputTokensMean"] == 1000 and p["reasoningTokensMean"] == 300


def test_spend_estimate_uses_roster_prices():
    model = {"usdPerMTokens": {"input": 2, "output": 10}}
    assert abs(lr.estimate_usd(model, 1_000_000, 100_000) - 3.0) < 1e-9


def test_token_summary_normalizes_every_provider():
    assert token_summary({"prompt_tokens": 250, "completion_tokens": 900,
                          "completion_tokens_details.reasoning_tokens": 400}) == \
        {"input": 250, "output": 900, "reasoning": 400}
    assert token_summary({"modelUsage": {}, "usage": {"input_tokens": 10, "cache_read_input_tokens": 5,
                                                      "output_tokens": 700}}) == \
        {"input": 15, "output": 700, "reasoning": None}
    assert token_summary({"input_tokens": 300, "output_tokens": 200, "reasoning_output_tokens": 50}) == \
        {"input": 300, "output": 200, "reasoning": 50}
    assert token_summary({"models": {"g": {"tokens": {"prompt": 9, "candidates": 8, "thoughts": 7}}}}) == \
        {"input": 9, "output": 8, "reasoning": 7}
    assert token_summary({}) == {"input": None, "output": None, "reasoning": None}


def test_only_keeps_the_given_priority_order():
    roster = {"models": [{"label": l, "runId": f"r-{l}", "route": lr.ROUTE, "selector": f"openrouter:x/{l}"}
                         for l in ("A", "B", "C")] + [{"label": "Cli", "runId": "r-cli", "route": "CLI"}]}
    assert [m["label"] for m in lr.api_models(roster, "C,A,r-B")] == ["C", "A", "B"]
    with pytest.raises(SystemExit):
        lr.api_models(roster, "A,Cli")


def test_command_passes_per_model_concurrency():
    roster = {"bank": "scenarios/v2", "mode": "implementation", "replicates": 2, "callsPerModel": 72}
    model = {"selector": "openrouter:x/a", "effort": "low", "runId": "r-a"}
    cmd = lr.command(roster, model, 2, 3)
    assert cmd[cmd.index("--concurrency") + 1] == "3"


def test_transient_errors_resume_and_others_stop():
    for text in ('ProviderError: HTTP 500: {"error":{"message":"Internal Server Error"}}', "ProviderError: HTTP 429: rate",
                 "ProviderError: timeout after 180s", "URLError: <urlopen error [Errno 11001] getaddrinfo failed>"):
        assert lr.TRANSIENT_ERROR.search(text), text
    for text in ("ProviderError: HTTP 400: bad request", "ProviderError: HTTP 402: insufficient credits",
                 "GuardError: model mismatch", ""):
        assert not lr.TRANSIENT_ERROR.search(text), text


def test_last_error_reads_the_latest_failed_row(tmp_path, monkeypatch):
    monkeypatch.setattr(lr, "RUNS", tmp_path)
    (tmp_path / "r-a").mkdir()
    rows = [{"status": "error", "error": "HTTP 500: old"}, {"status": "collected"}, {"status": "error", "error": "HTTP 502: new"}]
    (tmp_path / "r-a" / "results.jsonl").write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    assert lr.last_error({"runId": "r-a"}) == "HTTP 502: new"
    assert lr.last_error({"runId": "missing"}) == ""
