"""RDS workflow: silent log feeds, login after repeated failures, origin facts
on alerts, and the notification text for the new alerts. No database required."""

from datetime import datetime, timedelta, timezone

import pytest

from blackwatch import storage
from blackwatch.event import Actor, Event, Outcome, Source, Target
from blackwatch.notify import profile_service
from blackwatch.notify.profiles import normalize_profile
from blackwatch.rds import projection, silence

NOW = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


# ---------- silence decision ----------

def test_threshold_is_the_floor_for_a_busy_database():
    assert silence.silence_threshold(60) == timedelta(minutes=silence.MIN_SILENT_MINUTES)
    assert silence.silence_threshold(None) == timedelta(minutes=silence.MIN_SILENT_MINUTES)


def test_threshold_grows_with_the_databases_own_gaps():
    gap = 8 * 3600  # this database goes quiet for 8h at night
    assert silence.silence_threshold(gap) == timedelta(hours=24)


def test_silent_needs_history_and_a_long_quiet_period():
    hours = lambda h: NOW - timedelta(hours=h)  # noqa: E731
    busy = silence.MIN_HISTORY_EVENTS + 10
    assert silence.is_silent(hours(5), busy, 300, NOW, already_flagged=False)
    assert not silence.is_silent(hours(1), busy, 300, NOW, already_flagged=False)         # not quiet long enough
    assert not silence.is_silent(hours(5), 10, 300, NOW, already_flagged=False)           # too little history
    assert not silence.is_silent(hours(5), busy, 300, NOW, already_flagged=True)          # already told
    assert not silence.is_silent(None, busy, 300, NOW, already_flagged=False)
    assert not silence.is_silent(hours(5), busy, 8 * 3600, NOW, already_flagged=False)    # normal overnight gap


# ---------- projection helpers ----------

def _start(user="alice", db="prod-db", ip="10.0.0.5"):
    return Event(
        source=Source(module="aws.rds"),
        event_time=NOW,
        action="rds.session.start",
        outcome=Outcome.success,
        actor=Actor(principal=user, source_ip=ip),
        target=Target(id=db, type="rds.db", name=db),
        extra={"session_id": "s1", "db_instance": db, "user": user, "source_ip": ip},
    )


@pytest.fixture
def fake_storage(monkeypatch):
    state = {"failures": 0, "kind": "human", "silent_flag": []}
    monkeypatch.setattr(storage, "upsert_rds_session_start", lambda *a, **k: None)
    monkeypatch.setattr(storage, "list_rds_active_sessions", lambda **k: [])
    monkeypatch.setattr(storage, "is_rds_user_allowlisted", lambda user: True)
    monkeypatch.setattr(storage, "upsert_rds_user_source", lambda *a, **k: False)
    monkeypatch.setattr(storage, "rds_user_kind", lambda user: state["kind"])
    monkeypatch.setattr(storage, "query_events", lambda **k: [{"actor_source_ip": "9.9.9.9"}] * state["failures"])
    monkeypatch.setattr(storage, "set_rds_silent", lambda db, flag: state["silent_flag"].append((db, flag)))
    silence.silent_dbs.clear()
    return state


def test_login_after_a_burst_alerts_for_a_human(fake_storage):
    fake_storage["failures"] = projection.BURST_THRESHOLD
    out = projection.project(_start())
    assert [e.action for e in out] == ["rds.auth.success_after_failures"]
    assert out[0].extra["failure_count"] == projection.BURST_THRESHOLD
    assert out[0].event_id  # deterministic per user per hour, so it dedupes


def test_login_after_a_few_failures_stays_quiet(fake_storage):
    fake_storage["failures"] = projection.BURST_THRESHOLD - 1
    assert projection.project(_start()) == []


def test_service_accounts_are_skipped(fake_storage):
    fake_storage.update(failures=projection.BURST_THRESHOLD + 3, kind="service")
    assert projection.project(_start()) == []


def test_activity_after_silence_emits_resumed_and_clears_the_flag(fake_storage):
    silence.silent_dbs.add("prod-db")
    out = projection.project(_start())
    assert [e.action for e in out] == ["rds.logs.resumed"]
    assert "prod-db" not in silence.silent_dbs
    assert fake_storage["silent_flag"] == [("prod-db", False)]
    assert projection.project(_start()) == []  # only once


def test_our_own_sweep_events_do_not_count_as_activity(fake_storage):
    silence.silent_dbs.add("prod-db")
    sweep = _start()
    sweep.action = "rds.session.long_idle"
    assert projection.project(sweep) == []
    assert "prod-db" in silence.silent_dbs


# ---------- notification text ----------

NEW_KINDS = ["rds.logs.silent", "rds.logs.resumed", "rds.auth.success_after_failures"]


def test_new_alerts_render_short_and_complete():
    for kind in NEW_KINDS:
        profile = normalize_profile({"module": "aws.rds", "event_kind": kind, "severities": ["high"]})
        text = profile_service.render_preview(profile, "slack")
        assert "Next steps:" in text and "Decision:" in text, kind
        assert len(text) < 1300, f"{kind} is {len(text)} chars"


def test_existing_alerts_gain_only_a_short_origin_fact():
    profile = normalize_profile({"module": "aws.rds", "event_kind": "rds.proxy.source.new", "severities": ["high"]})
    with_origin = profile_service.render_preview(profile, "slack")
    assert "New RDS proxy source" in with_origin
    assert len(with_origin) < 1500
