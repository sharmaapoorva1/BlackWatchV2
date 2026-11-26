# EC2 host agent

The one reference for host monitoring on EC2: what the agent collects, how
reports reach BlackWatch, what BlackWatch derives from them, how to install and
operate it, and how file integrity monitoring (FIM) works. Everything here was
checked against `scripts/ec2_agent.py`, `scripts/agent_transport.py`,
`scripts/fim_engine.py`, `deploy/ec2/`, `blackwatch/agents/`,
`blackwatch/modules/ec2_host.py`, `blackwatch/hosts/` and `rules/host.yaml`.

Current: **agent v1.10**, **report schema v2**.

---

## 1. What it is

A Python reporter that runs as a systemd service (`blackwatch-agent`) on each
EC2 host. It collects host state and security evidence, scrubs it, and pushes
reports outbound. No inbound port is opened on the host and BlackWatch never
connects to it.

It covers: SSH and sudo activity, users, authorized keys, sudoers and cron
policy, listening ports, services, packages, kernel modules, SUID files, disk,
memory, CPU, OOM kills, and file integrity (periodic, real-time and "who did
it" attribution).

It does not cover (and the UI must not imply it does): outbound network flows,
UDP connection history, process execution ancestry or command lines, memory
capture, executable signature or CVE checks, container internals.

---

## 2. How reports reach BlackWatch

Two transports, chosen per host with `BLACKWATCH_TRANSPORT`. The agent and the
installer both default to `sqs`; set `https` to use direct delivery.

```
EC2 host                                         BlackWatch (Lightsail, Docker)
ec2_agent.py ── HTTPS  POST /api/agent/v1/reports ──► app: validate + durably admit
  (https)        Bearer per-agent token, 202 ack         to the ingress spool volume
                                                          │
                                                          ▼
                                              agent-worker container drains the spool
                                                          │
ec2_agent.py ── SQS SendMessage ──► queue blackwatch-ec2-agents
  (sqs)         (instance role)        │
                                       ▼
                         app: aws_sqs connector (target_module=ec2.host)
                                                          │
                                                          ▼
                          Ec2HostAdapter → rules → events table → hosts projection
                                                          │
                                                          ▼
                                                 notifications, /hosts, /fim
```

| | HTTPS (direct) | SQS |
|---|---|---|
| Acknowledged when | the report is durably written to BlackWatch's own spool | the queue accepted the message |
| Credential | per-agent bearer token | instance IAM role (`sqs:SendMessage` to one queue) |
| Size handling | bulk reports are gzipped; a report over 1 MiB (JSON, before compression) is rejected by the server, and the agent will not send a body over 1 MiB; no field dropping | body limited to 256 KiB; the agent drops fields to fit (section 6.4) |
| Server side | `agent-worker` container | scheduler thread in the `app` container, about every 60 s |
| Duplicate handling | one receipt per (agent, report id) | event ids deduplicate on insert |

The two containers process events independently. `rules/` and
`notifications.yaml` are mounted read-only into both, so restart both
`app` and `agent-worker` after editing them.

To roll a host back to SQS, set `BLACKWATCH_TRANSPORT=sqs` with the queue URL
in `/etc/blackwatch-agent.env` and restart the unit. Neither the agent spool nor
the server ingress volume is touched.

---

## 3. What a report contains

The agent builds a **heartbeat report every `INTERVAL` seconds** (default 60)
and a **critical report every `CRITICAL_INTERVAL_SEC` seconds** (default 2),
the latter only when there are OOM events or FIM changes to send.

Every report carries: `kind=ec2_report`, `report_schema_version=2`, `host`
(instance id from IMDS, hostname, account, region, optional tags),
`agent_id` (the instance id), `boot_id`, a persistent monotonic `sequence`
(stored in `/var/lib/blackwatch-agent/sequence`), `report_id`, `collected_at`,
`sent_at` (set once, never rewritten on replay), `transport`, `rollout`,
`agent_version`, `uptime_seconds`, `collector_status`, `priority_counts` and
`tick_duration_ms`.

Heartbeat reports add:

| Field | Source |
|---|---|
| `memory` | `/proc/meminfo`: total, available, used kB, used % |
| `cpu` | `/proc/loadavg` and `/proc/cpuinfo`: 1/5/15 min load, CPU count, load normalised by CPU count, and utilisation % where available |
| `active_sessions` | `who --ips` (falls back to `who`) |
| `oom_events` | `journalctl -k` OOM-killer lines |
| `rpm_db_corrupted` | stale `/var/lib/rpm/__db.*` lock files with no live rpm/yum/dnf process (RPM hosts only) |
| `stalled_collectors`, `collector_errors` | derived from collector state |
| `auth_events` | sshd and sudo journal lines (section 5) |
| `fim_changes`, `fim_coverage` | the FIM engine (section 7) |
| `snapshots` | collector output, see below |

**Snapshots** ship when any diffable collector's output changed, and at least
every 5 minutes (the process inventory refresh). Processes are not part of the
change hash.

**Priority**: a report with any OOM or FIM change is `critical`; everything
else is `bulk`. Critical reports are sent and replayed first.

---

## 4. Collectors

Each collector has its own cadence (seconds, overridable, section 9) and
reports `ok`, `error` or `pending` with last attempt, last success, age and
error in `collector_status`. A collector is **stalled** once it has succeeded
before but not within 3 x its interval. A cached result stays visible after a
failure, with its age and error shown separately.

| Collector | Every | Diffable | What it captures |
|---|---|---|---|
| `ports` | 60 | yes | `ss -tulnp` (falls back to `ss -tuln`): TCP and UDP listeners with protocol, address, port, process |
| `processes` | 60, sent every 300 | no | `ps -eo user,pid,comm`: user, PID, command name. **No arguments.** |
| `disk` | 60 | yes | `df -P -T` and `df -P -i`: byte and inode fill per mount, pseudo filesystems skipped, separate sample times |
| `users` | 120 | yes | `getent passwd/group/shadow`: name, UID, shell, interactive flag, groups, sudo/wheel membership, password state (`locked`, `no_password`, `password_set`, `unknown`), account class (`system` or `human_or_local`, a UID and shell heuristic, not identity proof). Password hashes are never sent. |
| `authorized_keys` | 120 | yes | `/home/*/.ssh` and `/root/.ssh`: user, key type, OpenSSH SHA256 fingerprint of the key blob. No key body or comment. |
| `sudoers` | 120 | yes | SHA256 of `/etc/sudoers` and each `/etc/sudoers.d/*` |
| `critical_files` | 120 | yes | SHA256 of `/etc/passwd`, `group`, `shadow`, `gshadow`, `ssh/sshd_config`, `hosts`, `resolv.conf`, `pam.d/sshd`, `pam.d/sudo`, `pam.d/openvpn`, `crontab` |
| `cron` | 120 | yes | SHA256 of `/etc/crontab`, `/etc/cron.{d,hourly,daily,weekly,monthly}/*`, `/var/spool/cron/*` |
| `policy_summaries` | 120 | yes | Allowlisted sshd directives (`passwordauthentication`, `pubkeyauthentication`, `permitrootlogin`, `permitemptypasswords`, `maxauthtries`, `x11forwarding`, `allowagentforwarding`, `allowtcpforwarding`, `clientaliveinterval`, `clientalivecountmax`) and counts of active sudo and cron entries. Never file text or scheduled commands. |
| `packages` | 3600 | yes | Installed package names (`rpm -qa` or `dpkg-query`) |
| `package_details` | 3600 | yes | Versions; RPM install time where the database has it, otherwise marked unavailable. Not a vulnerability, publisher or signature check. |
| `systemd_units` | 600 | yes | Enabled unit files, active services and timers, and running services as three separate sets |
| `suid` | 600 | yes | `find /usr /opt /bin /sbin -xdev -perm -4000 -type f` (30 s timeout). A failed or partial scan is reported as a collector error and never replaces a complete inventory. |
| `kernel_modules` | 600 | yes | Sorted module names from `lsmod` |

RPM and DPKG hosts are auto-detected.

---

## 5. SSH and sudo events

The agent reads `sshd` and `sudo` lines from the journal every heartbeat over an
overlapping window of `INTERVAL + 120` seconds, so a missed tick loses nothing.
Journal `__CURSOR` and timestamp are kept; the adapter derives a deterministic
event id from the cursor (`host-auth:<instance>:<cursor>`), so re-reads dedupe.

- **SSH** messages are pattern-scrubbed (section 10.3). Scrubbing reduces
  accidental exposure; it cannot guarantee arbitrary log text is clean, so only
  parsed access fields are kept.
- **Sudo** records are reduced to acting user, target account and executable.
  Arguments, TTY and working directory are dropped before transport.
- The normalised event keeps action, outcome, user, source IP and method, plus
  cursor and time. The original journal message is not stored in the event.

---

## 6. Delivery and reliability

### 6.1 Agent spool
If a send is not accepted, the report is written to
`/var/lib/blackwatch-agent/spool/<priority>-<unix-ms>-<uuid>.json` (mode `0600`,
directories `0700`). On the next send the spool is replayed first, critical
files before bulk, oldest first. Caps: `SPOOL_MAX_FILES` (5000) and
`SPOOL_MAX_BYTES` (100 MiB); when exceeded the oldest files are deleted, so an
outage can never fill the disk.

### 6.2 Backoff
After 3 consecutive failures the agent sleeps `30 x floor((failures - 1) / 3)`
seconds after each further failure, capped at 300 (failures 4-6: 30 s,
7-9: 60 s, 10-12: 90 s, 13-15: 120 s, and so on). The counter resets on the first
accepted send.

### 6.3 HTTPS admission (server side)
`POST /api/agent/v1/reports` authenticates the bearer token against
`BLACKWATCH_AGENT_TOKENS`, validates the report, and writes it to the ingress
spool before answering `202 {accepted, duplicate, ack_id, accepted_at}`.
The token is bound to the report's `agent_id`; a mismatch is rejected.

| Status | Meaning |
|---|---|
| 401 | missing or wrong token |
| 413 / 422 | body too large, or invalid report (schema, timestamps, identity mismatch) |
| 429 | admission spool is at capacity (`Retry-After: 5`) |
| 503 | the spool volume is unavailable |

The agent counts any non-2xx answer as a failure, spools the report, and uses
its own backoff (it does not read `Retry-After`).

The `agent-worker` container claims one report at a time (it polls every
second when idle). Spool folders: `incoming`, `processing`, `retry`,
`quarantine`. A processing failure moves the report to `retry` after
`min(300, 5 x 2^min(attempts, 6))` seconds; a report that fails validation goes to
`quarantine`; a claim lease lasts 300 s. Reports are deduplicated per
(agent id, report id). Defaults: 10,000 files, 1 GiB, and 1 MiB per report (checked on the compressed body and again on the decompressed JSON).

### 6.4 SQS size cap
Only on the SQS transport the agent trims a report to 240,000 bytes: it drops
`snapshots.suid`, `systemd_units`, `packages`, `kernel_modules`, `cron`, then
`processes`, then the whole `snapshots` block, then halves `fim_changes`, then
drops `auth_events`. What was dropped is listed in `payload.truncated`, shown in
BlackWatch as `extra.adapter_truncated`, and as `trunc=...` in the agent log.
The SQS queue keeps messages 24 hours and moves a message to
`blackwatch-ec2-agents-dlq` after 5 failed receives.

### 6.5 Sequence and delivery tracking
Each report has a per-agent `sequence` and `boot_id`. BlackWatch records
acceptance and processing times separately from the agent's own timestamps, so
queue delay and ingest delay are never mistaken for an agent outage. It keeps
cumulative historical gaps and a bounded list (256 ranges) of currently missing
sequences; a late report resolves its gap, and overflow is shown as
"data-loss risk" rather than exact loss.

Delivery state per agent: `data_loss_risk` (gaps or overflow), `silent` (nothing
accepted for 180 s), `processing_delayed` or `delivery_delayed` (over 60 s),
`collector_degraded`, `healthy`. Where to look: the **Agent ingestion** block under Collection diagnostics on
`/hosts` (accept p95, processing p95, retrying, quarantined), and the API
`GET /api/agents/ingress` (HTTPS receipts and spool state) and
`GET /api/agents/delivery`.

---

## 7. File integrity monitoring (FIM)

FIM is part of the agent: three threads in `fim_engine.py` sharing one local
SQLite baseline (`/var/lib/blackwatch-agent/fim/baseline.db`, WAL mode,
guarded by a lock). It needs no separate daemon.

### 7.1 What is watched

`critical_files` (exact files): `/etc/passwd`, `shadow`, `group`, `gshadow`,
`sudoers`, `login.defs`, `ssh/sshd_config`, `hosts`, `hosts.allow`,
`hosts.deny`, `resolv.conf`, `crontab`, `nsswitch.conf`, `pam.conf`, `profile`,
`bashrc`, `environment`.

`critical_dirs` (recursive, plus real-time): `/etc/ssh/sshd_config.d`,
`/etc/sudoers.d`, `/etc/pam.d`, `/etc/security`, `/etc/cron.d`, `cron.hourly`,
`cron.daily`, `cron.weekly`, `cron.monthly`, `/etc/systemd/system`,
`/etc/profile.d`, `/root/.ssh`.

`binary_dirs` (periodic scan only): `/bin`, `/sbin`, `/usr/bin`, `/usr/sbin`,
`/usr/local/bin`, `/usr/local/sbin`.

Never traversed: `/proc`, `/sys`, `/dev`, `/run`, `/var/run`, `/var/log`,
`/var/cache`, `/var/tmp`, `/tmp`, `/var/lib/blackwatch-agent`. Files over
50 MB are not hashed. At most 1000 changes are queued per scan; beyond that a
single `<<truncated>>` marker change is emitted.

Add paths per host with `BLACKWATCH_FIM_EXTRA_FILES` and
`BLACKWATCH_FIM_EXTRA_DIRS` (comma separated, merged with the defaults).

### 7.2 Detection paths

1. **Periodic baseline scan.** First scan 15 s after start, then every
   `COLLECT_FIM_SEC` (6 h). Hashes every configured path, compares with the
   baseline (hash, size, mode, uid, gid) and reports `modified`,
   `perm_changed`, `owner_changed`, `created`, or `deleted` (baseline rows in
   scope that were not walked). A file with no baseline row is reported
   `created`, so the first scan after install reports every monitored file as
   created.
2. **Real-time inotify** (needs the `inotify_simple` package, which the
   installer adds). Watches `critical_files`, `critical_dirs` and one level of
   their subdirectories, not `binary_dirs`. Events: modify, create, delete,
   attrib, moved to/from, delete-self, move-self. A 200 ms per-path debounce
   turns one editor save into one change.
3. **Whodata via auditd.** The installer writes `/etc/audit/rules.d/bw_fim.rules`
   (`-w <path> -p wa -k bw_fim`) for: `/etc/passwd`, `shadow`, `group`,
   `gshadow`, `sudoers`, `sudoers.d`, `ssh/sshd_config`, `sshd_config.d`,
   `pam.d`, `security`, `login.defs`, `crontab`, `cron.d`, `cron.hourly`,
   `cron.daily`, `cron.weekly`, `cron.monthly`, `systemd/system`, `hosts`,
   `hosts.allow`, `hosts.deny`, `/root/.ssh`. **Whodata therefore does not cover**
   `resolv.conf`, `nsswitch.conf`, `pam.conf`, `profile`, `profile.d`, `bashrc`,
   `environment`, or any extra path you add. The reader tails
   `/var/log/audit/audit.log`, keeps the writer's `uid, gid, euid, egid, pid,
   ppid, comm, exe, tty`, and attaches it to a change only if the audit record
   is within 2 s (4096-entry cap). `PROCTITLE` (the full command line) is
   ignored because it can contain secrets. Attribution is best effort: a missing
   actor means "unknown", never "no one did it". It is almost always absent on
   periodic-scan changes, which are found long after the write.

If `inotify_simple`, auditd or the audit log is missing, the matching thread
logs once and stops; the rest keeps working. `BLACKWATCH_FIM_DISABLED=1` turns
FIM off entirely.

### 7.3 Event shape
Action `host.fim.{created,modified,deleted,perm_changed,owner_changed}` with
`extra`: `path`, `change_type`, `sha256_before/after`, `size_before/after`,
`perm_before/after`, `owner_before/after`, `detection` (`baseline`, `inotify`
or `auditd`), `detection_source`, `actor_confidence` (`best_effort` or
`unknown`), and `actor` (`uid, gid, pid, comm, exe`) when attribution hit. The
event's top-level actor principal is `"<comm> uid=<uid>"` when known. The event
id is deterministic (path, change, new hash, detection time), so re-shipped
reports do not duplicate.

`host.fim.coverage` rides on every heartbeat, updates the coverage table, and
is never stored as an event.

### 7.4 Storage
Migrations `014` to `017` (additive): `fim_baselines` (current known state per
instance and path, only for paths that have changed), `fim_history`
(append-only log: change fields, `detection`, `actor_uid/gid/pid/comm/exe`; the
`actor_proctitle` column exists but is no longer filled), and `fim_coverage`
(per host: paths configured, files tracked, last scan time and duration, scan
errors, inotify and auditd state and watch count, `configured_paths`,
`path_stats`).

### 7.5 Detection rules (`rules/host.yaml`)
| Rule | Severity |
|---|---|
| sudoers changed (`host-fim-sudoers-changed`), non-root edit of a critical file, system binary modified by an editor (vim, vi, nano, emacs, ed) | critical |
| sshd_config, authorized_keys, PAM, cron, system binary modified | high |
| systemd unit changed, generic modified, perm changed, owner changed | medium |
| created, deleted | low |

`host.file.changed` (the `critical_files` hash collector) is a separate,
slower signal at high severity.

### 7.6 UI
`/fim` lists every host with FIM data (files, paths, real-time and whodata
state, last scan) and recent changes across hosts. `/fim/<instance id>` shows
that host's coverage, monitored paths with file counts, recent changes, stray
baselines (baseline rows outside any configured path) and the configuration
how-to. Any event opens in `/events/<event id>`.

---

## 8. What BlackWatch derives

### 8.1 From the adapter (`Ec2HostAdapter`)
| Action | When |
|---|---|
| `host.service.health` | every heartbeat; feeds the host read model; not stored as an event |
| `host.state.snapshot` | when snapshots ship; capped at 512 KB, not stored as an event |
| `host.state.snapshot.rejected` | a snapshot over 512 KB (the heartbeat is kept) |
| `host.auth.ssh.success`, `host.auth.ssh.password.success`, `host.auth.ssh.failure` | SSH log lines (`reason=invalid_user` for unknown users) |
| `host.sudo.exec`, `host.sudo.failure` | sudo log lines |
| `host.oom_kill` | kernel OOM lines |
| `host.fim.*` | FIM changes (section 7) |

### 8.2 From the host projection
| Action | Trigger |
|---|---|
| `host.first_seen` | first report from an instance |
| `host.agent.stale` / `host.agent.recovered` | no report received for 180 s (server receive time) / reports resume |
| `host.collector.stalled` / `host.collector.recovered` | a collector missed 3 x its interval / recovered |
| `host.memory.exhausted` / `host.memory.recovered` | used memory at or above 95 % / below 90 % |
| `host.cpu.anomaly` / `host.cpu.normal` | normalised load above the host's own mean + 3 standard deviations, at least 0.5, for 10 consecutive samples (needs 60 samples first) / 5 normal samples |
| `host.disk.warn`, `host.disk.critical`, `host.disk.recovered` | per mount, bytes or inodes: warn at 90 %, critical at 95 %, recovered below 85 % (the event says which) |
| `host.package_db.corrupted` / `.recovered` | the RPM lock-file check |
| `host.authorized_key.added/removed`, `host.user.added/removed/changed`, `host.sudoers.changed`, `host.cron.changed`, `host.file.changed`, `host.port.opened/closed`, `host.suid.added/removed`, `host.service.added/removed`, `host.kernel.module.added/removed`, `host.packages.changed` | snapshot differences |
| `host.bruteforce`, `host.bruteforce.user` | 5 failed SSH logins in 5 minutes from one IP / against one user |

Host heartbeats also feed the performance-alert rules (memory, CPU
utilisation, worst disk) configured under Notifications.

### 8.3 Default severities (`rules/host.yaml`)
- **critical**: `host.disk.critical`, plus the critical FIM rules above.
- **high**: `host.agent.stale`, SSH root login, SSH brute force (both), new
  authorized key, sudoers changed, critical file changed, cron changed, new
  SUID, kernel module added, OOM kill, memory exhausted, CPU anomaly, disk warn,
  and the high FIM rules.
- **medium**: sudo failure, SSH password login, new user, new listening port,
  new systemd service, packages changed, kernel module removed, package DB
  corrupted, collector stalled, and the medium FIM rules.
- **low**: a single failed SSH login, FIM created and deleted.
- **informational**: first seen, agent recovered, SSH key login, and the
  recovery events.

---

## 9. Configuration

### 9.1 Agent (`/etc/blackwatch-agent.env`)
The installer writes: `BLACKWATCH_TRANSPORT`, `BLACKWATCH_SQS_URL`,
`BLACKWATCH_INGEST_URL`, `BLACKWATCH_AGENT_TOKEN`, `AWS_REGION`, `INTERVAL`,
`CRITICAL_INTERVAL_SEC`, `BLACKWATCH_ROLLOUT`, `BLACKWATCH_TAGS`, `PYTHONPATH`,
`PYTHONUNBUFFERED`. Add any optional variable below to the same file (one
`NAME=value` per line) and restart the unit.

| Variable | Default | Purpose |
|---|---|---|
| `BLACKWATCH_TRANSPORT` | `sqs` | `sqs` or `https` |
| `BLACKWATCH_INGEST_URL` | none | `https://<host>/api/agent/v1/reports`; required for `https` |
| `BLACKWATCH_AGENT_TOKEN` | none | this agent's token; required for `https` |
| `BLACKWATCH_SQS_URL` | none | queue URL; required for `sqs`. Must match `^https://sqs\.[a-z0-9-]+\.amazonaws\.com/\d{12}/[A-Za-z0-9_\-]{1,80}$` or the agent refuses to start |
| `AWS_REGION` | from IMDS (installer: `us-west-1`) | SQS region |
| `INTERVAL` | 60 | heartbeat seconds; also sets the auth lookback (`INTERVAL + 120`) |
| `CRITICAL_INTERVAL_SEC` | 2 | how often to check for OOM and FIM changes |
| `BLACKWATCH_ROLLOUT` | `unclassified` (installer: `phase3-canary`) | label stored with delivery metrics |
| `BLACKWATCH_TAGS` | none | `k=v,k=v` stamped on every event (for routing) |
| `SPOOL_DIR`, `SPOOL_MAX_FILES`, `SPOOL_MAX_BYTES` | `/var/lib/blackwatch-agent`, 5000, 100 MiB | local spool |
| `COLLECT_FIM_SEC` | 21600 | FIM periodic scan |
| `BLACKWATCH_FIM_DISABLED` | off | `1`, `true` or `yes` disables FIM |
| `BLACKWATCH_FIM_EXTRA_FILES`, `BLACKWATCH_FIM_EXTRA_DIRS` | none | extra FIM paths |
| `COLLECT_PORTS_SEC`, `COLLECT_PROCESSES_SEC`, `COLLECT_DISK_SEC` | 60 | collector cadence |
| `COLLECT_PROCESSES_REPORT_SEC` | 300 | longest gap between process inventory sends |
| `COLLECT_USERS_SEC`, `COLLECT_AUTHORIZED_KEYS_SEC`, `COLLECT_SUDOERS_SEC`, `COLLECT_CRITICAL_FILES_SEC`, `COLLECT_CRON_SEC`, `COLLECT_POLICY_SUMMARIES_SEC` | 120 | collector cadence |
| `COLLECT_PACKAGES_SEC` | 3600 | packages and package details |
| `COLLECT_SYSTEMD_UNITS_SEC`, `COLLECT_SUID_SEC`, `COLLECT_KERNEL_MODULES_SEC` | 600 | collector cadence |

### 9.2 Server (`app` and `agent-worker` containers)
| Variable | Default | Purpose |
|---|---|---|
| `BLACKWATCH_AGENT_TOKENS` | none | `instance-id:token,instance-id:token`. The id must equal the agent's instance id. Loaded at startup, never returned by any API. |
| `BLACKWATCH_AGENT_INGRESS_DIR` | `/app/data/agent-ingress` | admission spool (the `blackwatch_bw_agent_ingress` volume, separate from the database volume) |
| `BLACKWATCH_AGENT_INGRESS_MAX_FILES` | 10000 | spool file cap |
| `BLACKWATCH_AGENT_INGRESS_MAX_BYTES` | 1 GiB | spool size cap |
| `BLACKWATCH_AGENT_INGRESS_MAX_REQUEST_BYTES` | 1 MiB | largest accepted report, compressed and decompressed |
| `BLACKWATCH_AGENT_INGRESS_LEASE_SECONDS` | 300 | worker claim lease |

---

## 10. Install, upgrade, remove

### 10.1 Prerequisites
A Linux instance (Amazon Linux 2 or 2023, Debian, Ubuntu), `python3`, `journald`,
and outbound HTTPS to BlackWatch (HTTPS transport) or to
`sqs.<region>.amazonaws.com` (SQS transport). The installer adds `pip3` if
missing and installs `boto3>=1.28,<1.35` and `inotify_simple>=1.3,<2.0` into
`/opt/blackwatch/python-packages` (so a system Python is never modified).

### 10.2 One-time setup per transport

**HTTPS.** Add `instance-id:token` pairs to `BLACKWATCH_AGENT_TOKENS` on the
server (`.env` or compose) and recreate `app` and `agent-worker`.

**SQS.** From `deploy/ec2/` run `setup.ps1` (`$env:REGION="us-west-1"`). It
creates the queue `blackwatch-ec2-agents` (24 h retention) and its DLQ
(`maxReceiveCount` 5), creates the managed policy `blackwatch-ec2-agent-send`
(`sqs:SendMessage` to that one queue, nothing else), and lets the
`blackwatch-sqs-reader` user receive, delete and get attributes on it. Attach the
send policy to each instance's role. Then in BlackWatch, **Connectors, Add
connector, SQS connector**: target module `ec2.host`, the queue URL, the region;
Test, then Enable.

### 10.3 Install on a host (as root)
Copy `scripts/ec2_agent.py`, `scripts/agent_transport.py` and
`scripts/fim_engine.py` (all three; without `fim_engine.py` FIM is disabled) and
`deploy/ec2/install-agent.sh`, then:

```bash
# HTTPS
sudo BLACKWATCH_TRANSPORT=https \
     BLACKWATCH_INGEST_URL="https://<blackwatch-host>/api/agent/v1/reports" \
     BLACKWATCH_AGENT_TOKEN="<token for this instance>" \
     BLACKWATCH_TAGS="env=prod,role=api" \
     AGENT_SRC=/tmp/ec2_agent.py bash /tmp/install-agent.sh

# SQS
sudo BLACKWATCH_SQS_URL="https://sqs.us-west-1.amazonaws.com/<ACCT>/blackwatch-ec2-agents" \
     AWS_REGION="us-west-1" AGENT_SRC=/tmp/ec2_agent.py bash /tmp/install-agent.sh
```

To go back to SQS later, rerun with `BLACKWATCH_TRANSPORT=sqs` (or edit the env
file) and the queue URL. The installer, in order: validates the transport
settings; installs pip, boto3 and inotify_simple; writes
`/etc/sysctl.d/99-blackwatch-agent.conf` (inotify limits 16384 watches, 256
instances); installs auditd if missing and loads `bw_fim.rules`; creates
`/opt/blackwatch` (0755) and `/var/lib/blackwatch-agent` and `/fim` (0700);
copies the three scripts; for SQS only, runs an optional role pre-flight; writes
`/etc/blackwatch-agent.env` (0600); writes and starts the systemd unit. Re-running
it upgrades in place (it skips copying a script onto itself).

### 10.4 Files on the host
| Path | Mode | Purpose |
|---|---|---|
| `/opt/blackwatch/ec2_agent.py` | 0755 | the agent |
| `/opt/blackwatch/agent_transport.py`, `fim_engine.py` | 0644 | transport and FIM modules |
| `/opt/blackwatch/python-packages/` | 0755 | boto3 and inotify_simple |
| `/etc/blackwatch-agent.env` | 0600 | settings and the HTTPS token |
| `/etc/systemd/system/blackwatch-agent.service` | | the unit |
| `/etc/sysctl.d/99-blackwatch-agent.conf` | | inotify limits |
| `/etc/audit/rules.d/bw_fim.rules` | 0640 | FIM audit rules |
| `/var/lib/blackwatch-agent/` | 0700 | state; holds `sequence` |
| `/var/lib/blackwatch-agent/spool/` | 0700 | unsent reports (files 0600) |
| `/var/lib/blackwatch-agent/fim/baseline.db` | 0600 | FIM baseline |

### 10.5 Remove
```bash
sudo systemctl disable --now blackwatch-agent
sudo rm -f /etc/systemd/system/blackwatch-agent.service /etc/blackwatch-agent.env \
           /etc/sysctl.d/99-blackwatch-agent.conf /etc/audit/rules.d/bw_fim.rules
sudo systemctl daemon-reload
sudo rm -rf /opt/blackwatch /var/lib/blackwatch-agent
sudo augenrules --load
```
Detach the IAM send policy if you used SQS, and remove the host's entry from
`BLACKWATCH_AGENT_TOKENS`. Do not remove `/opt/blackwatch` on the OpenVPN box if
the VPN agent is installed there; it shares the directory.

---

## 11. Security model

### 11.1 Privilege and sandbox
The agent runs as root (it must read `/etc/shadow`, the journal, SUID files and
`/root/.ssh`), so everything else is locked down. The unit sets
`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome=read-only`, `PrivateTmp`,
`PrivateDevices`, `SystemCallArchitectures=native`,
`SystemCallFilter=@system-service` with `SystemCallErrorNumber=EPERM`,
`RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK`, `Type=notify`
with `WatchdogSec=180`, `Restart=always`, `RestartSec=10`. It also lists newer
hardening directives (kernel tunables and modules, control groups, clock,
namespaces, realtime, SUID/SGID, personality, log rate limits) that older
systemd, including Amazon Linux 2's version 219, ignores and newer systemd
enforces.

Resource limits: `MemoryLimit=200M`, `CPUQuota=20%`, `TasksMax=64`,
`LimitNOFILE=1024`, `Nice=10`.

### 11.2 Watchdog
The agent sends `READY=1` at start and `WATCHDOG=1` in its main loop at least
every 0.5 s, including while the network is down. If the loop hangs for 3
minutes systemd kills and restarts it. The spool survives restarts.

### 11.3 Secret scrubbing
Applied to SSH journal text: `-p<secret>`, `--password=`, `--passwd=`,
`--pass=`, `MYSQL_PWD=`, `PGPASSWORD=`, `--token=`, `--secret=`, `--api-key=`,
`--apikey=`, `--key=`, uppercase `...KEY/TOKEN/SECRET/PASSWORD/PASSWD...=`
assignments, AWS access key ids (`AKIA`/`ASIA`), `aws_secret_access_key=`, and
`Authorization: Bearer|Basic`. Matches become `***`. The uppercase rule
deliberately also catches names like `LDAP_PASSWORD`.

### 11.4 Other controls
- The HTTPS token lives in `/etc/blackwatch-agent.env` (root only), never in the
  unit file. Tokens are per agent and bound to that agent's instance id.
- The agent refuses to start with a malformed SQS URL (section 9.1); the IAM
  policy scoped to one queue is the real control.
- The spool and its directories are root-only and hold reduced reports; treat
  them as sensitive.

### 11.5 Accepted risks
A compromised host can send events for its own instance id (HTTPS tokens and the
single-queue IAM policy limit this to that identity, but nothing signs the
payload). A modified agent binary is not detected. Root on the host can alter its
own journal. boto3 is fetched from PyPI at install time within a pinned range.

---

## 12. Operating it

```bash
sudo systemctl status blackwatch-agent
sudo journalctl -u blackwatch-agent -f
sudo journalctl -u blackwatch-agent --since "10 min ago" --no-pager | grep "^reported"
sudo /usr/bin/python3 /opt/blackwatch/ec2_agent.py --once    # one report, prints, sends, exits
sudo systemctl restart blackwatch-agent                       # also forces an immediate FIM scan within 15 s
sudo ls -la /var/lib/blackwatch-agent/spool/
```

The agent logs one line per accepted send:

```
reported instance=i-0123... transport=https accept_ms=84 auth_lines=2 snaps=no tick_ms=268 mem=56% load=0.07 sess=1
```

`accept_ms` is time from send to acknowledgement; `load` is the 1-minute load
divided by CPU count. Optional trailing flags: `oom=N`, `rpmdb=BAD`,
`stalled=a,b` (collectors that missed 3 x their interval), `errs=a,b` (last run
failed), `trunc=a,b` (fields dropped to fit SQS).

Verify hardening: `sudo systemctl cat blackwatch-agent`,
`sudo stat -c "%a %U" /var/lib/blackwatch-agent` (700 root), and
`sudo auditctl -l | grep bw_fim` plus `systemctl is-active auditd` for whodata.
Verify FIM end to end by touching a file in a watched directory that tolerates
junk, for example `sudo touch /etc/cron.d/bw-fim-test`, waiting two seconds,
then removing it. Do not test by writing to `/etc/sudoers.d/`: a bad sudoers
file disables sudo.

### Troubleshooting
| Symptom | Cause and fix |
|---|---|
| Repeated `send failed ... spooling`, HTTPS | `rejected` is 401 or 422: check the token and that the token's id equals the instance id; `backpressure` is 429 or 503: check the ingress volume and the `agent-worker` container; `connection` or `timeout`: reach the host over 443 |
| Repeated `send failed ... spooling`, SQS | `AccessDenied`: attach `blackwatch-ec2-agent-send` to the instance role; `Could not connect`: allow 443 to `sqs.<region>.amazonaws.com` |
| Refuses to start: invalid SQS URL, or missing ingest URL/token | fix `/etc/blackwatch-agent.env` and restart |
| Host shows stale in BlackWatch but the agent logs `reported` | check Collection diagnostics, Agent ingestion on `/hosts` and `GET /api/agents/ingress`: reports may be accepted but retrying or quarantined; check the `agent-worker` logs |
| `watchdog timeout` in the journal | a collector subprocess hung; systemd restarted the agent; read `stalled` and `errs` on the next lines |
| `rpmdb=BAD` | stale RPM lock files: `sudo rm -f /var/lib/rpm/__db.*; sudo rpm --rebuilddb` |
| `trunc=...` every tick (SQS) | host is larger than the SQS cap; raise collector intervals or switch to HTTPS |
| `fim=startup_failed` or `inotify_simple not installed` | reinstall with the installer; FIM then runs periodic-only without it |
| No whodata actor on changes | auditd missing, rules not loaded, or the path is not in the audit rule list (section 7.2) |
| Unknown lvalue ... in the journal at install | expected on older systemd; those directives are ignored |

### Failure and data-loss scenarios
- The agent restarts within 10 s of any crash; unsent reports survive in the spool.
- When the spool exceeds its caps the oldest reports are deleted.
- Deleting `/var/lib/blackwatch-agent` loses the spool, the FIM baseline (the next
  scan reports every file as created) and the sequence counter.
- A terminated instance's history stays only in BlackWatch's database.

---

## 13. Known limitations

1. **A report that is never accepted blocks everything behind it.** The agent
   replays the spool before sending a new report and treats any non-2xx as
   failure. A report the server permanently rejects (422, including a report over 1 MiB
   of JSON) or that the agent refuses to send (a body over 1 MiB) stays at the front of the
   spool, so all later reports queue behind it until the spool cap deletes it. A
   corrupt spool file stops replay of everything after it. Clear it by removing
   the offending file from `/var/lib/blackwatch-agent/spool/`.
2. **Spool writes are not atomic.** A crash mid-write can leave a partial file
   (see 1).
3. **The agent ignores `Retry-After`** and uses its own backoff.
4. The HTTPS transport does not trim oversized reports; the SQS transport does.
5. FIM whodata covers only the audit-rule paths in section 7.2.
6. `host.process.first_seen` is no longer emitted. Its rule and notification
   entry still exist but can never fire.
7. Without `fim_engine.py` on the host, FIM is silently disabled.

---

## 14. Design decisions in force

- Process **command lines are not collected**; they can hold secrets and
  scrubbing cannot guarantee safety. Process inventory (user, PID, name) is
  context only.
- Sudo arguments are not collected; auditd `PROCTITLE` is ignored.
- `host.process.first_seen` was removed: a new process name is inventory churn,
  not a threat signal.
- Package inventory is hourly and supporting only.
- Delivery is judged by server receive time, and acceptance and processing are
  tracked separately, so transport or database delay is never reported as an
  agent outage.
- An absent FIM actor means unknown. A collector that fails keeps its last value
  visible but marked old, with the error shown.
- Database changes for this feature are additive only; events, snapshots,
  delivery rows and FIM evidence are never deleted by a code change.

---

## 15. Related documents

- [`vpn-agent.md`](vpn-agent.md): the OpenVPN agent (SQS only, same sandbox approach).
- [`EVENT_SCHEMA.md`](EVENT_SCHEMA.md): the event envelope.
- [`ui-design.md`](ui-design.md): the Hosts and FIM pages.
