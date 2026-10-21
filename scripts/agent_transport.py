"""Agent delivery transports and the priority-aware local spool.

This module intentionally uses only Python's standard library so it can be
copied to the Amazon Linux 2 agent without installing a second runtime
dependency. SQS remains a first-class transport; HTTPS is an additive path.
"""

from __future__ import annotations

import gzip
import http.client
import json
import math
import os
import socket
import tempfile
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Optional
from urllib.parse import urlsplit


@dataclass
class SendResult:
    accepted: bool
    ack_id: Optional[str] = None
    accepted_at: Optional[datetime] = None
    retry_after: Optional[float] = None
    error_category: Optional[str] = None


class Transport:
    def send(self, batch: bytes, *, priority: str) -> SendResult:
        raise NotImplementedError


def priority_for_report(payload: dict[str, Any]) -> str:
    counts = payload.get("priority_counts")
    if isinstance(counts, dict):
        try:
            if int(counts.get("critical") or 0) > 0:
                return "critical"
        except (TypeError, ValueError):
            pass
    return "bulk"


def stamp_report(
    payload: dict[str, Any],
    *,
    transport_name: str,
    rollout: str,
    now: Any = None,
) -> dict[str, Any]:
    """Add immutable delivery context without rewriting the first send time."""
    payload.setdefault("transport", transport_name)
    payload.setdefault("rollout", rollout)
    if "sent_at" not in payload:
        payload["sent_at"] = (
            now if isinstance(now, str) else datetime.now(timezone.utc).isoformat()
        )
    return payload


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _retry_after(headers: Any) -> Optional[float]:
    try:
        raw = headers.get("Retry-After")
    except Exception:
        raw = None
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value) or value < 0:
        return None
    return min(value, 3600.0)


class SqsTransport(Transport):
    def __init__(self, queue_url: str, *, client: Any = None) -> None:
        self.queue_url = queue_url
        self._client = client

    def _get_client(self) -> Any:
        if self._client is None:
            import boto3

            self._client = boto3.client("sqs")
        return self._client

    def send(self, batch: bytes, *, priority: str) -> SendResult:
        response = self._get_client().send_message(
            QueueUrl=self.queue_url,
            MessageBody=batch.decode("utf-8"),
            MessageAttributes={"BlackWatchPriority": {"DataType": "String", "StringValue": priority}},
        )
        return SendResult(
            accepted=True,
            ack_id=str(response.get("MessageId") or "") or None,
            accepted_at=datetime.now(timezone.utc),
        )


def build_transport(
    *,
    sqs_client: Any = None,
    transport_name: Optional[str] = None,
    sqs_url: Optional[str] = None,
    ingest_url: Optional[str] = None,
    agent_token: Optional[str] = None,
) -> Transport:
    selected = (transport_name or os.environ.get("BLACKWATCH_TRANSPORT", "sqs")).lower()
    if selected == "sqs":
        queue_url = sqs_url or os.environ.get("BLACKWATCH_SQS_URL", "")
        if not queue_url:
            raise ValueError("BLACKWATCH_SQS_URL is required for the SQS transport")
        return SqsTransport(queue_url, client=sqs_client)
    if selected == "https":
        url = ingest_url or os.environ.get("BLACKWATCH_INGEST_URL", "")
        token = agent_token or os.environ.get("BLACKWATCH_AGENT_TOKEN", "")
        if not url or not token:
            raise ValueError("BLACKWATCH_INGEST_URL and BLACKWATCH_AGENT_TOKEN are required")
        return HttpsTransport(url, token)
    raise ValueError("BLACKWATCH_TRANSPORT must be sqs or https")


