# EC2 Agent Telemetry Quality Plan

## Objective

Keep BlackWatch's highest-value EC2 security telemetry, remove noisy or unnecessarily sensitive default data, make every collector's coverage and freshness explicit, and correct delivery metadata so operators can distinguish delay from loss. Preserve existing evidence and configuration.

## Decisions

1. Stop collecting process command-line arguments by default. Process snapshots retain user, PID, and executable name; transmit them on a bounded five-minute cadence so they stay useful without forcing a full state diff each minute.
2. Keep the existing FIM, auth, OOM, identity, CPU/memory, users, authorized-key, sudoers/cron/critical-file hashes, SUID, package, module, and service coverage. Improve key fingerprints to hash the public-key blob, and make partial SUID scans explicit failures.
3. Extend listening socket coverage to UDP, disk coverage to inode use, and service coverage to both enabled and active services/timers. Keep package inventory but run it hourly.
4. Include per-collector state, last attempt/success, age, cadence, and error in heartbeat metadata. A cached snapshot is not represented as fresh when a collection fails.
5. Add report schema version 2 while continuing to accept legacy reports. Validate timestamps and basic optional structure without making old queued reports unprocessable.
6. Do not emit `host.process.first_seen`; a process appearing on a host is inventory, not a reliable security signal.
7. Map HTTPS agent events to HTTPS transport. Keep queue/SQS transport behavior for legacy reports.
8. Preserve cumulative sequence-gap history and add bounded unresolved-gap tracking so critical/bulk reordering is not reported as permanent loss. Surface tracking overflow explicitly.
9. Keep persistence additive. No evidence, database rows, or user configuration are removed by this implementation.

## Work order

- Add regression tests first for payload privacy, cadence, collector freshness, coverage fields, ingress compatibility, process-noise removal, transport mapping, and bounded sequence-range behavior.
- Implement agent collection/report changes and adapter/projection changes.
- Add an additive SQL migration for unresolved sequence gaps and update delivery health read paths.
- Update the host detail UI and the canonical EC2 agent reference.
- Append the rationale and verification record to `docs/ec2-agent-telemetry-decisions.md`.
- Run focused backend and agent tests plus the UI type/build checks that the workspace supports.

## Verification

Verify report schema v1 compatibility and v2 validation, data is not emitted in process arguments, collector timestamps are available, UDP/inode/active-service fields are formed correctly, the actor-less FIM regression remains fixed, and out-of-order sequences resolve instead of creating permanent data-loss alerts. Inspect migration SQL for additive-only changes. Do not deploy to production from this local workspace.
