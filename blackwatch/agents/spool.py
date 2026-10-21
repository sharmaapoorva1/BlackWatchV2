"""Durable filesystem admission spool for direct agent reports."""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


class SpoolCapacityError(RuntimeError):
    pass


@dataclass
class PersistResult:
    accepted: bool
    duplicate: bool = False
    path: Optional[Path] = None
    accepted_at: Optional[datetime] = None


@dataclass
class ClaimedReport:
    path: Path
    agent_id: str
    report_id: str
    payload: Any
    priority: str
    attempts: int
    next_attempt_at: Optional[datetime]
    accepted_at: Optional[datetime]


_SAFE_COMPONENT = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")


def _parse_time(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class IngressSpool:
    def __init__(
        self,
        root: Path | str,
        *,
        max_files: int = 10_000,
        max_bytes: int = 1024 * 1024 * 1024,
    ) -> None:
        self.root = Path(root)
        self.incoming = self.root / "incoming"
        self.processing = self.root / "processing"
        self.retry_dir = self.root / "retry"
        self.quarantine_dir = self.root / "quarantine"
        self.max_files = max_files
        self.max_bytes = max_bytes
        for directory in (self.root, self.incoming, self.processing, self.retry_dir, self.quarantine_dir):
            directory.mkdir(parents=True, exist_ok=True)
            try:
                os.chmod(directory, 0o700)
            except OSError:
                pass

    @staticmethod
    def _validate_component(value: str) -> str:
        if not isinstance(value, str) or not _SAFE_COMPONENT.fullmatch(value):
            raise ValueError("invalid spool path component")
        return value

    def _filename(self, agent_id: str, report_id: str) -> str:
        return self._validate_component(agent_id) + "--" + self._validate_component(report_id) + ".json"

    def _active_paths(self, filename: str) -> list[Path]:
        return [directory / filename for directory in (self.incoming, self.processing, self.retry_dir, self.quarantine_dir)]

    def _capacity(self, payload_size: int) -> None:
        files = list(self.incoming.glob("*.json")) + list(self.processing.glob("*.json")) + list(self.retry_dir.glob("*.json"))
        total = 0
        for path in files:
            try:
                total += path.stat().st_size
            except OSError:
                pass
        if len(files) >= self.max_files or total + payload_size > self.max_bytes:
            raise SpoolCapacityError("agent ingress spool is full")

    @staticmethod
    def _write_atomic(directory: Path, filename: str, encoded: bytes) -> Path:
        fd, temp_name = tempfile.mkstemp(prefix=".incoming-", suffix=".tmp", dir=str(directory))
        try:
            try:
                os.fchmod(fd, 0o600)
            except AttributeError:
                os.chmod(temp_name, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            destination = directory / filename
            os.replace(temp_name, destination)
            return destination
        except Exception:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                os.unlink(temp_name)
            except OSError:
                pass
            raise

    def persist(self, agent_id: str, report_id: str, payload: dict[str, Any], priority: str) -> PersistResult:
        filename = self._filename(agent_id, report_id)
        existing = [path for path in self._active_paths(filename) if path.exists()]
        if existing:
            accepted_at = None
            try:
                accepted_at = _parse_time(json.loads(existing[0].read_text(encoding="utf-8")).get("accepted_at"))
            except (OSError, ValueError, UnicodeDecodeError):
                pass
            return PersistResult(accepted=True, duplicate=True, path=existing[0], accepted_at=accepted_at)
        accepted_at = datetime.now(timezone.utc)
        wrapper = {
            "agent_id": agent_id,
            "report_id": report_id,
            "priority": priority if priority in ("critical", "bulk") else "bulk",
            "attempts": 0,
            "next_attempt_at": None,
            "accepted_at": accepted_at.isoformat(),
            "payload": payload,
        }
        encoded = json.dumps(wrapper, separators=(",", ":")).encode("utf-8")
        self._capacity(len(encoded))
        path = self._write_atomic(self.incoming, filename, encoded)
        return PersistResult(accepted=True, path=path, accepted_at=accepted_at)

    def claim(self, now: Optional[datetime] = None) -> Optional[ClaimedReport]:
        now = now or datetime.now(timezone.utc)
        candidates: list[tuple[int, str, Path]] = []
        for priority, rank in (("critical", 0), ("bulk", 1)):
            for directory in (self.incoming, self.retry_dir):
                for path in directory.glob("*.json"):
                    try:
                        data = json.loads(path.read_text(encoding="utf-8"))
                    except (OSError, ValueError, UnicodeDecodeError):
                        data = {}
                    if str(data.get("priority") or "bulk") != priority:
                        continue
                    retry_at = _parse_time(data.get("next_attempt_at"))
                    if retry_at and retry_at > now:
                        continue
                    candidates.append((rank, path.name, path))
        for _, _, source in sorted(candidates):
            destination = self.processing / source.name
            try:
                os.replace(source, destination)
            except (FileNotFoundError, PermissionError):
                continue
            try:
                data = json.loads(destination.read_text(encoding="utf-8"))
            except (OSError, ValueError, UnicodeDecodeError):
                data = {}
            return ClaimedReport(
                path=destination,
                agent_id=str(data.get("agent_id") or ""),
                report_id=str(data.get("report_id") or ""),
                payload=data.get("payload"),
                priority=str(data.get("priority") or "bulk"),
                attempts=int(data.get("attempts") or 0),
                next_attempt_at=_parse_time(data.get("next_attempt_at")),
                accepted_at=_parse_time(data.get("accepted_at")),
            )
        return None

    def complete(self, claim: ClaimedReport) -> None:
        try:
            claim.path.unlink()
        except FileNotFoundError:
            pass

    def retry(self, claim: ClaimedReport, reason: str, retry_at: datetime) -> None:
        wrapper = {
            "agent_id": claim.agent_id,
            "report_id": claim.report_id,
            "priority": claim.priority,
            "attempts": claim.attempts + 1,
            "next_attempt_at": retry_at.isoformat(),
            "accepted_at": claim.accepted_at.isoformat() if claim.accepted_at else None,
            "last_error": str(reason)[:500],
            "payload": claim.payload,
        }
        encoded = json.dumps(wrapper, separators=(",", ":")).encode("utf-8")
        destination = self._write_atomic(self.retry_dir, claim.path.name, encoded)
        del destination
        self.complete(claim)

    def quarantine(self, claim: ClaimedReport, reason: str) -> Path:
        wrapper = {
            "agent_id": claim.agent_id,
            "report_id": claim.report_id,
            "priority": claim.priority,
            "attempts": claim.attempts,
            "accepted_at": claim.accepted_at.isoformat() if claim.accepted_at else None,
            "quarantine_reason": str(reason)[:500],
            "payload": claim.payload,
        }
        encoded = json.dumps(wrapper, separators=(",", ":"), default=str).encode("utf-8")
        destination = self._write_atomic(self.quarantine_dir, claim.path.name, encoded)
        self.complete(claim)
        return destination

    def stats(self) -> dict[str, Any]:
        directories = {
            "incoming": self.incoming,
            "processing": self.processing,
            "retry": self.retry_dir,
            "quarantine": self.quarantine_dir,
        }
        result: dict[str, Any] = {"files": {}, "bytes": 0, "oldest_active_age_seconds": None}
        oldest_mtime: Optional[float] = None
        for name, directory in directories.items():
            paths = list(directory.glob("*.json"))
            result["files"][name] = len(paths)
            for path in paths:
                try:
                    stat = path.stat()
                    result["bytes"] += stat.st_size
                    if name != "quarantine":
                        oldest_mtime = stat.st_mtime if oldest_mtime is None else min(oldest_mtime, stat.st_mtime)
                except OSError:
                    pass
        if oldest_mtime is not None:
            result["oldest_active_age_seconds"] = max(0.0, time.time() - oldest_mtime)
        return result
