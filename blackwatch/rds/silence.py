"""RDS log-feed silence: the failure no log line can report about itself.

If the CloudWatch subscription filter is removed, the forwarder Lambda breaks,
or the queue stops draining, BlackWatch simply receives nothing, and nothing
looks wrong. A database that normally logs sessions and logins going quiet is
the only signal we get.

"Quiet" has to be judged per database, because a pooled application can
legitimately go hours without a new session. The threshold is therefore the
larger of a fixed floor and a multiple of the longest gap seen in the last
week, and a database needs enough history before we judge it at all.

This module is pure decision logic plus a small in-memory set of databases
currently flagged silent, so the projection can notice recovery without a
database read per event. The scheduler sweep lives in staleness.py."""

from __future__ import annotations

import os
from datetime import datetime, timedelta

# Never call a database silent for less than this, however chatty it is.
MIN_SILENT_MINUTES = float(os.environ.get("BLACKWATCH_RDS_SILENT_MINUTES", "120"))
# Silent means quieter than this many times its own longest recent gap.
GAP_MULTIPLE = 3.0
# A database must have logged at least this many events in the last week.
MIN_HISTORY_EVENTS = 50

# Databases currently flagged silent. Refreshed from the database by the sweep.
silent_dbs: set[str] = set()


def silence_threshold(max_gap_seconds: float | None) -> timedelta:
    """How long a database may stay quiet before it is called silent."""
    floor = timedelta(minutes=MIN_SILENT_MINUTES)
    if not max_gap_seconds:
        return floor
    return max(floor, timedelta(seconds=max_gap_seconds * GAP_MULTIPLE))


def is_silent(
    last_event: datetime | None,
    events_7d: int,
    max_gap_seconds: float | None,
    now: datetime,
    already_flagged: bool,
) -> bool:
    """True when a database with enough history has been quiet too long."""
    if already_flagged or last_event is None:
        return False
    if events_7d < MIN_HISTORY_EVENTS:
        return False
    return now - last_event > silence_threshold(max_gap_seconds)
