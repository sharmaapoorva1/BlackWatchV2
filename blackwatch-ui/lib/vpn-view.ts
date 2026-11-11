import type { VpnCertificate, VpnServer } from "./types";
import type { HealthCard } from "./overview";

export type CertBands = { expired: number; critical: number; high: number; warning: number; error: number };
export type CertBand = "expired" | "critical" | "high" | "warning" | "ok" | "unknown";

const DAY_MS = 86_400_000;

/**
 * Days until a certificate expires. Worked out from `not_after` at render time:
 * the agent's own `days_remaining` was true when it was sent, and goes stale
 * the moment the agent stops reporting. Falls back to it when the date is
 * missing or unreadable.
 */
export function certDaysLeft(cert: Pick<VpnCertificate, "not_after" | "days_remaining">, now: number): number | null {
  const expiry = cert.not_after ? Date.parse(cert.not_after) : NaN;
  if (!Number.isNaN(expiry)) return (expiry - now) / DAY_MS;
  return cert.days_remaining ?? null;
}

export function certBand(days: number | null, error?: string | null): CertBand {
  if (error) return "unknown";
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days < 7) return "critical";
  if (days < 14) return "high";
  if (days < 30) return "warning";
  return "ok";
}

/** What breaks when this certificate expires, in a few words. */
export function certImpact(cert: Pick<VpnCertificate, "kind" | "name" | "revoked">): string {
  if (cert.revoked) return "Already revoked";
  switch (cert.kind) {
    case "ca":
      return "Everyone is locked out";
    case "server":
      return "New connections fail for everyone";
    case "crl":
      return "Revocations stop being enforced";
    case "client":
      return `${cert.name} can no longer connect`;
    default:
      return "Unknown impact";
  }
}

/** Counts by urgency, one per distinct certificate (a PKI copy and its live copy count once, by the worse of the two). */
export function countByBand(certs: Pick<VpnCertificate, "days_remaining" | "error" | "not_after" | "kind" | "name" | "source" | "revoked">[], now: number = Date.now()): CertBands {
  const c: CertBands = { expired: 0, critical: 0, high: 0, warning: 0, error: 0 };
  for (const cert of effectiveCerts(certs, now)) {
    if (cert.error) {
      c.error++;
      continue;
    }
    const band = certBand(certDaysLeft(cert, now));
    if (band === "expired") c.expired++;
    else if (band === "critical") c.critical++;
    else if (band === "high") c.high++;
    else if (band === "warning") c.warning++;
  }
  return c;
}

type CertLike = Pick<VpnCertificate, "days_remaining" | "error" | "not_after" | "kind" | "name" | "source" | "revoked">;

/**
 * One entry per certificate: when both the PKI copy and the live copy exist,
 * the live copy is what OpenVPN reads, so it is the one that matters. Revoked
 * certificates are left out, they cannot expire into an outage.
 */
export function effectiveCerts<T extends CertLike>(certs: T[], now: number = Date.now()): T[] {
  const byKey = new Map<string, T>();
  for (const cert of certs) {
    if (cert.revoked) continue;
    const key = `${cert.kind}|${cert.name}`;
    const existing = byKey.get(key);
    if (!existing || (cert.source === "live" && existing.source !== "live")) byKey.set(key, cert);
    else if (existing.source === cert.source) {
      const a = certDaysLeft(existing, now) ?? Infinity;
      const b = certDaysLeft(cert, now) ?? Infinity;
      if (b < a) byKey.set(key, cert);
    }
  }
  return [...byKey.values()];
}

/** Soonest-expiring first; unreadable certificates last. */
export function sortCerts<T extends Pick<VpnCertificate, "days_remaining" | "not_after">>(certs: T[], now: number = Date.now()): T[] {
  const days = (c: T) => certDaysLeft(c, now) ?? Number.POSITIVE_INFINITY;
  return [...certs].sort((a, b) => days(a) - days(b));
}

export interface RenewalItem {
  server: string;
  cert: VpnCertificate;
  days: number | null;
  band: CertBand;
  impact: string;
}

/** The certificates to renew next, across all servers. Healthy ones (30+ days) are not listed. */
export function renewalQueue(servers: Pick<VpnServer, "server" | "certs">[], now: number = Date.now(), limit = 6): RenewalItem[] {
  const items: RenewalItem[] = [];
  for (const server of servers) {
    for (const cert of effectiveCerts(server.certs ?? [], now)) {
      const days = certDaysLeft(cert, now);
      const band = certBand(days, cert.error);
      if (band === "ok") continue;
      items.push({ server: server.server, cert, days, band, impact: certImpact(cert) });
    }
  }
  return sortCerts(items.map((item) => ({ ...item, not_after: item.cert.not_after, days_remaining: item.cert.days_remaining })), now)
    .slice(0, limit)
    .map(({ server, cert, days, band, impact }) => ({ server, cert, days, band, impact }));
}

