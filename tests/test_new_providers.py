"""Offline tests for the Gemini CLI and Lambda providers. Subprocesses and HTTP are mocked; no model is called."""

import io
import json
import subprocess
from types import SimpleNamespace

import pytest

from dystopiabench import providers
from dystopiabench.providers import (GeminiCliProvider, GuardError, OpenAICompatProvider, ProviderError,
                                     UsageLimitHit, make_provider)


@pytest.fixture
def gemini(monkeypatch, tmp_path):
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    monkeypatch.setenv("DYSTOPIABENCH_GEMINI_HOME", str(tmp_path / "gemini-home"))
    p = GeminiCliProvider("gemini-4-argon")
    p.config_dir.mkdir(parents=True)
    (p.config_dir / "oauth_creds.json").write_text("{}", encoding="utf-8")
    return p


def fake_run(stdout, returncode=0, stderr="", seen=None):
    def run(args, **kwargs):
        if seen is not None:
            env = kwargs.get("env") or {}
            seen.update(args=args, env=env)
            if "GEMINI_SYSTEM_MD" in env:
                seen["system_md"] = open(env["GEMINI_SYSTEM_MD"], encoding="utf-8").read()
        return SimpleNamespace(stdout=stdout, stderr=stderr, returncode=returncode)
    return run


def payload(response="ok", models=("gemini-4-argon",), tools=0, error=None):
    out = {"session_id": "s", "response": response,
           "stats": {"models": {m: {"tokens": {"total": 10}} for m in models}, "tools": {"totalCalls": tools}}}
    if error:
        out["error"] = error
    return json.dumps(out)


def test_make_provider_selectors(monkeypatch):
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    assert make_provider("gemini-cli:gemini-3.8-flash").selector == "gemini-cli:gemini-3.8-flash"
    lam = make_provider("lambda:deepseek-v4.1-flash")
    assert lam.selector == "lambda:deepseek-v4.1-flash"
    assert lam.base_url == providers.LAMBDA_BASE_URL and lam.key_env == "LAMBDA_API_KEY"
    assert lam.effort == "low" and lam.effort_field == "reasoning_effort" and lam.check_model_listed
    assert make_provider("openrouter:x/y").selector == "openrouter:x/y"


def test_gemini_settings_lock_tools_billing_and_auth(gemini):
    s = gemini.settings()
    assert s["tools"]["core"] == []
    assert s["mcpServers"] == {} and s["skills"]["enabled"] is False
    assert s["experimental"]["enableAgents"] is False
    assert all(v["enabled"] is False for v in s["agents"]["overrides"].values())
    assert s["billing"]["overageStrategy"] == "never"
    assert s["security"]["auth"] == {"selectedType": "oauth-personal", "enforcedType": "oauth-personal"}
    override = s["modelConfigs"]["customOverrides"][0]
    assert override["match"] == {"model": "gemini-4-argon"}
    assert override["modelConfig"]["generateContentConfig"]["thinkingConfig"] == {"thinkingLevel": "LOW"}


def test_gemini_env_strips_paid_credentials(gemini, monkeypatch, tmp_path):
    for var in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_USE_VERTEXAI", "GOOGLE_APPLICATION_CREDENTIALS"):
        monkeypatch.setenv(var, "x")
    env = gemini._env(tmp_path / "system.md")
    assert not {"GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_USE_VERTEXAI",
                "GOOGLE_APPLICATION_CREDENTIALS"} & env.keys()
    assert env["GEMINI_CLI_HOME"] == str(gemini.home)
    assert env["GEMINI_SYSTEM_MD"] == str(tmp_path / "system.md")


def test_gemini_preflight_requires_login_and_clean_home(gemini, monkeypatch):
    monkeypatch.setattr(providers.subprocess, "run", fake_run("0.67.0\n"))
    report = gemini.preflight()
    assert report["cliVersion"] == "0.67.0" and report["overageStrategy"] == "never"
    assert json.loads((gemini.config_dir / "settings.json").read_text(encoding="utf-8"))["tools"]["core"] == []
    (gemini.config_dir / "GEMINI.md").write_text("be helpful", encoding="utf-8")
    with pytest.raises(GuardError):
        gemini.preflight()
    (gemini.config_dir / "GEMINI.md").unlink()
    (gemini.config_dir / "oauth_creds.json").unlink()
    with pytest.raises(GuardError):
        gemini.preflight()


def test_gemini_complete_replaces_system_prompt_and_parses_reply(gemini, monkeypatch):
    seen = {}
    monkeypatch.setattr(providers.subprocess, "run", fake_run(payload("the reply"), seen=seen))
    completion = gemini.complete(("do the work",), "SYSTEM TEXT", 30)
    assert completion.replies == ["the reply"]
    assert completion.settings["resolvedModels"] == ["gemini-4-argon"]
    assert completion.settings["thinkingLevel"] == "LOW" and completion.tool_calls == 0
    assert seen["system_md"] == "SYSTEM TEXT"
    assert seen["args"][-2:] == ["-p", "do the work"] and "-m" in seen["args"]


def test_gemini_complete_guards(gemini, monkeypatch):
    monkeypatch.setattr(providers.subprocess, "run", fake_run(payload(tools=1)))
    with pytest.raises(GuardError):
        gemini.complete(("x",), None, 30)
    monkeypatch.setattr(providers.subprocess, "run", fake_run(payload(models=("gemini-4-argon", "gemini-2.5-flash-lite"))))
    with pytest.raises(GuardError):
        gemini.complete(("x",), None, 30)
    monkeypatch.setattr(providers.subprocess, "run",
                        fake_run(payload(error={"message": "RESOURCE_EXHAUSTED: quota"}), returncode=1))
    with pytest.raises(UsageLimitHit):
        gemini.complete(("x",), None, 30)
    monkeypatch.setattr(providers.subprocess, "run", fake_run(payload(response="  ")))
    with pytest.raises(ProviderError):
        gemini.complete(("x",), None, 30)
    with pytest.raises(ProviderError):
        gemini.complete(("a", "b"), None, 30)


