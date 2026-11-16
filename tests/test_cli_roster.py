"""Offline tests for the CLI lane runner's network handling, pause flag and stale locks. No model calls."""

import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "cli_roster", Path(__file__).resolve().parents[1] / "scripts" / "cli_roster.py")
cr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cr)


def test_network_errors_are_recognised_and_real_stops_are_not():
    network = [
        'ProviderError: codex exited 0: {"type": "error", "message": "Reconnecting... 2/5 (stream disconnected '
        'before completion: No such host is known. (os error 11001))"}',
        'Reconnecting... 3/5 (workspace routing discovery timed out)',
        "ProviderError: claude exited 1: API Error: Connection error.",
        "ProviderError: timeout after 600.0s",
        "GuardError: subscription allowance check failed (URLError); no inference started",
    ]
    for text in network:
        assert cr.NETWORK_ERROR.search(text), text
    real = [
        "UsageLimitHit: five_hour subscription allowance at 85%; stopping before paid continuation",
        "GuardError: expected model claude-fable-5-2, observed ['claude-opus-5-5']",
        "platform_block_cap",
        "GuardError: Codex isolation failed: observed 1 tool calls",
    ]
    for text in real:
        assert not cr.NETWORK_ERROR.search(text), text


def test_pause_and_resume_flag(tmp_path, monkeypatch):
    monkeypatch.setattr(cr, "LOGS", tmp_path)
    monkeypatch.setattr(cr, "PAUSE_FLAG", tmp_path / "PAUSE")
    cr.cmd_pause(None)
    assert (tmp_path / "PAUSE").exists()
    cr.cmd_resume(None)
    assert not (tmp_path / "PAUSE").exists()


def test_stale_lock_is_cleared_only_when_its_process_is_gone(tmp_path, monkeypatch):
    monkeypatch.setattr(cr, "RUNS", tmp_path)
    run = tmp_path / "r"
    run.mkdir()
    lock = run / ".running"
    lock.write_text("424242", encoding="utf-8")
    monkeypatch.setattr(cr, "pid_alive", lambda pid: True)
    cr.clear_stale_lock({"runId": "r", "label": "M"})
    assert lock.exists()
    monkeypatch.setattr(cr, "pid_alive", lambda pid: False)
    cr.clear_stale_lock({"runId": "r", "label": "M"})
    assert not lock.exists()
