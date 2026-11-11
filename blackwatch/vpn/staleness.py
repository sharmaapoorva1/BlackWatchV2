"""Silence detection for the VPN: the failures a heartbeat can never report.

Two checks, run by the connector scheduler:

  * vpn.agent.stale   the on-box agent stopped reporting (agent or box is dead,
                      so no service-down heartbeat can ever arrive).
  * vpn.logins.silent the service looks healthy but nobody has logged in for a
                      long time, which is what a blocked port or a broken
                      certificate looks like from the server side.

Each fires once per episode. The next heartbeat (agent) or successful login
(logins) clears its flag in the projection, which also emits the recovery."""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .. import pipeline, storage
from ..event import Actor, Category, Event, Outcome, Source, Target, Transport

# The agent heartbeats every 60 seconds, so five missed beats is not jitter.
STALE_AFTER_SECONDS = 300
# Hours without a successful login before we call it silent. Raise it if your
# team really is offline for long stretches (weekends, holidays).
NO_LOGIN_HOURS = float(os.environ.get("BLACKWATCH_VPN_NO_LOGIN_HOURS", "24"))
# Only judge silence on servers that were in use recently; a VPN used once a
# month is not "silent".
ACTIVE_WITHIN_DAYS = 7
# Logins are looked up at most this often; it is a database query.
_LOGIN_CHECK_EVERY_SECONDS = 600
_last_login_check: dict[str, float] = {}


def agent_is_stale(row: dict[str, Any], now: datetime, after_seconds: int = STALE_AFTER_SECONDS) -> bool:
    """True when the agent has gone quiet and we have not already said so."""
    updated = row.get("updated_at")
    if updated is None or row.get("agent_stale"):
        return False
    return (now - updated).total_seconds() > after_seconds


def logins_are_silent(
    row: dict[str, Any],
    last_login: datetime | None,
    now: datetime,
    hours: float = NO_LOGIN_HOURS,
) -> bool:
    """True when a healthy, recently used VPN has had no login for `hours`."""
    if row.get("no_login_alerted") or row.get("agent_stale"):
        return False
    if not row.get("active"):  # service down is its own alert
        return False
    if last_login is None:
        return False
    if now - last_login <= timedelta(hours=hours):
        return False
    return now - last_login <= timedelta(days=ACTIVE_WITHIN_DAYS) + timedelta(hours=hours)


def _event(action: str, server: str, now: datetime, extra: dict[str, Any]) -> Event:
    return Event(
        source=Source(module="vpn.openvpn", transport=Transport.poll),
        event_time=now,
        category=Category.vpn,
        action=action,
        outcome=Outcome.failure,
        actor=Actor(),
        target=Target(id=server, type="vpn.server", name=server),
        extra={"server": server, "derived": True, **extra},
        raw={"derived": "vpn_staleness"},
    )


def check() -> None:
    now = datetime.now(timezone.utc)
    try:
        rows = storage.list_vpn_status()
    except Exception:
        return
    for row in rows:
        server = row["server"]
        if agent_is_stale(row, now):
            updated = row["updated_at"]
            event = _event(
                "vpn.agent.stale", server, now,
                {"last_seen": updated.isoformat(), "age_seconds": int((now - updated).total_seconds())},
            )
            try:
                pipeline.process_event(event)
                storage.set_vpn_flag(server, "agent_stale", True)
            except Exception:
                pass
            continue
        if row.get("no_login_alerted") or row.get("agent_stale") or not row.get("active"):
            continue
        if time.monotonic() - _last_login_check.get(server, -1e9) < _LOGIN_CHECK_EVERY_SECONDS:
            continue
        _last_login_check[server] = time.monotonic()
        try:
            last_login = storage.last_vpn_login(server)
        except Exception:
            continue
        if logins_are_silent(row, last_login, now):
            event = _event(
                "vpn.logins.silent", server, now,
                {
                    "last_login": last_login.isoformat(),
                    "hours_since": int((now - last_login).total_seconds() // 3600),
                    "threshold_hours": NO_LOGIN_HOURS,
                },
            )
            try:
                pipeline.process_event(event)
                storage.set_vpn_flag(server, "no_login_alerted", True)
            except Exception:
                pass
