# EC2 Agent Telemetry Decisions

Append-only decision and implementation record for EC2 agent collection. Add new dated sections at the end. Do not rewrite or remove prior sections; corrections should be appended with the earlier entry referenced.

## 2026-10-30 — Initial telemetry quality audit and implementation

### Goal

Make EC2 monitoring timely, precise, privacy-conscious, and legible to a single operator. Treat collection evidence and delivery evidence separately. Preserve current production data and support the existing HTTPS and queue ingestion paths during rollout.

### Keep as core coverage

- IMDSv2 instance identity and boot/sequence/report identity: needed to bind reports to a specific host and detect restarts/replays.
- SSH and sudo authentication events: high-value evidence of access and privilege use. Continue scrubbing sensitive message fragments before transport.
- File integrity monitoring (periodic baseline, inotify, auditd attribution): strongest change-detection coverage for security-sensitive configuration and binaries. Actor attribution remains best-effort; unknown actor must be represented honestly.
- OOM events, CPU, memory, sessions, disk capacity, users, and loaded kernel modules: useful health and compromise context with low collection overhead.
- Hashes of critical files, sudoers, cron, and SSH authorized keys: detect drift without transferring secret file contents.
- Installed package names and SUID files: retain as supporting inventory, but lower their cadence and report failures/partial coverage rather than treating incomplete output as authoritative.
- HTTPS direct ingestion with per-agent token, durable local spool, priority replay, and server-side acceptance/processing timing: retain because it reduces dependency on AWS queues while keeping recovery and observability.

### Rework

- Process telemetry: command-line arguments can contain passwords, tokens, and other secrets; scrubbing heuristics cannot guarantee safety. Remove arguments from default collection. Keep user/PID/command name and refresh/send a compact process inventory every five minutes.
- Collector health: a cached value after a failed run is still useful historically but must not look current. Report each collector's state, attempt/success time, age, cadence, and error alongside snapshots.
- Listening sockets: TCP-only misses UDP listeners. Collect TCP and UDP with protocol preserved, since endpoint behavior differs by protocol.
- Disk: add inode usage; systems can exhaust inodes while byte capacity looks healthy.
- Service inventory: enabled unit files alone do not show runtime state. Report enabled and active service/timer unit sets separately.
- Authorized-key fingerprint: hash only the key type and base64 key blob, not the entire authorized_keys line/comment, so identity is stable and comments do not alter it.
- SUID scan: `find` permission errors/nonzero exit mean partial coverage. Do not replace the cached complete inventory with partial results; publish an error/partial collector state.
- Package inventory: keep package names (useful for drift), but query hourly instead of every ten minutes to reduce RPM database contention and prioritize live signals.
- Delivery sequence gaps: priority replay intentionally reorders reports. Preserve cumulative historical gap count, but separately track unresolved missing sequence ranges and clear them when delayed reports arrive. Bound the tracker and expose overflow rather than silently claiming exact loss.
- Transport identity: classify direct HTTPS events as HTTPS in normalized event sources; keep queue labels for queue-delivered legacy records.
- Report contract: add an explicit schema version and validate timestamp/shape while accepting legacy reports during migration.

### Remove from default security signal

- `host.process.first_seen`: a new process name is ordinary inventory churn and a weak standalone threat signal. It creates noisy alerts without process-start provenance or a reliable execution tree. Keep process inventory visible, but do not emit this as a security event.
- Process command-line arguments: removed from the outgoing default payload due to secret exposure risk.

### Coverage limits to state clearly

The current agent does not provide complete outbound network-flow visibility, UDP connection history, process execution ancestry, memory capture, or executable signature verification. These must remain explicit coverage limitations; the UI and docs must not imply comprehensive endpoint detection from the data collected today.

### Data safety

This work must only add fields/columns/semantics. Never delete existing events, snapshots, delivery rows, FIM evidence, or connector configuration as part of implementation. New SQL must be additive.

### Implementation and verification

Status: in progress. Append a completion entry below after implementation and tests, with changed paths and exact verification results. Do not edit this initial audit entry.

## Implementation record — 2026-10-30

Implemented the initial audit without deleting historical database rows, snapshots, FIM evidence, connector settings, or prior decision-log content.

- **Safer process telemetry:** new reports keep user, PID, and command name but omit command arguments, which can contain secrets. Projection preserves command arguments already present in legacy snapshots under `legacy_process_args_retained` with a timestamp and reason, honoring the project's evidence-retention rule.
- **Freshness and coverage:** reports now carry schema version 2 and per-collector health, including attempt/success timestamps, cadence, age, and errors. Package inventory runs hourly; compact process inventory refreshes every five minutes and remains available as host context.
- **More complete host state:** listeners distinguish TCP from UDP; disks include inode counts; systemd inventory distinguishes enabled and active units; SSH fingerprints use OpenSSH-compatible SHA256 over the key blob; incomplete SUID scans are reported as collector errors instead of trusted as complete results.
- **Lower-noise signals:** removed process-first-seen event generation. Active service state remains visible in inventory without emitting high-churn start/stop alerts. Inode pressure reuses existing disk warning/critical/recovery event types and marks `capacity_kind` so notifications identify byte versus inode pressure.
- **Reliable direct delivery:** ingress validates schema and timestamps while accepting legacy reports; HTTPS transport remains distinguishable in normalized event sources. Delivery tracking preserves cumulative gaps and adds bounded unresolved sequence ranges so priority replay can clear recovered gaps. Overflow is reported as a data-loss risk.
- **Operations and display:** host detail now shows collector freshness, enabled/active service inventory, inode use, and process inventory without argument data. Delivery status exposes cumulative gaps, pending ranges, and tracker overflow.

Verification on this development PC:

- `75 passed` across the EC2 projection, agent, ingress, delivery, worker, transport, migration-contract, and canary-contract regression modules.
- Python compileall passed for `blackwatch` and `scripts`.
- UI TypeScript typecheck passed.
- `git diff --check` passed.
- Next.js production build compiled and generated pages, but final standalone output tracing failed with Windows `EPERM` while creating a generated `.next/standalone/node_modules` directory. This is an environment limitation; a complete production build is not confirmed here.

The additive sequence-tracking migration is `blackwatch/sql/045_agent_sequence_tracking.sql`. It has not been applied to the production server. No deployment or live-agent update was performed in this implementation.
