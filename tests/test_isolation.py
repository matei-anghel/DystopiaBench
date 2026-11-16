"""Offline tests that the tested CLIs receive no operator identity, host session details or setup context."""

import json
import subprocess

import pytest

from dystopiabench import providers
from dystopiabench.providers import ClaudeCodeProvider, CodexProvider, GuardError


HOST_SESSION_VARS = {
    "CLAUDE_CODE_USER_EMAIL": "someone@example.org",
    "CLAUDE_CODE_ACCOUNT_UUID": "acct",
    "CLAUDE_CODE_ORGANIZATION_UUID": "org",
    "CLAUDE_CODE_ENTRYPOINT": "claude-desktop",
    "CLAUDE_CODE_MESSAGING_SOCKET": r"\\.\pipe\host",
    "CLAUDE_CODE_MESSAGING_TOKEN": "secret",
    "CLAUDE_EFFORT": "high",
    "CLAUDECODE": "1",
    "AI_AGENT": "claude",
    "CODEX_THREAD_ID": "t",
    "GIT_AUTHOR_EMAIL": "someone@example.org",
    "SHELL": "/bin/bash",
    "DYSTOPIABENCH_SANDBOX_ROOT": "x",
}


def test_cli_environments_come_from_an_allowlist(monkeypatch, tmp_path):
    for name, value in HOST_SESSION_VARS.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    monkeypatch.setenv("DYSTOPIABENCH_CLAUDE_HOME", str(tmp_path / "claude"))
    claude_env = ClaudeCodeProvider("claude-sonnet-5-5")._env()
    codex_env = CodexProvider("gpt-6.1-sol")._env()
    for env in (claude_env, codex_env):
        assert not set(HOST_SESSION_VARS) & env.keys()
        assert "PATH" in {k.upper() for k in env}
    assert claude_env["CLAUDE_CONFIG_DIR"] == str(tmp_path / "claude")
    assert claude_env["CLAUDE_CODE_EFFORT_LEVEL"] == "low"


def account_home(tmp_path, monkeypatch):
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    monkeypatch.setenv("DYSTOPIABENCH_CLAUDE_HOME", str(tmp_path))
    config = {"oauthAccount": {"accountUuid": "a", "organizationUuid": "o", "emailAddress": "someone@example.org",
                               "fullName": "Some One", "displayName": "Some", "billingType": "stripe_subscription",
                               "profileFetchedAt": 1}, "userID": "u"}
    (tmp_path / ".claude.json").write_text(json.dumps(config), encoding="utf-8")
    return ClaudeCodeProvider("claude-sonnet-5-5", subscription_guard=False)


def test_claude_account_identity_is_removed_before_each_call(monkeypatch, tmp_path):
    p = account_home(tmp_path, monkeypatch)
    p._scrub_account()
    account = json.loads((tmp_path / ".claude.json").read_text(encoding="utf-8"))["oauthAccount"]
    assert not {"emailAddress", "fullName", "displayName"} & account.keys()
    assert account["accountUuid"] == "a" and account["organizationUuid"] == "o"
    assert account["profileFetchedAt"] > 1  # fresh, so the CLI does not refetch and restore the email
    p._assert_account_scrubbed()


def test_claude_reply_is_refused_if_the_email_comes_back(monkeypatch, tmp_path):
    p = account_home(tmp_path, monkeypatch)
    events = [{"type": "system", "subtype": "init", "model": "claude-sonnet-5-5"},
              {"type": "result", "result": "ok", "modelUsage": {"claude-sonnet-5-5": {}}}]
    seen = {}

    def run(args, **kwargs):
        seen["args"] = args
        # Simulate the CLI refreshing its profile during the call.
        config = json.loads((tmp_path / ".claude.json").read_text(encoding="utf-8"))
        config["oauthAccount"]["emailAddress"] = "someone@example.org"
        (tmp_path / ".claude.json").write_text(json.dumps(config), encoding="utf-8")
        return subprocess.CompletedProcess(args, 0, "\n".join(json.dumps(e) for e in events), "")

    monkeypatch.setattr(providers.subprocess, "run", run)
    with pytest.raises(GuardError):
        p.complete(("task",), "system", 10)
    assert seen["args"][seen["args"].index("--permission-mode") + 1] == "default"
    assert seen["args"][seen["args"].index("--tools") + 1] == ""


