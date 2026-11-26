"""AWS timeline endpoints: severity tabs, user list, per-user summary.

No live Postgres: storage is monkeypatched, so these exercise only the
endpoint logic (tab -> severity filter, counts, per-user summary).
"""

from __future__ import annotations

from blackwatch import api


def _event(action, *, principal="alice", sev=None, outcome="success", ip="203.0.113.5", t="2026-11-25T10:00:00+00:00"):
    return {
        "event_id": f"{action}-{t}",
        "event_time": t,
        "action": action,
        "outcome": outcome,
        "severity": sev,
        "actor": {"principal": principal, "source_ip": ip},
    }


def test_tab_maps_to_severity_filter(monkeypatch):
    seen = {}

    def fake_query(**kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(api.storage, "query_events", fake_query)
    monkeypatch.setattr(api.storage, "aws_activity_severity_counts", lambda **k: {"critical": 2, "high": 3, "none": 10})
    monkeypatch.setattr(api.storage, "aws_activity_users", lambda **k: [])

    out = api.aws_timeline_view(tab="critical", hours=24, limit=50)
    assert seen["severities"] == ["critical"]
    assert seen["module"] == "aws.cloudtrail"
    assert out["counts"] == {"critical": 2, "high": 3, "all": 15}

    api.aws_timeline_view(tab="high", hours=24, limit=50)
    assert seen["severities"] == ["high"]

    api.aws_timeline_view(tab="all", hours=24, limit=50)
    assert seen["severities"] is None


def test_user_summary_counts_failures_ips_and_actions(monkeypatch):
    events = [
        _event("iam.user.create", sev="high", t="2026-11-25T10:00:00+00:00"),
        _event("auth.console.login", outcome="failure", ip="198.51.100.9", t="2026-11-25T09:00:00+00:00"),
        _event("auth.console.login", t="2026-11-25T08:00:00+00:00"),
    ]
    monkeypatch.setattr(api.storage, "query_events", lambda **k: events)

    out = api.aws_timeline_user(principal="alice", hours=168, limit=500)
    s = out["summary"]
    assert s["events"] == 3
    assert s["failed"] == 1
    assert s["first_seen"] == "2026-11-25T08:00:00+00:00"
    assert s["last_seen"] == "2026-11-25T10:00:00+00:00"
    assert dict(s["top_actions"])["auth.console.login"] == 2
    assert dict(s["source_ips"])["203.0.113.5"] == 2
    assert s["severities"] == {"high": 1, "none": 2}
    assert out["truncated"] is False


def test_user_timeline_reports_truncation(monkeypatch):
    monkeypatch.setattr(api.storage, "query_events", lambda **k: [_event("a")] * 3)
    out = api.aws_timeline_user(principal="alice", hours=24, limit=3)
    assert out["truncated"] is True


def test_user_with_no_events_has_empty_summary(monkeypatch):
    monkeypatch.setattr(api.storage, "query_events", lambda **k: [])
    out = api.aws_timeline_user(principal="nobody", hours=24, limit=10)
    assert out["summary"]["events"] == 0
    assert out["summary"]["first_seen"] is None