class HttpsTransport(Transport):
    def __init__(
        self,
        url: str,
        token: str,
        *,
        timeout: float = 5.0,
        max_request_bytes: int = 1024 * 1024,
        connection_factory: Optional[Callable[[str, float], Any]] = None,
    ) -> None:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("HTTPS transport requires an https:// URL")
        self.url = url
        self.token = token
        self.timeout = timeout
        self.max_request_bytes = max_request_bytes
        self._host = parsed.netloc
        self._path = parsed.path or "/"
        if parsed.query:
            self._path += "?" + parsed.query
        self._connection_factory = connection_factory or http.client.HTTPSConnection
        self._connection: Any = None

    def _get_connection(self) -> Any:
        if self._connection is None:
            self._connection = self._connection_factory(self._host, self.timeout)
        return self._connection

    def _close_connection(self) -> None:
        connection, self._connection = self._connection, None
        if connection is not None:
            try:
                connection.close()
            except Exception:
                pass

    def send(self, batch: bytes, *, priority: str) -> SendResult:
        body = batch
        headers = {
            "Authorization": "Bearer " + self.token,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-BlackWatch-Priority": priority,
        }
        if priority == "bulk":
            body = gzip.compress(batch)
            headers["Content-Encoding"] = "gzip"
        if len(body) > self.max_request_bytes:
            return SendResult(False, error_category="oversized")
        headers["Content-Length"] = str(len(body))

        try:
            connection = self._get_connection()
            connection.request("POST", self._path, body=body, headers=headers)
            response = connection.getresponse()
            status = int(response.status)
            response_headers = getattr(response, "headers", {})
            raw = response.read()
            if 200 <= status < 300:
                try:
                    data = json.loads(raw.decode("utf-8")) if raw else {}
                except (UnicodeDecodeError, json.JSONDecodeError):
                    data = {}
                return SendResult(
                    accepted=True,
                    ack_id=str(data.get("ack_id") or "") or None,
                    accepted_at=_parse_timestamp(data.get("accepted_at")) or datetime.now(timezone.utc),
                )
            category = "backpressure" if status in (429, 503) else "rejected"
            return SendResult(
                accepted=False,
                retry_after=_retry_after(response_headers),
                error_category=category,
            )
        except (socket.timeout, TimeoutError):
            self._close_connection()
            return SendResult(False, error_category="timeout")
        except OSError:
            self._close_connection()
            return SendResult(False, error_category="connection")
        except Exception:
            self._close_connection()
            return SendResult(False, error_category="transport")


@dataclass
class SpoolItem:
    path: Path
    payload: dict[str, Any]
    priority: str


class LocalSpool:
    """Private, atomic, bounded local spool shared by transport recovery."""

    def __init__(
        self,
        root: Path | str,
        *,
        max_files: int = 5000,
        max_bytes: int = 100 * 1024 * 1024,
    ) -> None:
        self.root = Path(root)
        self.max_files = max_files
        self.max_bytes = max_bytes
        self.root.mkdir(parents=True, exist_ok=True)
        self._secure_dirs()

    def _secure_dirs(self) -> None:
        try:
            os.chmod(self.root, 0o700)
        except OSError:
            pass

    def enqueue(self, payload: dict[str, Any], priority: Optional[str] = None) -> Path:
        priority = priority or priority_for_report(payload)
        if priority not in ("critical", "bulk"):
            priority = "bulk"
        wrapper = {"priority": priority, "payload": payload}
        encoded = json.dumps(wrapper, separators=(",", ":")).encode("utf-8")
        fd, tmp_name = tempfile.mkstemp(prefix=".pending-", suffix=".tmp", dir=str(self.root))
        try:
            try:
                os.fchmod(fd, 0o600)
            except AttributeError:
                os.chmod(tmp_name, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            path = self.root / (f"{priority}-{time.time_ns()}-{uuid.uuid4().hex}.json")
            os.replace(tmp_name, path)
        except Exception:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise
        self.enforce_caps()
        return path

    def pending(self) -> Iterable[SpoolItem]:
        rows = []
        for path in self.root.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict) and isinstance(data.get("payload"), dict):
                    payload = data["payload"]
                    priority = str(data.get("priority") or priority_for_report(payload))
                elif isinstance(data, dict):
                    payload = data
                    priority = priority_for_report(payload)
                else:
                    continue
                if priority not in ("critical", "bulk"):
                    priority = "bulk"
                rows.append(SpoolItem(path, payload, priority))
            except (OSError, ValueError, UnicodeDecodeError):
                continue
        rows.sort(key=lambda item: (0 if item.priority == "critical" else 1, item.path.name))
        return rows

    def remove(self, item: SpoolItem) -> None:
        try:
            item.path.unlink()
        except FileNotFoundError:
            pass

    def enforce_caps(self) -> None:
        files = sorted(self.root.glob("*.json"), key=lambda p: p.name)
        if len(files) > self.max_files:
            for path in files[: len(files) - self.max_files]:
                try:
                    path.unlink()
                except OSError:
                    pass
        files = sorted(self.root.glob("*.json"), key=lambda p: p.name)
        total = 0
        for path in reversed(files):
            try:
                total += path.stat().st_size
            except OSError:
                continue
            if total > self.max_bytes:
                try:
                    path.unlink()
                except OSError:
                    pass
