# RDS monitoring: what is collected, derived, and alerted

One page for the whole RDS workflow. Setup and troubleshooting are in
[`rds.md`](rds.md).

## 1. Collected

Postgres and RDS Proxy log lines go CloudWatch Logs, subscription filter,
`bw-rds-forwarder` Lambda, SQS, then the `aws_rds_sqs` connector and the
`aws.rds` adapter. Connections, disconnections, auth failures, engine errors
and (if pgaudit is on) DDL, role changes and function calls become events.

pgaudit is off by default. Without it there are no DDL, role-change or
function alerts, which are the two critical rules in `rules/aws_rds.yaml`.

## 2. Derived

| Signal | Event | Notes |
|---|---|---|
| Failed-login burst | `rds.auth.burst` | 5 failures for one user in 5 minutes |
| Login after failures | `rds.auth.success_after_failures` | A human DB user logs in within 10 minutes of 5+ failures. Service accounts are skipped, since a rotated password makes an app fail and then succeed. |
| Log feed went quiet | `rds.logs.silent` / `rds.logs.resumed` | See below |
| New client source | `rds.proxy.source.new`, `rds.session.new_source` | First sight of an IP, or of a user from an IP |
| User not on allowlist | `rds.user.unknown` | Once per user per day |
| Concurrent sessions | `rds.session.concurrent` | Same user from more than one IP, once per day |
| Forgotten session | `rds.session.long_idle` | Open more than 24 hours |

### The silent-feed check

If the subscription filter, the forwarder Lambda or the queue breaks,
BlackWatch just receives nothing and nothing looks wrong. So a database that
normally logs and then goes quiet is the only signal.

"Quiet" is judged per database. It is the larger of 2 hours
(`BLACKWATCH_RDS_SILENT_MINUTES`) and three times the longest gap in the last
week, and a database needs at least 50 events in that week before it is
judged. A pooled application that is quiet for 8 hours every night will not
alert; one that is normally busy every few minutes will. Our own sweep events
do not count as activity, and the next real event clears the flag and sends
`rds.logs.resumed`.

## 3. Who gets told

| Tier | Severity | Alerts |
|---|---|---|
| Page | high / critical | auth burst, login after failures, log feed silent, new proxy source, new session source, unknown user, DDL, role change, engine error |
| Digest candidate | medium | function executed, long-idle session, proxy backend reject |
| Dashboard only | low / informational | single failed login, session start and end, log feed resumed |

The login and source alerts show the client's country and network when GeoIP
is configured; private addresses (VPN, proxy) have none, so the line is
omitted.

## 4. Deploying

Normal rebuild. Migration `047_rds_silence.sql` is additive and runs on start.
No change is needed on the AWS side.
