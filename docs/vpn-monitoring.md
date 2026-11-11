# VPN monitoring: what is collected, derived, and alerted

One page for the whole VPN workflow. Agent details are in
[`vpn-agent.md`](vpn-agent.md); box facts are in [`vpn-info.md`](vpn-info.md).

## 1. Collected (on the OpenVPN box, `scripts/vpn_agent.py`)

- Every 60 s: service state, the client status file, the certificate and CRL
  inventory (PKI copy and live copy), and recent auth lines.
- Continuously: the journal follower ships `AUTH_FAILED` and
  `authentication succeeded` lines in under a second.

Not collected yet: TLS handshake and certificate-verify failures, and
connection attempts that never reach authentication.

## 2. Derived (server side)

| Signal | Event | Notes |
|---|---|---|
| Service up or down | `vpn.service.up/down` | Only on a transition |
| Agent went quiet | `vpn.agent.stale` / `vpn.agent.recovered` | 5 min without a heartbeat |
| Nobody logged in | `vpn.logins.silent` | Service up, no login for `BLACKWATCH_VPN_NO_LOGIN_HOURS` (default 24), and the server was used in the last 7 days |
| Brute force | `vpn.bruteforce`, `vpn.bruteforce.user` | 5 failures in 300 s, per IP and per user |
| Login after failures | `vpn.auth.success_after_failures` | A success after 5+ failures from the same IP or against the same user. Two typos then a success does not fire. |
| Risky source | `vpn.auth.risky_source` | A successful login from a Tor exit or a threat-feed IP |
| Concurrent sessions | `vpn.session.concurrent` | Once per change in the IP set, not every snapshot |
| Sessions | `vpn.session.start/end` | End events carry the duration. History is in `vpn_sessions`. |
| Certificates | `vpn.cert.expiring.*`, `vpn.cert.expired` | Bands at 30, 14, 7 days; once per band |
| Renewed, not deployed | `vpn.cert.renewed_not_deployed` | The PKI copy expires later than the live copy OpenVPN reads |
| New country, network, hour | UEBA first-seen events | Needs the UEBA warm-up (7 days) |

Duplicate deliveries (the heartbeat re-sends lines the follower already sent)
are stored once and are no longer counted twice by the brute-force detectors.

Every login-related alert shows the source's country and network when GeoIP is
configured.

## 3. Who gets told

| Tier | Severity | Alerts |
|---|---|---|
| Page (Slack and email at the default "Critical + high" threshold) | high / critical | service down, agent silent, no logins, brute force, login after failures, risky source, certificate expiring (7 d) or expired, renewed but not deployed |
| Digest candidate | medium | concurrent sessions, certificate within 30 days |
| Dashboard only | low / informational | single failed login, session start and end, agent recovered, service up |

For a daily digest of the middle tier, create a route at "Everything ≥ medium"
on a channel with a long digest window, and keep the paging route at
"Critical + high" on its own channel.

## 4. Certificates on the VPN page

- Days left are worked out from each certificate's expiry date in the browser
  request, so they stay right even when the agent has stopped reporting.
- One row per certificate: when a PKI copy and its live copy both exist, the
  live copy is the one that counts.
- "Renew first" lists the soonest-expiring certificates across servers with
  what breaks if each one expires (CA or server: everyone; client: that user;
  CRL: revocations stop being enforced).
- A certificate renewed in the PKI but not copied to the OpenVPN directory is
  flagged, because that is how the June 2026 outage started.

## 5. Deploying this

The app change needs a normal rebuild; migration `046_vpn_sessions_and_silence.sql`
is additive and runs on start. The agent on the VPN box is unchanged and does
not need a redeploy.
