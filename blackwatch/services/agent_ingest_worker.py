"""Asynchronous durable worker for direct EC2 agent reports."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..agents.ingress import IngressValidationError, validate_report
from ..agents.delivery import extract_report_metadata
from ..agents.spool import ClaimedReport, IngressSpool
from ..config import settings

_log = logging.getLogger(__name__)


@dataclass
class WorkerResult:
    state: str
    report_id: Optional[str] = None
    error: Optional[str] = None
    attempts: int = 0
    stats: Optional[dict[str, Any]] = None


def retry_delay(attempts: int) -> int:
    return min(300, 5 * (2 ** min(max(attempts, 0), 6)))


def _record_retry(storage_module: Any, claim: ClaimedReport, error: str, retry_at: datetime) -> None:
    try:
        storage_module.retry_agent_report(claim.agent_id, claim.report_id, error, retry_at)
    except Exception:
        _log.exception("agent_ingress.receipt_retry_failed agent_id=%s report_id=%s", claim.agent_id, claim.report_id)


def _record_quarantine(storage_module: Any, claim: ClaimedReport, reason: str) -> None:
    try:
        storage_module.quarantine_agent_report(claim.agent_id, claim.report_id, reason)
    except Exception:
        _log.exception("agent_ingress.receipt_quarantine_failed agent_id=%s report_id=%s", claim.agent_id, claim.report_id)


def run_once(
    spool: IngressSpool,
    *,
    now: Optional[datetime] = None,
    storage_module: Any = None,
    pipeline_module: Any = None,
) -> WorkerResult:
    """Claim and process at most one report, returning an operator-readable state."""
    if storage_module is None:
        from .. import storage as storage_module
    if pipeline_module is None:
        from .. import pipeline as pipeline_module
    now = now or datetime.now(timezone.utc)
    claim = spool.claim(now=now)
    if claim is None:
        return WorkerResult("idle")

    try:
        payload = validate_report(
            claim.payload,
            claim.agent_id,
            settings.agent_ingress_max_request_bytes,
        )
    except IngressValidationError as exc:
        reason = str(exc)
        _record_quarantine(storage_module, claim, reason)
        spool.quarantine(claim, reason)
        return WorkerResult("quarantine", claim.report_id, reason, claim.attempts)

    try:
        claimed = storage_module.claim_agent_report(
            claim.agent_id,
            claim.report_id,
            settings.agent_ingress_lease_seconds,
        )
    except Exception as exc:
        reason = str(exc)[:500]
        retry_at = now + timedelta(seconds=retry_delay(claim.attempts))
        _record_retry(storage_module, claim, reason, retry_at)
        spool.retry(claim, reason, retry_at)
        return WorkerResult("retry", claim.report_id, reason, claim.attempts + 1)

    if not claimed:
        spool.complete(claim)
        return WorkerResult("duplicate", claim.report_id, attempts=claim.attempts)

    metadata = extract_report_metadata(payload)
    if metadata:
        try:
            storage_module.annotate_agent_ingress_report(
                claim.agent_id,
                claim.report_id,
                metadata,
                priority=claim.priority,
            )
        except Exception:
            _log.exception("agent_ingress.metadata_record_failed agent_id=%s report_id=%s", claim.agent_id, claim.report_id)
    if metadata and claim.accepted_at:
        try:
            storage_module.record_agent_delivery(metadata, accepted_at=claim.accepted_at)
        except Exception:
            _log.exception("agent_ingress.delivery_accept_failed agent_id=%s", claim.agent_id)

    try:
        stats = pipeline_module.ingest_payload(
            "ec2.host",
            payload,
            transport="https",
            received_at=claim.accepted_at or now,
        )
    except Exception as exc:
        reason = str(exc)[:500]
        retry_at = now + timedelta(seconds=retry_delay(claim.attempts))
        _record_retry(storage_module, claim, reason, retry_at)
        spool.retry(claim, reason, retry_at)
        return WorkerResult("retry", claim.report_id, reason, claim.attempts + 1)

    processed_at = datetime.now(timezone.utc)
    try:
        storage_module.complete_agent_report(
            claim.agent_id,
            claim.report_id,
            processed_at,
            stats if isinstance(stats, dict) else {},
        )
    except Exception as exc:
        reason = str(exc)[:500]
        retry_at = now + timedelta(seconds=retry_delay(claim.attempts))
        _record_retry(storage_module, claim, reason, retry_at)
        spool.retry(claim, reason, retry_at)
        return WorkerResult("retry", claim.report_id, reason, claim.attempts + 1)
    if metadata:
        try:
            storage_module.record_agent_delivery(
                metadata,
                accepted_at=claim.accepted_at or now,
                processed_at=processed_at,
            )
        except Exception:
            _log.exception("agent_ingress.delivery_process_failed agent_id=%s", claim.agent_id)
    spool.complete(claim)
    return WorkerResult("completed", claim.report_id, attempts=claim.attempts, stats=stats)


def main() -> None:
    from ..db import close_pool, init_pool
    from .. import noise
    from .. import storage
    from ..modules import registry
    from ..notify import router as notify_router
    from ..notify import worker as notify_worker
    from ..rules import engine as rule_engine
    from ..event import Severity

    init_pool()
    registry.register_builtins()
    rule_engine.init_engine(settings.rules_dir)
    for rule_id, override in storage.get_rule_override_map().items():
        rule_engine.get_engine().set_enabled(rule_id, override["enabled"])
        severity = override.get("severity")
        if severity:
            try:
                rule_engine.get_engine().set_severity(rule_id, Severity(severity))
            except ValueError:
                pass
    noise.refresh()
    notify_router.init_notifier(settings.notifications_file)
    notify_worker.start()
    spool = IngressSpool(
        settings.agent_ingress_dir,
        max_files=settings.agent_ingress_max_files,
        max_bytes=settings.agent_ingress_max_bytes,
    )
    poll_seconds = 1.0
    try:
        while True:
            result = run_once(spool)
            if result.state == "idle":
                time.sleep(poll_seconds)
            else:
                _log.info("agent_ingress state=%s report_id=%s error=%s", result.state, result.report_id, result.error)
    finally:
        notify_worker.stop()
        close_pool()


if __name__ == "__main__":
    main()
