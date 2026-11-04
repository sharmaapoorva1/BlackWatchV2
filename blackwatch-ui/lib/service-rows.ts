import type { ServiceTarget } from "./types";

/** Only what the services tables render; `config` is intentionally dropped. */
export interface ServiceTableRow {
  id: string;
  name: string;
  vpc: string;
  tier: string;
  status: string;
  severity_when_down: string;
  latency_ms: number | null;
  consecutive_fails: number;
  age_seconds: number | null;
  stale: boolean;
  tags: [string, string][];
  /** Epoch ms the service went down, or null. Used to sort the archive. */
  down_since_ms: number | null;
  /** Preformatted on the server so server and browser render the same text. */
  down_for: string;
}

export function formatDownDuration(downSince: string | null, now: number): string {
  if (!downSince) return "—";
  const since = new Date(downSince).getTime();
  if (Number.isNaN(since)) return "—";
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  const days = Math.floor(secs / 86400);
  if (days >= 1) {
    const hours = Math.floor((secs % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const hours = Math.floor(secs / 3600);
  if (hours >= 1) return `${hours}h`;
  return `${Math.floor(secs / 60)}m`;
}

export function toServiceRow(service: ServiceTarget, now: number): ServiceTableRow {
  const downSince = service.down_since ? new Date(service.down_since).getTime() : Number.NaN;
  return {
    id: service.id,
    name: service.name,
    vpc: service.vpc,
    tier: service.tier,
    status: service.status,
    severity_when_down: String(service.severity_when_down),
    latency_ms: service.latency_ms,
    consecutive_fails: service.consecutive_fails,
    age_seconds: service.age_seconds,
    stale: service.stale,
    tags: Object.entries(service.tags ?? {}).map(([key, value]) => [key, String(value)] as [string, string]),
    down_since_ms: Number.isNaN(downSince) ? null : downSince,
    down_for: formatDownDuration(service.down_since, now),
  };
}