export interface RenewedNotDeployed {
  server: string;
  name: string;
  kind: string;
  liveDays: number;
  renewedDays: number;
}

/** Certificates renewed in the PKI whose live copy still expires earlier: renewed, never copied. */
export function renewedNotDeployed(servers: Pick<VpnServer, "server" | "certs">[], now: number = Date.now()): RenewedNotDeployed[] {
  const out: RenewedNotDeployed[] = [];
  for (const server of servers) {
    const byName = new Map<string, { pki?: VpnCertificate; live?: VpnCertificate }>();
    for (const cert of server.certs ?? []) {
      if (cert.error || cert.revoked) continue;
      const entry = byName.get(`${cert.kind}|${cert.name}`) ?? {};
      if (cert.source === "pki") entry.pki = cert;
      if (cert.source === "live") entry.live = cert;
      byName.set(`${cert.kind}|${cert.name}`, entry);
    }
    for (const { pki, live } of byName.values()) {
      if (!pki || !live) continue;
      const renewed = certDaysLeft(pki, now);
      const current = certDaysLeft(live, now);
      if (renewed === null || current === null || renewed - current < 1) continue;
      out.push({ server: server.server, name: live.name, kind: live.kind, liveDays: current, renewedDays: renewed });
    }
  }
  return out.sort((a, b) => a.liveDays - b.liveDays);
}

/** "2 expired · 1 under 7d", only the non-zero parts. Empty when all is well. */
export function certSummary(b: CertBands): string {
  return [
    b.expired > 0 ? `${b.expired} expired` : null,
    b.critical > 0 ? `${b.critical} under 7d` : null,
    b.high > 0 ? `${b.high} under 14d` : null,
    b.warning > 0 ? `${b.warning} under 30d` : null,
    b.error > 0 ? `${b.error} unreadable` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const serverOk = (s: Pick<VpnServer, "active" | "stale"> & { agent_stale?: boolean }) => s.active && !s.stale && !s.agent_stale;

/** "12 min", "3 h", "2 d": a short session length. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds) || seconds < 0) return "—";
  if (seconds < 60) return "<1 min";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} d`;
}

export function buildVpnCards(
  servers: (Pick<VpnServer, "active" | "stale" | "client_count" | "certs"> & { agent_stale?: boolean })[],
  auth: { outcome?: string | null }[],
  now: number = Date.now(),
): HealthCard[] {
  const total = servers.length;
  const up = servers.filter(serverOk).length;
  const clients = servers.reduce((n, s) => n + s.client_count, 0);
  const certs = servers.flatMap((s) => s.certs ?? []);
  const bands = countByBand(certs, now);
  const certProblems = bands.expired + bands.critical + bands.high + bands.warning + bands.error;
  const notDeployed = renewedNotDeployed(servers.map((s, i) => ({ server: String(i), certs: s.certs ?? [] })), now).length;
  const failures = auth.filter((a) => a.outcome != null && a.outcome !== "success").length;
  const certTone = bands.expired > 0 || bands.critical > 0 ? "critical" : bands.high > 0 || notDeployed > 0 ? "high" : certProblems > 0 ? "medium" : "ok";
  const certDetail = [certSummary(bands), notDeployed > 0 ? `${notDeployed} renewed, not deployed` : ""].filter(Boolean).join(" · ");
  return [
    {
      id: "servers",
      label: "Servers active",
      value: String(up),
      of: `of ${total}`,
      tone: total === 0 ? "neutral" : up === total ? "ok" : "critical",
      ratio: total === 0 ? null : up / total,
      detail: total === 0 ? "No server has reported." : up === total ? "All servers are reporting." : `${total - up} down, silent or stale.`,
      href: "#servers",
      cta: "Show servers",
    },
    {
      id: "clients",
      label: "Clients connected",
      value: String(clients),
      tone: "neutral",
      ratio: null,
      detail: "Across all servers right now.",
      href: "#sessions",
      cta: "Show sessions",
    },
    {
      id: "certs",
      label: "Certificates",
      value: String(certProblems + notDeployed),
      tone: certTone,
      ratio: null,
      detail: certDetail ? certDetail + "." : "None expiring within 30 days.",
      href: "#certificates",
      cta: "Show renewals",
    },
    {
      id: "auth",
      label: "Failed logins",
      value: String(failures),
      of: `of ${auth.length} recent`,
      tone: failures === 0 ? "ok" : "medium",
      ratio: auth.length === 0 ? null : failures / auth.length,
      detail: auth.length === 0 ? "No attempts captured yet." : failures === 0 ? "Every recent attempt succeeded." : "Review the attempts below.",
      href: "#auth",
      cta: "Show attempts",
    },
  ];
}
