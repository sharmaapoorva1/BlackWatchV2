"""VPN workflow: silent-failure checks, login-after-failures, risky sources,
concurrent-session de-duplication, renewed-but-not-deployed certificates, and
the notification text for the new alerts. No database required."""

from datetime import datetime, timedelta, timezone

import blackwatch.correlation as correlation
from blackwatch import pipeline
from blackwatch.event import Actor, Event, Outcome, Source, Target
from blackwatch.modules import registry
from blackwatch.modules.base import IngestContext
from blackwatch.modules.vpn_openvpn import VpnOpenVpnAdapter
from blackwatch.notify import profile_service
from blackwatch.notify.profiles import normalize_profile
from blackwatch.vpn import staleness
from blackwatch.vpn.projection import detect_concurrent, risky_source_reasons

NOW = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


# ---------- concurrent sessions alert once, not every snapshot ----------

def _clients(*pairs):
    return [{"common_name": n, "real_ip": ip, "real_address": f"{ip}:1"} for n, ip in pairs]


def test_concurrent_alerts_on_first_sight_then_stays_quiet():
    now = _clients(("alice", "1.1.1.1"), ("alice", "2.2.2.2"))
    first = detect_concurrent("vpn-1", now, NOW, previous=_clients(("alice", "1.1.1.1")))
    assert [e.action for e in first] == ["vpn.session.concurrent"]
    again = detect_concurrent("vpn-1", now, NOW, previous=now)
    assert again == []


def test_concurrent_alerts_again_when_the_ip_set_changes():
    before = _clients(("alice", "1.1.1.1"), ("alice", "2.2.2.2"))
    after = _clients(("alice", "1.1.1.1"), ("alice", "2.2.2.2"), ("alice", "3.3.3.3"))
    assert len(detect_concurrent("vpn-1", after, NOW, previous=before)) == 1


def test_concurrent_without_previous_keeps_old_behaviour():
    assert len(detect_concurrent("vpn-1", _clients(("a", "1.1.1.1"), ("a", "2.2.2.2")), NOW)) == 1


# ---------- risky source ----------

def test_risky_source_reasons():
    assert risky_source_reasons(None) == []
    assert risky_source_reasons({"feeds": [], "is_tor": False}) == []
    assert risky_source_reasons({"feeds": ["tor_exit"], "is_tor": True}) == ["Tor exit node"]
    assert risky_source_reasons({"feeds": ["spamhaus_drop"], "is_tor": False}) == ["listed in spamhaus_drop"]


# ---------- login after failures ----------

def _auth(action, ip="9.9.9.9", user="alice"):
    return Event(
        source=Source(module="vpn.openvpn"),
        action=action,
        outcome=Outcome.failure if action.endswith("failure") else Outcome.success,
        actor=Actor(principal=user, source_ip=ip),
        target=Target(id="vpn-1", type="vpn.server", name="vpn-1"),
    )


def setup_function(_fn):
    correlation.reset_state()


def _feed(monkeypatch, failures):
    monkeypatch.setattr(correlation, "_now", lambda: 1000.0)
    for _ in range(failures):
        correlation.observe(_auth("vpn.auth.failure"))


def test_success_after_a_typo_or_two_does_not_alert(monkeypatch):
    _feed(monkeypatch, correlation.THRESHOLD - 1)
    assert correlation.observe(_auth("vpn.auth.success")) == []


def test_success_after_a_burst_alerts_once(monkeypatch):
    _feed(monkeypatch, correlation.THRESHOLD)
    out = correlation.observe(_auth("vpn.auth.success"))
    assert [e.action for e in out] == ["vpn.auth.success_after_failures"]
    assert out[0].extra["failures_in_window"] >= correlation.THRESHOLD
    assert out[0].actor.source_ip == "9.9.9.9"
    assert correlation.observe(_auth("vpn.auth.success")) == []  # same window: no repeat


def test_success_from_another_ip_after_user_stuffing_alerts(monkeypatch):
    monkeypatch.setattr(correlation, "_now", lambda: 1000.0)
    for i in range(correlation.THRESHOLD):
        correlation.observe(_auth("vpn.auth.failure", ip=f"10.0.0.{i}"))
    out = correlation.observe(_auth("vpn.auth.success", ip="203.0.113.7"))
    assert [e.extra["dimension"] for e in out] == ["principal"]


def test_old_failures_do_not_count(monkeypatch):
    _feed(monkeypatch, correlation.THRESHOLD)
    monkeypatch.setattr(correlation, "_now", lambda: 1000.0 + correlation.WINDOW_SECONDS + 5)
    assert correlation.observe(_auth("vpn.auth.success")) == []


# ---------- silence checks ----------

def _row(**over):
    base = {"server": "vpn-1", "updated_at": NOW, "active": True, "agent_stale": False, "no_login_alerted": False}
    base.update(over)
    return base


