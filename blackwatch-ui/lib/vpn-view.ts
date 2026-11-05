import type { VpnCertificate, VpnServer } from "./types";
import type { HealthCard } from "./overview";

export type CertBands = { expired: number; critical: number; high: number; warning: number; error: number };

/** Certificates by urgency: expired, <7d, <14d, <30d, plus unreadable ones. */
export function countByBand(certs: Pick<VpnCertificate, "days_remaining" | "error">[]): CertBands {
  const c: CertBands = { expired: 0, critical: 0, high: 0, warning: 0, error: 0 };
  for (const cert of certs) {
    if (cert.error) {
      c.error++;
      continue;
    }
    const d = cert.days_remaining;
    if (d == null) continue;
    if (d < 0) c.expired++;
    else if (d < 7) c.critical++;
    else if (d < 14) c.high++;
    else if (d < 30) c.warning++;
  }
  return c;
}

/** Soonest-expiring first; certs with no expiry (errors) last. */
export function sortCerts<T extends Pick<VpnCertificate, "days_remaining">>(certs: T[]): T[] {
  const days = (c: T) => c.days_remaining ?? Number.POSITIVE_INFINITY;
  return [...certs].sort((a, b) => days(a) - days(b));
}

export const serverOk = (s: Pick<VpnServer, "active" | "stale">) => s.active && !s.stale;

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

export function buildVpnCards(servers: VpnServer[], auth: { outcome?: string | null }[]): HealthCard[] {
  const total = servers.length;
  const up = servers.filter(serverOk).length;
  const clients = servers.reduce((n, s) => n + s.client_count, 0);
  const bands = countByBand(servers.flatMap((s) => s.certs ?? []));
  const certProblems = bands.expired + bands.critical + bands.high + bands.warning + bands.error;
  const failures = auth.filter((a) => a.outcome != null && a.outcome !== "success").length;
  return [
    {
      id: "servers",
      label: "Servers active",
      value: String(up),
      of: `of ${total}`,
      tone: total === 0 ? "neutral" : up === total ? "ok" : "critical",
      ratio: total === 0 ? null : up / total,
      detail: total === 0 ? "No server has reported." : up === total ? "All servers are reporting." : `${total - up} down or stale.`,
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
      href: "#servers",
      cta: "Show clients",
    },
    {
      id: "certs",
      label: "Certificates",
      value: String(certProblems),
      tone: bands.expired > 0 || bands.critical > 0 ? "critical" : bands.high > 0 ? "high" : certProblems > 0 ? "medium" : "ok",
      ratio: null,
      detail: certProblems === 0 ? "None expiring within 30 days." : certSummary(bands) + ".",
      href: "#servers",
      cta: "Show certificates",
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
