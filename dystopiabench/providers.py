"""Tested-model and judge providers.

Agent-CLI providers (Claude Code, Codex) run each call in a fresh empty workspace, with a dedicated
config home so the tested model sees no personal memory, instruction files, plugins or MCP servers.
They only ever use subscription logins: API-key credentials are stripped from the environment and
any usage-limit or overage signal aborts the run instead of continuing.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

SANDBOX_ROOT = Path(os.environ.get("DYSTOPIABENCH_SANDBOX_ROOT", Path.home() / ".agent-sandbox"))
LIMIT_PATTERN = re.compile(
    r"usage limit|rate[ _-]?limit|quota|overage|extra usage|out of credits|insufficient credits|billing|\b429\b"
    r"|resource[ _]exhausted",
    re.IGNORECASE,
)
ANTHROPIC_KEY_VARS = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_OAUTH_TOKEN",
)
OPENAI_KEY_VARS = ("OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL")
# Anything that could switch Gemini CLI to API-key, Vertex or Cloud billing, or override its home, prompt or model.
GEMINI_KEY_VARS = (
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENAI_USE_VERTEXAI",
    "GOOGLE_GENAI_USE_GCA",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CREDENTIALS",
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_CLOUD_LOCATION",
    "GOOGLE_GEMINI_BASE_URL",
    "GOOGLE_VERTEX_BASE_URL",
    "GEMINI_DEFAULT_AUTH_TYPE",
    "GEMINI_MODEL",
    "GEMINI_SYSTEM_MD",
    "GEMINI_WRITE_SYSTEM_MD",
    "GEMINI_CLI_HOME",
    "GEMINI_CLI_SYSTEM_SETTINGS_PATH",
    "CLOUD_SHELL",
)
# Entries in the Gemini sandbox home that would add instructions, tools or hooks for the tested model.
GEMINI_STRAY_ENTRIES = ("GEMINI.md", "AGENTS.md", "system.md", "extensions", "skills", "agents", "commands",
                        "policies", "hooks")


class ProviderError(RuntimeError):
    """A single call failed; the cell is recorded as an error and may be retried."""

    def __init__(self, message: str, raw: str = "", stderr: str = ""):
        super().__init__(message)
        self.raw = raw
        self.stderr = stderr


class PlatformBlocked(ProviderError):
    """The provider's own usage-policy classifier refused the request before the model answered.

    This is an outcome for the cell, not a technical failure: it is recorded and never resent.
    """


# Claude Code reports platform-level policy refusals as an API error that links the usage policy.
# Haiku: "... can't help with this ... anthropic.com/legal/aup". Opus 5: "... safeguards flagged this message
# (https://www.anthropic.com/legal/aup) ... can't respond to this message with Opus 5."
PLATFORM_BLOCK_PATTERN = re.compile(
    r"(can't help with this|safeguards flagged this message|can't respond to this message).*anthropic\.com/legal/aup"
    r"|anthropic\.com/legal/aup.*(can't help with this|can't respond to this message)",
    re.IGNORECASE | re.DOTALL)


class UsageLimitHit(RuntimeError):
    """Subscription limit, rate limit or overage signal: stop the whole run."""


class GuardError(RuntimeError):
    """Refuse to start: the environment could route calls to paid API billing or leak context."""


@dataclass
class Completion:
    replies: list[str]
    raw: str
    stderr: str = ""
    tool_calls: int = 0
    latency_s: float = 0.0
    usage: dict = field(default_factory=dict)
    settings: dict = field(default_factory=dict)

    @property
    def text(self) -> str:
        return self.replies[-1] if self.replies else ""


def _npm_shim_target(name: str) -> list[str]:
    """Resolve an npm shim to the real executable so long prompts never pass through cmd.exe."""
    found = shutil.which(name)
    if not found:
        raise GuardError(f"`{name}` is not on PATH")
    npm_dir = Path(found).parent
    candidates = {
        "claude": [npm_dir / "node_modules/@anthropic-ai/claude-code/bin/claude.exe",
                   npm_dir / "node_modules/@anthropic-ai/claude-code/bin/claude"],
        "codex": [npm_dir / "node_modules/@openai/codex/bin/codex.js"],
        "gemini": [npm_dir / "node_modules/@google/gemini-cli/dist/index.js"],
    }[name]
    for candidate in candidates:
        if candidate.exists():
            if candidate.suffix == ".js":
                node = shutil.which("node")
                if not node:
                    raise GuardError(f"node is required to run {name}")
                return [node, str(candidate)]
            return [str(candidate)]
    return [found]


# Only these inherited variables reach a tested CLI. Everything else (for example CLAUDE_CODE_USER_EMAIL, account
# and organization ids, session or messaging sockets and effort overrides exported by a host agent session) is
# dropped, so the tested model never sees who runs the benchmark or where it is launched from.
INHERITED_ENV_ALLOWLIST = frozenset({
    "PATH", "PATHEXT", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR",
    "USERPROFILE", "HOME", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "ALLUSERSPROFILE",
    "PUBLIC", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)",
    "COMMONPROGRAMW6432", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "PROCESSOR_IDENTIFIER",
    "PROCESSOR_LEVEL", "PROCESSOR_REVISION", "OS", "LANG", "LC_ALL", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS",
})


def _clean_env(strip: tuple[str, ...], extra: dict[str, str]) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k.upper() in INHERITED_ENV_ALLOWLIST and k not in strip}
    env.update(extra)
    return env


def _check_limits(text: str, source: str) -> None:
    if text and LIMIT_PATTERN.search(text):
        raise UsageLimitHit(f"{source}: {text.strip()[:500]}")


class Workspace:
    """An empty, neutrally named working directory that is removed after the call.

    Anything the agent left behind is captured into the completion record before removal.
    """

    def __enter__(self) -> Path:
        # Avoid exposing the Windows account name through the target's working directory.
        neutral_root = Path(tempfile.gettempdir()).anchor + "work" if os.name == "nt" else None
        if neutral_root is not None:
            Path(neutral_root).mkdir(parents=True, exist_ok=True)
        self.path = Path(tempfile.mkdtemp(prefix="work-", dir=neutral_root))
        return self.path

    def leftovers(self) -> dict[str, str]:
        files = {}
        for file in self.path.rglob("*"):
            if file.is_file():
                files[str(file.relative_to(self.path))] = file.read_text(encoding="utf-8", errors="replace")[:20000]
        return files

    def __exit__(self, *exc) -> None:
        shutil.rmtree(self.path, ignore_errors=True)


class Provider:
    selector: str

    def preflight(self) -> dict:
        return {}

    def complete(self, turns: tuple[str, ...], system: str | None, timeout_s: float) -> Completion:
        raise NotImplementedError


class ClaudeCodeProvider(Provider):
    """`claude -p` with no tools, no MCP, no session persistence, in a dedicated config home."""

    def __init__(self, model: str, effort: str = "low", expected_model: str | None = None,
                 subscription_guard: bool = True):
        self.model = model
        self.effort = effort
        self.expected_model = expected_model
        self.subscription_guard = subscription_guard
        self._subscription_snapshot: dict | None = None
        self.selector = f"claude-code:{model}"
        self.home = Path(os.environ.get("DYSTOPIABENCH_CLAUDE_HOME", SANDBOX_ROOT / "claude"))
        self.cmd = _npm_shim_target("claude")

    @property
    def token_file(self) -> Path:
        # Long-lived subscription token from `claude setup-token`; an alternative to a browser login in the home.
        return self.home / "oauth-token"

    # Claude Code adds "The user's email address is ..." to every conversation from oauthAccount.emailAddress in
    # .claude.json, and rewrites it when it refreshes a stale profile. These fields are removed before each call and
    # the profile is marked fresh, so the tested model never sees who runs the benchmark.
    PERSONAL_ACCOUNT_FIELDS = ("emailAddress", "fullName", "displayName")

    def _account_config(self) -> Path:
        return self.home / ".claude.json"

    def _scrub_account(self) -> None:
        path = self._account_config()
        if not path.exists():
            return
        config = json.loads(path.read_text(encoding="utf-8"))
        account = config.get("oauthAccount")
        if not isinstance(account, dict):
            return
        for name in self.PERSONAL_ACCOUNT_FIELDS:
            account.pop(name, None)
        account["profileFetchedAt"] = int(time.time() * 1000)
        tmp = path.with_suffix(".json.scrub")
        tmp.write_text(json.dumps(config, indent=2), encoding="utf-8")
        os.replace(tmp, path)

    def _assert_account_scrubbed(self) -> None:
        path = self._account_config()
        if not path.exists():
            return
        account = json.loads(path.read_text(encoding="utf-8")).get("oauthAccount") or {}
        present = [name for name in self.PERSONAL_ACCOUNT_FIELDS if account.get(name)]
        if present:
            raise GuardError(f"Claude account fields {present} reappeared in the sandbox config; the reply may have "
                             "seen the operator's identity and is not kept")

    def _env(self) -> dict[str, str]:
        extra = {
            "CLAUDE_CONFIG_DIR": str(self.home),
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
            "DISABLE_TELEMETRY": "1",
            "CLAUDE_CODE_SAFE_MODE": "1",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
            "DISABLE_EXTRA_USAGE_COMMAND": "1",
            "CLAUDE_CODE_EFFORT_LEVEL": self.effort,
            # Claude Code otherwise re-sends a refused prompt to a fallback model (Fable 5.2 -> Opus 5) or retries it.
            # A refusal must stay the tested model's outcome, and a refused prompt is never re-sent.
            "CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK": "1",
            "CLAUDE_CODE_DISABLE_REFUSAL_RETRY": "1",
        }
        if self.token_file.exists():
            extra["CLAUDE_CODE_OAUTH_TOKEN"] = self.token_file.read_text(encoding="utf-8").strip()
        env = _clean_env(ANTHROPIC_KEY_VARS + OPENAI_KEY_VARS + ("OPENROUTER_API_KEY",), extra)
        # Covers Console profiles, custom authorization headers, federation and cloud-provider routes too.
        return {k: v for k, v in env.items()
                if not k.upper().startswith(("ANTHROPIC_", "CLAUDE_CODE_USE_"))}

    def preflight(self) -> dict:
        if not self.home.exists():
            raise GuardError(
                f"Claude sandbox home {self.home} does not exist. Either log in once with\n"
                f"  CLAUDE_CONFIG_DIR={self.home} claude auth login\n"
                f"or save the token printed by `claude setup-token` to {self.token_file}"
            )
        out = subprocess.run([*self.cmd, "auth", "status"], env=self._env(), capture_output=True,
                             text=True, encoding="utf-8", timeout=60)
        try:
            status = json.loads(out.stdout)
        except json.JSONDecodeError as exc:
            raise GuardError(f"could not read `claude auth status`: {out.stdout[:300]} {out.stderr[:300]}") from exc
        method = str(status.get("authMethod", "")).lower()
        if not status.get("loggedIn") or "api" in method or method in ("", "none"):
            raise GuardError(f"Claude sandbox home must use a subscription login, got {status}")
        result = {"authMethod": status.get("authMethod"), "home": str(self.home)}
        if self.subscription_guard:
            result["subscriptionUsage"] = self.subscription_usage()
        return result

    def subscription_usage(self) -> dict:
        """Read allowance metadata without inference; fail closed if paid continuation is enabled."""
        token = self._oauth_access_token()
        if self._subscription_snapshot and time.time() - self._subscription_snapshot["checkedAt"] < 300:
            return self._subscription_snapshot
        request = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/usage",
            headers={"Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20",
                     "User-Agent": "claude-code-usage-check"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                self._subscription_snapshot = self._subscription_billing_profile(token)
                return self._subscription_snapshot
            raise GuardError(f"subscription allowance HTTP {exc.code}; no inference started") from exc
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise GuardError(f"subscription allowance check failed ({type(exc).__name__}); no inference started") from exc
        self._subscription_snapshot = self._validate_subscription_usage(payload)
        return self._subscription_snapshot

    def _subscription_billing_profile(self, token: str) -> dict:
        """Independent billing proof when allowance metadata is throttled, never a quota override."""
        try:
            expected = json.loads((self.home / ".claude.json").read_text(encoding="utf-8"))["oauthAccount"]
            expected_account = expected["accountUuid"]
            expected_org = expected["organizationUuid"]
        except (OSError, ValueError, KeyError) as exc:
            raise GuardError("cannot match the isolated subscription account for billing verification") from exc
        request = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/profile",
            headers={"Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20",
                     "User-Agent": "claude-code-billing-check"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise GuardError(f"subscription billing check failed ({type(exc).__name__}); no inference started") from exc
        return self._validate_billing_profile(payload, expected_account, expected_org)

    @staticmethod
    def _validate_billing_profile(payload: dict, expected_account: str, expected_org: str) -> dict:
        account = payload.get("account") or {}
        org = payload.get("organization") or {}
        if not expected_account or not expected_org or account.get("uuid") != expected_account or org.get("uuid") != expected_org:
            raise GuardError("billing profile does not match the isolated subscription identity")
        if org.get("billing_type") != "stripe_subscription" or org.get("subscription_status") != "active":
            raise GuardError("active subscription billing could not be verified")
        if org.get("has_extra_usage_enabled") is not False:
            raise GuardError("paid continuation is enabled or unknown in the live billing profile")
        return {"source": "oauth_profile", "checkedAt": time.time(), "extraUsageEnabled": False,
                "billingType": "stripe_subscription", "subscriptionActive": True,
                "sameAccount": True, "sameOrganization": True,
                "allowanceUnavailable": "usage_endpoint_throttled"}

    def _oauth_access_token(self) -> str:
        """Read the isolated credential; expired logins are renewed by the official CLI."""
        if self.token_file.is_file():
            return self.token_file.read_text(encoding="utf-8").strip()
        credential_path = self.home / ".credentials.json"
        try:
            credentials = json.loads(credential_path.read_text(encoding="utf-8"))
            oauth = credentials["claudeAiOauth"]
            token = oauth["accessToken"]
        except (OSError, ValueError, KeyError) as exc:
            raise GuardError("cannot verify subscription usage without an isolated OAuth credential") from exc
        expires = oauth.get("expiresAt")
        if not isinstance(expires, (int, float)) or expires > (time.time() + 120) * 1000:
            return token
        raise GuardError("subscription token expired or expiring; renew with official `claude auth login --claudeai`")

    @staticmethod
    def _validate_subscription_usage(payload: dict) -> dict:
        extra = payload.get("extra_usage") or {}
        if extra.get("is_enabled") is not False or (payload.get("spend") or {}).get("enabled") is True:
            raise GuardError("paid usage credits are enabled or their disabled state is unknown; no inference started")
        result = {"extraUsageEnabled": False, "checkedAt": time.time(), "source": "oauth_usage"}
        for name in ("five_hour", "seven_day"):
            allowance = payload.get(name) or {}
            used = allowance.get("utilization")
            if not isinstance(used, (int, float)) or isinstance(used, bool) or not 0 <= used <= 100:
                raise GuardError(f"{name} subscription allowance is unknown; no inference started")
            result[name] = {"usedPercent": used, "resetsAt": allowance.get("resets_at")}
            if used >= 85:
                raise UsageLimitHit(f"{name} subscription allowance at {used}%; stopping before paid continuation")
        return result

    def complete(self, turns: tuple[str, ...], system: str | None, timeout_s: float) -> Completion:
        subscription = self.subscription_usage() if self.subscription_guard else None
        self._scrub_account()
        args = [
            *self.cmd, "-p",
            "--model", self.model,
            "--effort", self.effort,
            "--tools", "",
            # "auto" mode attaches a classifier context with the home directory and account name to each request.
            "--permission-mode", "default",
            "--safe-mode",
            "--setting-sources", "",
            "--no-chrome",
            "--strict-mcp-config",
            "--mcp-config", '{"mcpServers":{}}',
            "--no-session-persistence",
            "--disable-slash-commands",
            "--input-format", "stream-json",
            "--output-format", "stream-json",
            "--verbose",
        ]
        stdin = "".join(
            json.dumps({"type": "user", "message": {"role": "user", "content": turn}}) + "\n" for turn in turns
        )
        with tempfile.TemporaryDirectory(prefix="ctx-") as ctx_dir, Workspace() as workspace:
            if system:
                prompt_file = Path(ctx_dir) / "context.md"
                prompt_file.write_text(system, encoding="utf-8")
                args += ["--system-prompt-file", str(prompt_file)]
            started = time.monotonic()
            try:
                out = subprocess.run(args, input=stdin, cwd=workspace, env=self._env(), capture_output=True,
                                     text=True, encoding="utf-8", timeout=timeout_s)
            except subprocess.TimeoutExpired as exc:
                raw = exc.stdout or ""
                stderr = exc.stderr or ""
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="replace")
                if isinstance(stderr, bytes):
                    stderr = stderr.decode("utf-8", errors="replace")
                raise ProviderError(f"timeout after {timeout_s}s", raw, stderr) from exc
            latency = time.monotonic() - started
        self._assert_account_scrubbed()
        replies, usage, tool_calls, errors = [], {}, 0, []
        resolved_models = set()
        refusal_stop = False
        for line in out.stdout.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = event.get("type")
            if kind == "system" and event.get("subtype") == "init" and event.get("model"):
                resolved_models.add(event["model"])
            if kind == "rate_limit_event":
                info = event.get("rate_limit_info", {})
                if info.get("isUsingOverage") or info.get("status") not in (None, "allowed"):
                    raise UsageLimitHit(f"claude rate limit event: {info}")
            elif kind == "assistant":
                if event.get("message", {}).get("model"):
                    resolved_models.add(event["message"]["model"])
                if event.get("message", {}).get("stop_reason") == "refusal":
                    refusal_stop = True
                tool_calls += sum(1 for c in event.get("message", {}).get("content", []) if c.get("type") == "tool_use")
            elif kind == "result":
                if event.get("is_error"):
                    errors.append(str(event.get("result") or event.get("subtype")))
                else:
                    replies.append(event.get("result") or "")
                usage = {"modelUsage": event.get("modelUsage"), "usage": event.get("usage")}
                resolved_models.update((event.get("modelUsage") or {}).keys())
                if event.get("stop_reason") == "refusal":
                    refusal_stop = True
        if errors or out.returncode != 0:
            message = "; ".join(errors) or out.stderr[-1000:]
            _check_limits(message, "claude")
            if PLATFORM_BLOCK_PATTERN.search(message):
                raise PlatformBlocked(f"claude platform policy block: {message}", out.stdout, out.stderr)
            raise ProviderError(f"claude exited {out.returncode}: {message}", out.stdout, out.stderr)
        if tool_calls:
            raise GuardError(f"Claude isolation failed: observed {tool_calls} tool calls")
        others = sorted(resolved_models - {self.expected_model}) if self.expected_model else []
        # Refusal fallback: the tested model refused and the turn was served by an Opus model instead (seen with
        # Fable 5.2 -> claude-opus-5). CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK normally prevents it (the CLI then emits
        # "model_refusal_no_fallback"); this check is a safety net in case a fallback still happens.
        refusal_fallback = bool(self.expected_model and self.expected_model in resolved_models and others
                                and all(m.startswith("claude-opus-") for m in others))
        if refusal_stop or refusal_fallback:
            # stop_reason "refusal" is the API's safety classifier stopping the reply: a classifier refusal for the
            # tested model, even if a fallback model then answered. Recorded as a platform block, never re-sent.
            raise PlatformBlocked(f"claude classifier refusal (stop_reason=refusal) by {self.expected_model or self.model}"
                                  + (f"; fallback answer from {others} discarded" if others else ""),
                                  out.stdout, out.stderr)
        if self.expected_model and resolved_models != {self.expected_model}:
            raise GuardError(f"expected model {self.expected_model}, observed {sorted(resolved_models)}")
        if len(replies) != len(turns):
            raise ProviderError(f"expected {len(turns)} replies, got {len(replies)}")
        return Completion(replies=replies, raw=out.stdout, stderr=out.stderr, tool_calls=tool_calls,
                          latency_s=latency, usage=usage,
                          settings={"effort": self.effort, "temperature": "cli default (not settable)",
                                    "tools": "none", "safeMode": True,
                                    "resolvedModels": sorted(resolved_models),
                                    "subscriptionUsage": subscription})


class CodexProvider(Provider):
    """`codex exec` in a read-only sandbox with a dedicated CODEX_HOME. Single-turn only."""

    def __init__(self, model: str, effort: str = "none"):
        self.model = model
        self.effort = effort
        self.selector = f"codex:{model}"
        self.home = Path(os.environ.get("DYSTOPIABENCH_CODEX_HOME", SANDBOX_ROOT / "codex"))
        self.cmd = _npm_shim_target("codex")

    def _env(self) -> dict[str, str]:
        return _clean_env(OPENAI_KEY_VARS, {"CODEX_HOME": str(self.home)})

    def preflight(self) -> dict:
        if not (self.home / "auth.json").exists():
            raise GuardError(
                f"Codex sandbox home {self.home} has no login. Log in once with:\n"
                f"  CODEX_HOME={self.home} codex login"
            )
        stray = [p.name for p in self.home.iterdir() if p.name.lower() in ("agents.md", "config.toml")]
        if stray:
            raise GuardError(f"Codex sandbox home must not contain {stray}: they would reach the tested model")
        out = subprocess.run([*self.cmd, "login", "status"], env=self._env(), capture_output=True,
                             text=True, encoding="utf-8", timeout=60)
        status = (out.stdout + out.stderr).strip()
        if "chatgpt" not in status.lower():
            raise GuardError(f"Codex sandbox home must use a ChatGPT subscription login, got: {status}")
        return {"authMethod": status, "home": str(self.home)}

    # Checked with `codex debug prompt-input` (codex-cli 0.166.0): without these, the model-visible input carried
    # the skills root path (Windows account name and sandbox folder), the host time zone, Codex's own agent prompt,
    # and sandbox-escalation and collaboration-mode text.
    ISOLATION_CONFIG = (
        "features.memories=false",
        "features.multi_agent=false",
        "features.image_generation=false",
        "features.apps=false",
        "features.plugins=false",
        "features.remote_plugin=false",
        "features.plugin_discovery_prefetch=false",
        "features.goals=false",
        "features.hooks=false",
        "features.fast_mode=false",
        "features.tool_suggest=false",
        "features.browser_use=false",
        "features.computer_use=false",
        "features.in_app_browser=false",
        # No local tool may run: the read-only sandbox can read the whole disk, including this repository.
        "features.shell_tool=false",
        "features.unified_exec=false",
        "features.code_mode_host=false",
        "features.view_image=false",
        "features.sleep_tool=false",
        "features.skill_search=false",
        "features.skill_mcp_dependency_install=false",
        "features.workspace_dependencies=false",
        "features.tool_call_mcp_elicitation=false",
        'web_search="disabled"',
        "project_doc_max_bytes=0",
        "skills.include_instructions=false",
        "skills.bundled.enabled=false",
        "include_permissions_instructions=false",
        "include_apps_instructions=false",
        "include_collaboration_mode_instructions=false",
        "include_environment_context_time=false",
    )

    def complete(self, turns: tuple[str, ...], system: str | None, timeout_s: float) -> Completion:
        if len(turns) != 1:
            raise ProviderError("codex provider supports single-turn scenarios only")
        with tempfile.TemporaryDirectory(prefix="ctx-") as ctx_dir, Workspace() as workspace:
            # Our system prompt replaces Codex's built-in agent instructions, as --system-prompt-file does for Claude.
            instructions = Path(ctx_dir) / "instructions.md"
            instructions.write_text(system or "", encoding="utf-8")
            args = [
                *self.cmd, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                "--skip-git-repo-check", "--sandbox", "read-only", "-C", str(workspace),
                "-m", self.model,
                "-c", f"model_reasoning_effort={json.dumps(self.effort)}",
                "-c", f"model_instructions_file={json.dumps(instructions.as_posix())}",
            ]
            for item in self.ISOLATION_CONFIG:
                args += ["-c", item]
            args.append("-")
            started = time.monotonic()
            try:
                out = subprocess.run(args, input=turns[0], cwd=workspace, env=self._env(), capture_output=True,
                                     text=True, encoding="utf-8", timeout=timeout_s)
            except subprocess.TimeoutExpired as exc:
                raise ProviderError(f"timeout after {timeout_s}s") from exc
            latency = time.monotonic() - started
        messages, usage, tool_calls, errors, notices = [], {}, 0, [], []
        for line in out.stdout.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = event.get("type", "")
            item = event.get("item", {})
            if kind == "item.completed" and item.get("type") == "agent_message":
                messages.append(item.get("text", ""))
            elif kind == "item.completed" and item.get("type") == "error":
                # Non-fatal CLI notices, e.g. "Code Mode is unavailable because code-mode host is disabled".
                notices.append(item.get("message", ""))
            elif kind == "item.completed" and item.get("type") not in ("agent_message", "reasoning"):
                tool_calls += 1
            elif kind == "turn.completed":
                usage = event.get("usage", {})
            elif kind in ("error", "turn.failed"):
                errors.append(json.dumps(event)[:1000])
        if errors or out.returncode != 0:
            message = "; ".join(errors) or out.stderr[-1000:]
            _check_limits(message, "codex")
            raise ProviderError(f"codex exited {out.returncode}: {message}")
        if tool_calls:
            # The read-only sandbox can still read the whole disk, so any tool use could expose private files.
            raise GuardError(f"Codex isolation failed: observed {tool_calls} tool calls")
        if not messages:
            raise ProviderError("codex returned no agent message")
        return Completion(replies=["\n\n".join(messages)], raw=out.stdout, stderr=out.stderr, tool_calls=tool_calls,
                          latency_s=latency, usage=usage,
                          settings={"effort": self.effort, "temperature": "cli default (not settable)",
                                    "sandbox": "read-only", "instructions": "replaced by system prompt",
                                    "isolationConfig": list(self.ISOLATION_CONFIG), "cliNotices": notices})


class GeminiCliProvider(Provider):
    """`gemini -p` headless, with a dedicated GEMINI_CLI_HOME, a replaced system prompt and no tools. Single-turn only.

    Only a "Login with Google" subscription is accepted: API-key, Vertex and Cloud credentials are stripped from the
    environment, the auth type is enforced in the sandbox settings, and paid AI credits are set to "never".
    """

    THINKING_LEVELS = ("minimal", "low", "medium", "high")

    def __init__(self, model: str, effort: str = "low"):
        self.model = model
        self.effort = effort
        self.selector = f"gemini-cli:{model}"
        self.home = Path(os.environ.get("DYSTOPIABENCH_GEMINI_HOME", SANDBOX_ROOT / "gemini"))
        self.config_dir = self.home / ".gemini"
        self.cmd = _npm_shim_target("gemini")
        self.cli_version: str | None = None

    def settings(self) -> dict:
        """The complete sandbox settings.json. Rewritten before every call so nothing else can creep in."""
        settings = {
            "security": {
                "auth": {"selectedType": "oauth-personal", "enforcedType": "oauth-personal"},
                "folderTrust": {"enabled": False},
                "disableYoloMode": True,
            },
            "billing": {"overageStrategy": "never"},
            "tools": {"core": [], "exclude": [], "useRipgrep": False},
            "mcpServers": {},
            "mcp": {"allowed": []},
            "experimental": {"enableAgents": False, "plan": False},
            "agents": {"overrides": {"codebase_investigator": {"enabled": False}, "cli_help": {"enabled": False}}},
            "skills": {"enabled": False},
            "hooksConfig": {"enabled": False},
            "useWriteTodos": False,
            "privacy": {"usageStatisticsEnabled": False},
            "telemetry": {"enabled": False},
            "general": {"enableAutoUpdate": False, "enableAutoUpdateNotification": False,
                        "checkpointing": {"enabled": False}, "sessionRetention": {"enabled": False}},
            "ide": {"enabled": False},
            "model": {"disableLoopDetection": True, "skipNextSpeakerCheck": True, "maxSessionTurns": 1},
            "context": {"loadMemoryFromIncludeDirectories": False},
        }
        if self.effort in self.THINKING_LEVELS:
            settings["modelConfigs"] = {"customOverrides": [{
                "match": {"model": self.model},
                "modelConfig": {"generateContentConfig": {"thinkingConfig": {"thinkingLevel": self.effort.upper()}}},
            }]}
        return settings

    def _write_settings(self) -> None:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        (self.config_dir / "settings.json").write_text(json.dumps(self.settings(), indent=2), encoding="utf-8")

    def _env(self, system_md: Path | None = None) -> dict[str, str]:
        extra = {"GEMINI_CLI_HOME": str(self.home), "GEMINI_CLI_NO_RELAUNCH": "true", "NO_BROWSER": "true"}
        if system_md is not None:
            extra["GEMINI_SYSTEM_MD"] = str(system_md)
        return _clean_env(GEMINI_KEY_VARS, extra)

    def preflight(self) -> dict:
        if not (self.config_dir / "oauth_creds.json").exists():
            raise GuardError(
                f"Gemini sandbox home {self.home} has no Google login. Log in once (PowerShell):\n"
                f'  $env:GEMINI_CLI_HOME = "{self.home}"; gemini\n'
                "and choose 'Login with Google' (not an API key or Vertex AI)."
            )
        stray = [p.name for p in self.config_dir.iterdir() if p.name in GEMINI_STRAY_ENTRIES]
        stray += [p.name for p in self.home.iterdir() if p.name in GEMINI_STRAY_ENTRIES]
        if stray:
            raise GuardError(f"Gemini sandbox home must not contain {sorted(set(stray))}: they would reach the tested model")
        self._write_settings()
        out = subprocess.run([*self.cmd, "--version"], env=self._env(), capture_output=True, text=True,
                             encoding="utf-8", timeout=60)
        self.cli_version = out.stdout.strip() or None
        return {"authMethod": "oauth-personal", "home": str(self.home), "cliVersion": self.cli_version,
                "overageStrategy": "never"}

    @staticmethod
    def _parse(stdout: str) -> dict:
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            start = stdout.find("{")
            if start == -1:
                raise ProviderError("gemini returned no JSON output", stdout)
            try:
                return json.loads(stdout[start:])
            except json.JSONDecodeError as exc:
                raise ProviderError("gemini returned malformed JSON output", stdout) from exc

    def complete(self, turns: tuple[str, ...], system: str | None, timeout_s: float) -> Completion:
        if len(turns) != 1:
            raise ProviderError("gemini-cli provider supports single-turn scenarios only")
        self._write_settings()
        args = [*self.cmd, "-m", self.model, "-o", "json", "--approval-mode", "default", "-p", turns[0]]
        with tempfile.TemporaryDirectory(prefix="ctx-") as ctx_dir, Workspace() as workspace:
            # GEMINI_SYSTEM_MD replaces the built-in agent prompt entirely; an empty file means no system prompt.
            system_md = Path(ctx_dir) / "system.md"
            system_md.write_text(system or "", encoding="utf-8")
            started = time.monotonic()
            try:
                out = subprocess.run(args, cwd=workspace, env=self._env(system_md), capture_output=True,
                                     text=True, encoding="utf-8", timeout=timeout_s)
            except subprocess.TimeoutExpired as exc:
                raw = exc.stdout or ""
                stderr = exc.stderr or ""
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="replace")
                if isinstance(stderr, bytes):
                    stderr = stderr.decode("utf-8", errors="replace")
                raise ProviderError(f"timeout after {timeout_s}s", raw, stderr) from exc
            latency = time.monotonic() - started
        payload = self._parse(out.stdout) if out.stdout.strip() else {}
        error = payload.get("error")
        if error or out.returncode != 0:
            message = (json.dumps(error) if error else "") or out.stderr[-1000:]
            _check_limits(message, "gemini")
            raise ProviderError(f"gemini exited {out.returncode}: {message}", out.stdout, out.stderr)
        stats = payload.get("stats") or {}
        resolved_models = sorted((stats.get("models") or {}).keys())
        tool_calls = (stats.get("tools") or {}).get("totalCalls", 0)
        if tool_calls:
            raise GuardError(f"Gemini isolation failed: observed {tool_calls} tool calls")
        if resolved_models != [self.model]:
            raise GuardError(f"expected model {self.model}, observed {resolved_models}")
        reply = payload.get("response") or ""
        if not reply.strip():
            raise ProviderError("gemini returned an empty response", out.stdout, out.stderr)
        return Completion(replies=[reply], raw=out.stdout, stderr=out.stderr, tool_calls=tool_calls,
                          latency_s=latency, usage=stats,
                          settings={"effort": self.effort, "thinkingLevel": self.effort.upper()
                                    if self.effort in self.THINKING_LEVELS else "cli default",
                                    "temperature": "cli default (not settable)", "tools": "none",
                                    "resolvedModels": resolved_models, "cliVersion": self.cli_version,
                                    "overageStrategy": "never"})


class OpenAICompatProvider(Provider):
    """Plain chat-completions API (OpenRouter by default, or Lambda). Uses the user's own key; never a shared key.

    `effort_field` picks how reasoning effort is sent: OpenRouter's `reasoning: {effort}` object or the OpenAI-style
    top-level `reasoning_effort`. With `check_model_listed`, preflight confirms the model id via GET /models, which
    lists metadata only and runs no inference.
    """

    def __init__(self, model: str, base_url: str | None = None, key_env: str = "OPENROUTER_API_KEY",
                 temperature: float | None = 1.0, effort: str | None = "low", prefix: str = "openrouter",
                 effort_field: str = "reasoning", check_model_listed: bool = False, extra_body: dict | None = None):
        self.model = model
        self.selector = f"{prefix}:{model}"
        self.base_url = (base_url or os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")).rstrip("/")
        self.key_env = key_env
        self.temperature = temperature
        self.effort = effort
        self.effort_field = effort_field
        self.check_model_listed = check_model_listed
        self.extra_body = extra_body or {}
        self._supported_params: set[str] | None = None

    def supported_params(self) -> set[str] | None:
        """OpenRouter's supported_parameters for this model (public metadata, no inference), cached; None if unknown."""
        if self._supported_params is None and "openrouter.ai" in self.base_url:
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{self.base_url}/models"), timeout=60) as response:
                    models = json.loads(response.read()).get("data", [])
                found = next((m for m in models if m.get("id") == self.model), None)
                self._supported_params = set(found.get("supported_parameters") or []) if found else set()
            except (urllib.error.URLError, TimeoutError, ValueError):
                return None
        return self._supported_params

    def effective_temperature(self) -> float | None:
        # Models that reason on every call (e.g. Fable 5.2) take no temperature; sending one makes OpenRouter's
        # require_parameters routing find no host. Such models run at their provider default, as in the CLIs.
        supported = self.supported_params()
        if self.temperature is None or (supported is not None and "temperature" not in supported):
            return None
        return self.temperature

    def _get(self, path: str, timeout_s: float = 60) -> dict:
        request = urllib.request.Request(f"{self.base_url}{path}",
                                         headers={"Authorization": f"Bearer {os.environ[self.key_env]}"})
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:500]
            raise GuardError(f"{self.selector}: GET {path} failed with HTTP {exc.code}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise GuardError(f"{self.selector}: GET {path} failed: {exc}") from exc

    def preflight(self) -> dict:
        if not os.environ.get(self.key_env):
            raise GuardError(f"{self.key_env} is not set")
        report = {"baseUrl": self.base_url}
        if self.check_model_listed:
            listed = sorted(m.get("id", "") for m in self._get("/models").get("data", []))
            if self.model not in listed:
                raise GuardError(f"{self.model} is not listed at {self.base_url}/models; available: {listed}")
            report["modelListed"] = True
        return report

    def complete(self, turns: tuple[str, ...], system: str | None, timeout_s: float) -> Completion:
        messages = [{"role": "system", "content": system}] if system else []
        replies, raws, started = [], [], time.monotonic()
        for turn in turns:
            messages.append({"role": "user", "content": turn})
            body = {"model": self.model, "messages": messages, **self.extra_body}
            temperature = self.effective_temperature()
            if temperature is not None:
                body["temperature"] = temperature
            if self.effort:
                if self.effort_field == "reasoning_effort":
                    body["reasoning_effort"] = self.effort
                elif self.effort == "none":
                    body["reasoning"] = {"enabled": False}  # reasoning switched off where the model allows it
                else:
                    body["reasoning"] = {"effort": self.effort}
            request = urllib.request.Request(
                f"{self.base_url}/chat/completions", data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {os.environ[self.key_env]}", "Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(request, timeout=timeout_s) as response:
                    payload = json.loads(response.read())
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode(errors="replace")[:1000]
                if exc.code in (402, 429):
                    raise UsageLimitHit(f"HTTP {exc.code}: {detail}") from exc
                if PLATFORM_BLOCK_PATTERN.search(detail) or (exc.code == 403 and re.search(r"flagged|moderation", detail, re.I)):
                    # A provider's safety classifier refused before the model answered.
                    raise PlatformBlocked(f"{self.selector} platform policy block: HTTP {exc.code}: {detail}",
                                          detail) from exc
                raise ProviderError(f"HTTP {exc.code}: {detail}") from exc
            except (urllib.error.URLError, TimeoutError) as exc:
                raise ProviderError(str(exc)) from exc
            choice = payload["choices"][0]
            finish, native = choice.get("finish_reason"), choice.get("native_finish_reason")
            if native == "refusal" or finish in ("refusal", "content_filter"):
                # Anthropic's stop_reason "refusal" (safety classifier) surfaces as native_finish_reason on OpenRouter.
                raise PlatformBlocked(f"{self.selector} classifier refusal (finish_reason={finish}, "
                                      f"native_finish_reason={native})", json.dumps(payload))
            reply = choice["message"].get("content") or ""
            messages.append({"role": "assistant", "content": reply})
            replies.append(reply)
            raws.append(payload)
        usage: dict[str, int] = {}
        for payload in raws:
            for key, value in (payload.get("usage") or {}).items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):  # tokens, and OpenRouter's cost
                    usage[key] = usage.get(key, 0) + value
                elif isinstance(value, dict):  # e.g. completion_tokens_details.reasoning_tokens
                    for sub, n in value.items():
                        if isinstance(n, int) and not isinstance(n, bool):
                            usage[f"{key}.{sub}"] = usage.get(f"{key}.{sub}", 0) + n
        return Completion(replies=replies, raw=json.dumps(raws), latency_s=time.monotonic() - started, usage=usage,
                          settings={"temperature": self.effective_temperature() if self.effective_temperature() is not None
                                    else "provider default (not supported)", "effort": self.effort,
                                    "effortField": self.effort_field if self.effort else None,
                                    "resolvedModels": sorted({p.get("model") for p in raws if p.get("model")}),
                                    # OpenRouter reports which hosting company served each request.
                                    "upstreamProviders": sorted({p["provider"] for p in raws if p.get("provider")}),
                                    "requestOptions": self.extra_body})


LAMBDA_BASE_URL = "https://api.lambda.ai/v1"


def token_summary(usage: dict | None) -> dict:
    """One shape for every provider's usage record: input, output and reasoning tokens (None when not reported).

    Numbers are as each provider reports them; whether `output` already includes reasoning differs by provider,
    so compare `output` within a provider and keep the raw `usage` record for anything finer.
    """
    usage = usage or {}
    def total(*values):
        found = [v for v in values if isinstance(v, int) and not isinstance(v, bool)]
        return sum(found) if found else None
    if "prompt_tokens" in usage or "completion_tokens" in usage:  # OpenAI-compatible APIs (Lambda, OpenRouter)
        return {"input": total(usage.get("prompt_tokens")), "output": total(usage.get("completion_tokens")),
                "reasoning": total(usage.get("completion_tokens_details.reasoning_tokens"))}
    if isinstance(usage.get("usage"), dict):  # Claude Code result event
        u = usage["usage"]
        return {"input": total(u.get("input_tokens"), u.get("cache_read_input_tokens"),
                               u.get("cache_creation_input_tokens")),
                "output": total(u.get("output_tokens")), "reasoning": None}
    if "output_tokens" in usage or "input_tokens" in usage:  # Codex turn.completed
        return {"input": total(usage.get("input_tokens")), "output": total(usage.get("output_tokens")),
                "reasoning": total(usage.get("reasoning_output_tokens"))}
    if isinstance(usage.get("models"), dict):  # Gemini CLI stats
        tokens = [m.get("tokens") or {} for m in usage["models"].values()]
        return {"input": total(*[t.get("prompt") for t in tokens]),
                "output": total(*[t.get("candidates") for t in tokens]),
                "reasoning": total(*[t.get("thoughts") for t in tokens])}
    return {"input": None, "output": None, "reasoning": None}


def make_provider(selector: str, effort: str | None = None, expected_model: str | None = None) -> Provider:
    """`codex:<model>`, `claude-code:<model>`, `gemini-cli:<model>`, `openrouter:<vendor/model>` or `lambda:<model>`.

    No effort = the provider's lowest.
    """
    kind, _, model = selector.partition(":")
    if not model:
        raise ValueError(f"selector needs a provider prefix: {selector}")
    if kind == "claude-code":
        return ClaudeCodeProvider(model, effort or "low", expected_model=expected_model)
    if kind == "codex":
        return CodexProvider(model, effort or "none")
    if kind == "gemini-cli":
        return GeminiCliProvider(model, effort or "low")
    if kind == "openrouter":
        # The scenarios are a private test set: route only to hosts that neither store nor train on prompts, and only
        # to hosts that honour the reasoning setting, so the requested effort is really applied. OpenRouter also
        # reports each call's actual cost.
        return OpenAICompatProvider(model, effort=effort or "low",
                                    extra_body={"provider": {"data_collection": "deny", "require_parameters": True},
                                                "usage": {"include": True}})
    if kind == "lambda":
        return OpenAICompatProvider(model, base_url=os.environ.get("LAMBDA_BASE_URL", LAMBDA_BASE_URL),
                                    key_env="LAMBDA_API_KEY", effort=effort or "low", prefix="lambda",
                                    effort_field="reasoning_effort", check_model_listed=True)
    raise ValueError(f"unknown provider {kind!r}")