def test_codex_replaces_its_agent_prompt_and_drops_host_context(monkeypatch):
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    seen = {}
    events = [{"type": "item.completed", "item": {"type": "error", "message": "Code Mode is unavailable"}},
              {"type": "item.completed", "item": {"type": "agent_message", "text": "reply"}},
              {"type": "turn.completed", "usage": {}}]

    def run(args, **kwargs):
        seen["args"] = args
        configs = [args[i + 1] for i, a in enumerate(args) if a == "-c"]
        path = json.loads(next(c for c in configs if c.startswith("model_instructions_file=")).split("=", 1)[1])
        seen["instructions"] = open(path, encoding="utf-8").read()
        seen["configs"] = configs
        return subprocess.CompletedProcess(args, 0, "\n".join(json.dumps(e) for e in events), "")

    monkeypatch.setattr(providers.subprocess, "run", run)
    completion = CodexProvider("gpt-6.1-sol", effort="low").complete(("task",), "SYSTEM TEXT", 10)
    assert completion.text == "reply" and completion.tool_calls == 0
    assert completion.settings["cliNotices"] == ["Code Mode is unavailable"]
    assert seen["instructions"] == "SYSTEM TEXT"
    assert not any(c.startswith("developer_instructions=") for c in seen["configs"])
    for required in ("skills.include_instructions=false", "include_environment_context_time=false",
                     "include_permissions_instructions=false", "include_collaboration_mode_instructions=false",
                     "features.shell_tool=false", "features.unified_exec=false", "features.code_mode_host=false",
                     "features.memories=false", "features.plugins=false", "project_doc_max_bytes=0"):
        assert required in seen["configs"]


def test_platform_block_messages_from_haiku_and_opus_are_recognised():
    haiku = "API Error: claude-haiku-5-5 can't help with this. https://www.anthropic.com/legal/aup"
    opus = ("API Error: Opus 5's safeguards flagged this message (https://www.anthropic.com/legal/aup). Our "
            "intentionally broad safeguards ... Claude Code can't respond to this message with Opus 5.")
    assert providers.PLATFORM_BLOCK_PATTERN.search(haiku)
    assert providers.PLATFORM_BLOCK_PATTERN.search(opus)
    assert not providers.PLATFORM_BLOCK_PATTERN.search("API Error: 500 internal server error")


def _claude_events(*events):
    return "\n".join(json.dumps(e) for e in events)


def test_claude_refusals_and_refusal_fallback_are_classifier_blocks(monkeypatch, tmp_path):
    p = account_home(tmp_path, monkeypatch)
    p.expected_model = "claude-fable-5-2"
    seen = {}

    def runner(stdout):
        def run(args, **kwargs):
            seen["env"] = kwargs["env"]
            return subprocess.CompletedProcess(args, 0, stdout, "")
        return run

    # Refusal fallback: Fable refused, Opus 5 answered. Recorded as Fable's classifier refusal, never as its reply.
    fallback = _claude_events(
        {"type": "assistant", "message": {"model": "claude-fable-5-2", "stop_reason": "refusal", "content": []}},
        {"type": "assistant", "message": {"model": "claude-opus-5", "content": [{"type": "text", "text": "x"}]}},
        {"type": "result", "result": "x", "modelUsage": {"claude-fable-5-2": {}, "claude-opus-5": {}}})
    monkeypatch.setattr(providers.subprocess, "run", runner(fallback))
    with pytest.raises(providers.PlatformBlocked) as exc:
        p.complete(("task",), "system", 10)
    assert "fallback answer from ['claude-opus-5'] discarded" in str(exc.value) and exc.value.raw
    assert seen["env"]["CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK"] == "1"
    assert seen["env"]["CLAUDE_CODE_DISABLE_REFUSAL_RETRY"] == "1"
    # A plain refusal stop with no fallback is also a classifier refusal.
    plain = _claude_events(
        {"type": "assistant", "message": {"model": "claude-fable-5-2", "stop_reason": "refusal", "content": []}},
        {"type": "result", "result": "", "modelUsage": {"claude-fable-5-2": {}}})
    monkeypatch.setattr(providers.subprocess, "run", runner(plain))
    with pytest.raises(providers.PlatformBlocked):
        p.complete(("task",), "system", 10)
    # The server-armed fallback without a refusal stop reason in the stream is still a classifier refusal.
    silent = _claude_events(
        {"type": "assistant", "message": {"model": "claude-opus-5", "content": [{"type": "text", "text": "x"}]}},
        {"type": "result", "result": "x", "modelUsage": {"claude-fable-5-2": {}, "claude-opus-5": {}}})
    monkeypatch.setattr(providers.subprocess, "run", runner(silent))
    with pytest.raises(providers.PlatformBlocked):
        p.complete(("task",), "system", 10)
    # A model mismatch with no refusal still stops the run.
    other = _claude_events(
        {"type": "assistant", "message": {"model": "claude-opus-5", "content": [{"type": "text", "text": "x"}]}},
        {"type": "result", "result": "x", "modelUsage": {"claude-opus-5": {}}})
    monkeypatch.setattr(providers.subprocess, "run", runner(other))
    with pytest.raises(GuardError):
        p.complete(("task",), "system", 10)
