"""Shared, transport-neutral agent delivery metadata and health decisions.

The agent reports are deliberately self-describing.  The server can therefore
tell the difference between an agent that stopped producing data, a report
waiting in a queue, and a report that was accepted but slow to process.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def update_missing_sequence_ranges(
    ranges: list[list[int]], high_water: int, sequence: int, *, max_ranges: int = 256,
) -> tuple[list[list[int]], int, bool]:
    """Update compact unresolved sequence gaps for priority-reordered reports.

    Ranges are inclusive ``[first, last]`` pairs. Advancing the high-water
    mark adds a missing interval; receiving an older report removes that one
    sequence from the pending intervals. The range count is bounded, and an
    overflow is explicit because exact loss tracking can no longer be claimed.
    """
    normalized = sorted(
        [[int(pair[0]), int(pair[1])] for pair in (ranges or [])
         if isinstance(pair, (list, tuple)) and len(pair) == 2 and int(pair[0]) <= int(pair[1])]
    )
    if sequence > high_water:
        if sequence > high_water + 1:
            normalized.append([high_water + 1, sequence - 1])
            normalized.sort()
            merged: list[list[int]] = []
            for first, last in normalized:
                if merged and first <= merged[-1][1] + 1:
                    merged[-1][1] = max(merged[-1][1], last)
                else:
                    merged.append([first, last])
            normalized = merged
    else:
        remaining: list[list[int]] = []
        for first, last in normalized:
            if sequence < first or sequence > last:
                remaining.append([first, last])
            else:
                if first < sequence:
                    remaining.append([first, sequence - 1])
                if sequence < last:
                    remaining.append([sequence + 1, last])
        normalized = remaining
    overflow = len(normalized) > max_ranges
    if overflow:
        normalized = normalized[:max_ranges]
    pending = sum(last - first + 1 for first, last in normalized)
    return normalized, pending, overflow


def parse_report_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def extract_report_metadata(raw: Any) -> dict[str, Any] | None:
    """Return validated delivery metadata from an EC2 report.

    This helper intentionally accepts reports from older agents.  Missing
    metadata is represented as ``None`` so the existing ingest path continues
    to work while upgraded agents roll out.
    """
    if not isinstance(raw, dict) or raw.get("kind") != "ec2_report":
        return None
    host = raw.get("host")
    if not isinstance(host, dict):
        return None
    agent_id = raw.get("agent_id") or host.get("instance_id")
    if not isinstance(agent_id, str) or not agent_id:
        return None
    sequence = raw.get("sequence")
    try:
        sequence = int(sequence) if sequence is not None else None
    except (TypeError, ValueError):
        sequence = None
    return {
        "agent_id": agent_id,
        "boot_id": raw.get("boot_id") if isinstance(raw.get("boot_id"), str) else None,
        "sequence": sequence,
        "report_id": raw.get("report_id") if isinstance(raw.get("report_id"), str) else None,
        "collected_at": parse_report_time(raw.get("collected_at")),
        "sent_at": parse_report_time(raw.get("sent_at")),
        "priority_counts": raw.get("priority_counts") if isinstance(raw.get("priority_counts"), dict) else {},
        "transport": raw.get("transport") if isinstance(raw.get("transport"), str) else None,
        "rollout": raw.get("rollout") if isinstance(raw.get("rollout"), str) else None,
    }


def delivery_health(
    *,
    now: datetime,
    last_accepted_at: datetime | None,
    queue_delay_seconds: float | None,
    processing_delay_seconds: float | None,
    collector_degraded: bool,
    sequence_gaps: int = 0,
    sequence_tracking_overflow: bool = False,
    silent_after_seconds: int = 180,
    delay_after_seconds: int = 60,
) -> dict[str, Any]:
    """Classify the latest known delivery phase for one agent.

    ``last_accepted_at`` is server-side receipt time, not the agent's event
    timestamp.  That distinction prevents a delayed SQS message from making
    an otherwise active agent look dead.
    """
    age_seconds = None
    if last_accepted_at is not None:
        age_seconds = max(0, int((now - last_accepted_at).total_seconds()))

    if sequence_tracking_overflow:
        state, reason = "data_loss_risk", "sequence gap tracking exceeded its safe bound"
    elif sequence_gaps > 0:
        state, reason = "data_loss_risk", f"{sequence_gaps} report sequence gap(s) detected"
    elif age_seconds is None or age_seconds > silent_after_seconds:
        state, reason = "silent", "no report has been accepted recently"
    elif processing_delay_seconds is not None and processing_delay_seconds > delay_after_seconds:
        state, reason = "processing_delayed", "accepted report took too long to process"
    elif queue_delay_seconds is not None and queue_delay_seconds > delay_after_seconds:
        state, reason = "delivery_delayed", "report spent too long waiting for delivery"
    elif collector_degraded:
        state, reason = "collector_degraded", "one or more agent collectors are degraded"
    else:
        state, reason = "healthy", "reports are being delivered and processed normally"

    return {
        "state": state,
        "reason": reason,
        "age_seconds": age_seconds,
        "queue_delay_seconds": queue_delay_seconds,
        "processing_delay_seconds": processing_delay_seconds,
        "sequence_gaps": sequence_gaps,
        "sequence_tracking_overflow": sequence_tracking_overflow,
    }
