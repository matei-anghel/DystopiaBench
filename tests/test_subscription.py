import pytest

from dystopiabench.providers import ClaudeCodeProvider, GuardError, UsageLimitHit


def status(used=20, enabled=False):
    return {"extra_usage": {"is_enabled": enabled}, "spend": {"enabled": enabled},
            "five_hour": {"utilization": used}, "seven_day": {"utilization": 30}}


def test_disabled_paid_usage_and_allowance_are_required():
    result = ClaudeCodeProvider._validate_subscription_usage(status())
    assert result["extraUsageEnabled"] is False
    assert result["five_hour"]["usedPercent"] == 20
    for enabled in (True, None, "false"):
        with pytest.raises(GuardError):
            ClaudeCodeProvider._validate_subscription_usage(status(enabled=enabled))
    with pytest.raises(GuardError):
        ClaudeCodeProvider._validate_subscription_usage({})


def test_stop_before_exhausting_subscription_allowance():
    for used in (85, 99, 100):
        with pytest.raises(UsageLimitHit):
            ClaudeCodeProvider._validate_subscription_usage(status(used=used))
    for used in (None, True, "20", -1, 101):
        with pytest.raises(GuardError):
            ClaudeCodeProvider._validate_subscription_usage(status(used=used))


def test_allowance_snapshot_is_reused_for_at_most_five_minutes(monkeypatch, tmp_path):
    import io
    import json
    from dystopiabench import providers
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    monkeypatch.setattr(providers.time, "time", lambda: 100)
    p = ClaudeCodeProvider("claude-haiku-5-5")
    p.home = tmp_path / "missing-credential-home"
    monkeypatch.setattr(p, "_oauth_access_token", lambda: "test-token")
    requests = []
    def read_status(*args, **kwargs):
        requests.append(args)
        return io.StringIO(json.dumps(status()))
    monkeypatch.setattr(providers.urllib.request, "urlopen", read_status)
    p._subscription_snapshot = {"checkedAt": 50, "extraUsageEnabled": False}
    assert p.subscription_usage() is p._subscription_snapshot
    assert not requests
    monkeypatch.setattr(providers.time, "time", lambda: 351)
    assert p.subscription_usage()["five_hour"]["usedPercent"] == 20
    assert len(requests) == 1


def billing_profile():
    return {"account": {"uuid": "test-account"}, "organization": {
        "uuid": "test-org", "billing_type": "stripe_subscription", "subscription_status": "active",
        "has_extra_usage_enabled": False}}


def test_profile_fallback_requires_same_active_subscription_and_disabled_paid_usage():
    import copy
    payload = billing_profile()
    result = ClaudeCodeProvider._validate_billing_profile(payload, "test-account", "test-org")
    assert result["extraUsageEnabled"] is False and result["source"] == "oauth_profile"
    for key, value in (("billing_type", "api"), ("subscription_status", "inactive"),
                       ("has_extra_usage_enabled", True), ("has_extra_usage_enabled", None)):
        bad = copy.deepcopy(payload)
        bad["organization"][key] = value
        with pytest.raises(GuardError):
            ClaudeCodeProvider._validate_billing_profile(bad, "test-account", "test-org")
    with pytest.raises(GuardError):
        ClaudeCodeProvider._validate_billing_profile(payload, "different-account", "test-org")
    with pytest.raises(GuardError):
        ClaudeCodeProvider._validate_billing_profile(payload, "test-account", "different-org")


def test_only_throttled_allowance_checks_use_independent_billing_proof(monkeypatch, tmp_path):
    import io
    import json
    import urllib.error
    from dystopiabench import providers
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    p = ClaudeCodeProvider("claude-haiku-5-5")
    p.home = tmp_path
    monkeypatch.setattr(p, "_oauth_access_token", lambda: "test-token")
    (tmp_path / ".claude.json").write_text(json.dumps({"oauthAccount": {
        "accountUuid": "test-account", "organizationUuid": "test-org"}}))
    urls = []
    def read(request, **kwargs):
        urls.append(request.full_url)
        if request.full_url.endswith("/usage"):
            raise urllib.error.HTTPError(request.full_url, 429, "throttled", {}, None)
        return io.StringIO(json.dumps(billing_profile()))
    monkeypatch.setattr(providers.urllib.request, "urlopen", read)
    assert p.subscription_usage()["subscriptionActive"] is True
    assert [url.rsplit('/', 1)[-1] for url in urls] == ["usage", "profile"]
    p._subscription_snapshot = None
    def denied(request, **kwargs):
        raise urllib.error.HTTPError(request.full_url, 401, "expired", {}, None)
    monkeypatch.setattr(providers.urllib.request, "urlopen", denied)
    with pytest.raises(GuardError, match="HTTP 401"):
        p.subscription_usage()


def test_expired_subscription_requires_official_login_before_any_network(monkeypatch, tmp_path):
    import json
    from dystopiabench import providers
    monkeypatch.setattr(providers, "_npm_shim_target", lambda name: [name])
    monkeypatch.setattr(providers.time, "time", lambda: 100)
    p = ClaudeCodeProvider("claude-haiku-5-5")
    p.home = tmp_path
    (tmp_path / ".credentials.json").write_text(json.dumps({"claudeAiOauth": {
        "accessToken": "test-token", "expiresAt": 1, "refreshToken": "test-refresh"}}))
    def forbidden(*args, **kwargs):
        raise AssertionError("expired credentials must not start network traffic or inference")
    monkeypatch.setattr(providers.urllib.request, "urlopen", forbidden)
    with pytest.raises(GuardError, match="official"):
        p.subscription_usage()