def test_gemini_complete_tolerates_a_preamble_before_json(gemini, monkeypatch):
    monkeypatch.setattr(providers.subprocess, "run", fake_run("Loaded cached credentials.\n" + payload("hi")))
    assert gemini.complete(("x",), None, 30).replies == ["hi"]


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_lambda_preflight_checks_model_listing(monkeypatch):
    p = make_provider("lambda:deepseek-v4.1-flash")
    monkeypatch.delenv("LAMBDA_API_KEY", raising=False)
    with pytest.raises(GuardError):
        p.preflight()
    monkeypatch.setenv("LAMBDA_API_KEY", "test-key")
    seen = []

    def urlopen(request, timeout):
        seen.append(request)
        return FakeResponse(json.dumps({"data": [{"id": "deepseek-v4.1-flash"}, {"id": "other"}]}).encode())

    monkeypatch.setattr(providers.urllib.request, "urlopen", urlopen)
    assert p.preflight()["modelListed"] is True
    assert seen[0].full_url.endswith("/models") and seen[0].get_method() == "GET"
    missing = make_provider("lambda:not-there")
    with pytest.raises(GuardError):
        missing.preflight()


def test_effort_field_by_provider(monkeypatch):
    monkeypatch.setenv("LAMBDA_API_KEY", "k")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    bodies = []

    def urlopen(request, timeout):
        if request.data is None:  # OpenRouter model metadata (supported parameters)
            return FakeResponse(json.dumps({"data": [{"id": "m", "supported_parameters": ["temperature"]}]}).encode())
        bodies.append(json.loads(request.data))
        return FakeResponse(json.dumps({"model": "m", "choices": [{"message": {"content": "r"}}]}).encode())

    monkeypatch.setattr(providers.urllib.request, "urlopen", urlopen)
    lam = make_provider("lambda:m").complete(("hi",), "sys", 30)
    make_provider("openrouter:m").complete(("hi",), "sys", 30)
    assert bodies[0]["reasoning_effort"] == "low" and "reasoning" not in bodies[0]
    assert bodies[1]["reasoning"] == {"effort": "low"} and "reasoning_effort" not in bodies[1]
    # Private test set: OpenRouter may only route to hosts that do not store or train on prompts.
    assert bodies[1]["provider"] == {"data_collection": "deny", "require_parameters": True}
    assert bodies[1]["usage"] == {"include": True} and "provider" not in bodies[0]
    # The lowest level for models that can switch reasoning off.
    make_provider("openrouter:m", effort="none").complete(("hi",), None, 30)
    assert bodies[2]["reasoning"] == {"enabled": False}
    assert bodies[0]["messages"][0] == {"role": "system", "content": "sys"}
    assert lam.settings["resolvedModels"] == ["m"] and lam.settings["effortField"] == "reasoning_effort"


def test_api_safety_refusals_are_platform_blocks(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    p = make_provider("openrouter:anthropic/claude-fable-5.2")

    def respond(payload):
        return lambda request, timeout: FakeResponse(json.dumps(payload).encode())

    monkeypatch.setattr(providers.urllib.request, "urlopen", respond(
        {"model": "m", "choices": [{"message": {"content": ""}, "finish_reason": "stop", "native_finish_reason": "refusal"}]}))
    with pytest.raises(providers.PlatformBlocked) as exc:
        p.complete(("hi",), None, 30)
    assert exc.value.raw
    monkeypatch.setattr(providers.urllib.request, "urlopen", respond(
        {"model": "m", "choices": [{"message": {"content": ""}, "finish_reason": "content_filter"}]}))
    with pytest.raises(providers.PlatformBlocked):
        p.complete(("hi",), None, 30)

    def http_error(code, body):
        def urlopen(request, timeout):
            raise providers.urllib.error.HTTPError("u", code, "e", {}, io.BytesIO(body.encode()))
        return urlopen

    monkeypatch.setattr(providers.urllib.request, "urlopen", http_error(
        400, "Fable 5.2's safeguards flagged this message (https://www.anthropic.com/legal/aup)."))
    with pytest.raises(providers.PlatformBlocked):
        p.complete(("hi",), None, 30)
    monkeypatch.setattr(providers.urllib.request, "urlopen", http_error(500, "internal error"))
    with pytest.raises(ProviderError) as exc:
        p.complete(("hi",), None, 30)
    assert not isinstance(exc.value, providers.PlatformBlocked)


def test_openrouter_drops_temperature_when_the_model_takes_none(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    bodies = []

    def urlopen(request, timeout):
        if request.data is None:
            return FakeResponse(json.dumps({"data": [
                {"id": "anthropic/claude-fable-5.2", "supported_parameters": ["reasoning", "max_tokens"]},
                {"id": "x/with-temp", "supported_parameters": ["temperature", "reasoning"]}]}).encode())
        bodies.append(json.loads(request.data))
        return FakeResponse(json.dumps({"model": "m", "choices": [{"message": {"content": "r"}}]}).encode())

    monkeypatch.setattr(providers.urllib.request, "urlopen", urlopen)
    fable = make_provider("openrouter:anthropic/claude-fable-5.2").complete(("hi",), None, 30)
    make_provider("openrouter:x/with-temp").complete(("hi",), None, 30)
    assert "temperature" not in bodies[0] and bodies[1]["temperature"] == 1.0
    assert fable.settings["temperature"] == "provider default (not supported)"