def test_agent_stale_after_five_missed_beats_once():
    assert not staleness.agent_is_stale(_row(updated_at=NOW - timedelta(seconds=120)), NOW)
    assert staleness.agent_is_stale(_row(updated_at=NOW - timedelta(seconds=400)), NOW)
    assert not staleness.agent_is_stale(_row(updated_at=NOW - timedelta(seconds=400), agent_stale=True), NOW)


def test_logins_silent_only_for_a_healthy_recently_used_server():
    long_ago = NOW - timedelta(hours=30)
    assert staleness.logins_are_silent(_row(), long_ago, NOW, hours=24)
    assert not staleness.logins_are_silent(_row(), NOW - timedelta(hours=3), NOW, hours=24)
    assert not staleness.logins_are_silent(_row(), None, NOW, hours=24)  # never used
    assert not staleness.logins_are_silent(_row(active=False), long_ago, NOW, hours=24)  # service-down alert owns this
    assert not staleness.logins_are_silent(_row(agent_stale=True), long_ago, NOW, hours=24)
    assert not staleness.logins_are_silent(_row(no_login_alerted=True), long_ago, NOW, hours=24)
    assert not staleness.logins_are_silent(_row(), NOW - timedelta(days=40), NOW, hours=24)  # long unused


# ---------- certificates: renewed in the PKI, never copied ----------

def _cert(source, days, name="server_a"):
    return {"kind": "server", "name": name, "source": source, "days_remaining": days,
            "not_after": f"in {days} days", "path": f"/{source}/{name}.crt"}


def _parse_certs(certs):
    ctx = IngestContext(module="vpn.openvpn", transport="queue")
    return VpnOpenVpnAdapter().parse({"server": "vpn-1", "certs": certs}, ctx)


def test_renewed_but_not_deployed_is_reported():
    events = _parse_certs([_cert("pki", 700), _cert("live", 5)])
    mismatch = [e for e in events if e.action == "vpn.cert.renewed_not_deployed"]
    assert len(mismatch) == 1
    assert mismatch[0].extra["live_days_remaining"] == 5
    assert mismatch[0].extra["pki_days_remaining"] == 700
    # Same inputs on the next heartbeat produce the same id, so it dedupes.
    again = [e for e in _parse_certs([_cert("pki", 700), _cert("live", 5)]) if e.action == "vpn.cert.renewed_not_deployed"]
    assert again[0].event_id == mismatch[0].event_id


def test_matching_or_single_copies_are_not_reported():
    for certs in ([_cert("pki", 300), _cert("live", 300)], [_cert("live", 5)], [_cert("pki", 5)]):
        assert not [e for e in _parse_certs(certs) if e.action == "vpn.cert.renewed_not_deployed"]


# ---------- duplicate deliveries must not be projected twice ----------

def test_duplicate_events_skip_projections(monkeypatch):
    registry.register_builtins()
    seen = []
    monkeypatch.setattr(pipeline, "_process", lambda event: {"event_id": event.event_id, "action": event.action, "duplicate": True})
    monkeypatch.setattr(pipeline, "_PROJECTIONS", [lambda event: seen.append(event.action) or []])
    monkeypatch.setattr(pipeline.noise, "is_muted", lambda event: False)
    monkeypatch.setattr(pipeline.intel_enrich, "enrich_event", lambda event: None)
    line = {"MESSAGE": "x SENT CONTROL [alice]: 'AUTH_FAILED'", "__CURSOR": "c1", "__REALTIME_TIMESTAMP": "1756000000000000"}
    pipeline.ingest_payload("vpn.openvpn", {"server": "vpn-1", "auth_lines": [line]}, transport="queue")
    assert seen == []


# ---------- notification text ----------

NEW_KINDS = [
    "vpn.agent.stale",
    "vpn.agent.recovered",
    "vpn.logins.silent",
    "vpn.auth.success_after_failures",
    "vpn.auth.risky_source",
    "vpn.cert.renewed_not_deployed",
]


def test_new_alerts_render_short_and_complete():
    for kind in NEW_KINDS:
        profile = normalize_profile({"module": "vpn.openvpn", "event_kind": kind, "severities": ["high"]})
        text = profile_service.render_preview(profile, "slack")
        assert "Next steps:" in text, kind
        assert "Decision:" in text, kind
        assert len(text) < 1200, f"{kind} is {len(text)} chars"
        # No glued lines (a newline swallowed by the template engine).
        assert "FAILEDMonitoring" not in text and "crtDecision" not in text, kind


def test_login_alerts_show_where_the_ip_is_from():
    profile = normalize_profile({"module": "vpn.openvpn", "event_kind": "vpn.auth.risky_source", "severities": ["high"]})
    text = profile_service.render_preview(profile, "slack")
    assert "Origin: DE" in text and "Tor exit" in text and "Flagged as:" in text
