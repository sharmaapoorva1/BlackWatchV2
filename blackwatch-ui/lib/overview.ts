import type {
  AgentIngressDiagnostics,
  ConnectorsListResponse,
  OverviewResponse,
  ServiceCounts,
} from "./types";

export type Tone = "ok" | "neutral" | "medium" | "high" | "critical";

export interface HealthCard {
  id: string;
  label: string;
  /** The headline number or word. */
  value: string;
  /** Muted suffix after the value, e.g. "of 12". */
  of?: string;
  tone: Tone;
  /** 0..1 fill for a progress bar, or null for none. */
  ratio: number | null;
  /** One sentence saying what the number means right now. */
  detail: string;
  href: string;
  /** Verb phrase for the link, e.g. "Open hosts". */
  cta: string;
  /** Optional stacked bar (used for posture severity). */
  segments?: { label: string; count: number; tone: Tone }[];
}

export interface OverviewInputs {
  overview: OverviewResponse;
  connectors: Pick<ConnectorsListResponse, "connectors"> | null;
  ingress: Pick<AgentIngressDiagnostics, "metrics"> | null;
  services: Record<string, ServiceCounts> | null;
}

const EMPTY_SERVICES: ServiceCounts = { total: 0, up: 0, down: 0, degraded: 0, unknown: 0, disabled: 0 };

/** Probe-target totals across every VPC. */
export function sumServiceCounts(counts: Record<string, ServiceCounts>): ServiceCounts {
  return Object.values(counts).reduce<ServiceCounts>(
    (sum, vpc) => ({
      total: sum.total + vpc.total,
      up: sum.up + vpc.up,
      down: sum.down + vpc.down,
      degraded: sum.degraded + vpc.degraded,
      unknown: sum.unknown + vpc.unknown,
      disabled: sum.disabled + vpc.disabled,
    }),
    { ...EMPTY_SERVICES },
  );
}

export function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const unavailable = (id: string, label: string, href: string, cta: string): HealthCard => ({
  id,
  label,
  value: "—",
  tone: "neutral",
  ratio: null,
  detail: "Could not load this signal.",
  href,
  cta,
});

function hostsCard(overview: OverviewResponse): HealthCard {
  const { total, reporting, stale } = overview.hosts;
  if (total === 0) {
    return { id: "hosts", label: "Hosts", value: "0", tone: "neutral", ratio: null, detail: "No hosts have reported yet.", href: "/hosts", cta: "Open hosts" };
  }
  const tone: Tone = stale === 0 ? "ok" : stale / total >= 0.5 ? "high" : "medium";
  return {
    id: "hosts",
    label: "Hosts reporting",
    value: String(reporting),
    of: `of ${total}`,
    tone,
    ratio: reporting / total,
    detail: stale === 0 ? "Every host is reporting." : `${stale} ${stale === 1 ? "host is" : "hosts are"} not reporting.`,
    href: "/hosts",
    cta: "Open hosts",
  };
}

function connectorsCard(connectors: OverviewInputs["connectors"]): HealthCard {
  if (!connectors) return unavailable("connectors", "Connectors", "/connectors", "Open connectors");
  const enabled = connectors.connectors.filter((connector) => connector.enabled);
  if (enabled.length === 0) {
    return { id: "connectors", label: "Connectors", value: "0", tone: "neutral", ratio: null, detail: "No connectors are enabled.", href: "/connectors", cta: "Open connectors" };
  }
  const healthy = enabled.filter((connector) => connector.health_state === "healthy").length;
  const failing = enabled.filter((connector) => connector.health_state === "failing").length;
  const stale = enabled.filter((connector) => connector.health_state === "stale").length;
  const tone: Tone = failing > 0 ? "high" : stale > 0 ? "medium" : "ok";
  return {
    id: "connectors",
    label: "Connectors healthy",
    value: String(healthy),
    of: `of ${enabled.length}`,
    tone,
    ratio: healthy / enabled.length,
    detail: failing > 0 ? `${failing} failing.` : stale > 0 ? `${stale} not running on schedule.` : "All running on schedule.",
    href: "/connectors",
    cta: "Open connectors",
  };
}

function servicesCard(services: OverviewInputs["services"]): HealthCard {
  if (!services) return unavailable("services", "Services", "/services", "Open services");
  const totals = sumServiceCounts(services);
  const live = totals.total - totals.disabled;
  if (live <= 0) {
    return { id: "services", label: "Services", value: "0", tone: "neutral", ratio: null, detail: "No probe targets configured.", href: "/services", cta: "Open services" };
  }
  const tone: Tone = totals.down > 0 ? "critical" : totals.degraded > 0 || totals.unknown > 0 ? "medium" : "ok";
  const parts = [
    totals.down > 0 ? `${totals.down} down` : null,
    totals.degraded > 0 ? `${totals.degraded} degraded` : null,
    totals.unknown > 0 ? `${totals.unknown} unknown` : null,
  ].filter(Boolean);
  return {
    id: "services",
    label: "Services up",
    value: String(totals.up),
    of: `of ${live}`,
    tone,
    ratio: totals.up / live,
    detail: parts.length > 0 ? `${parts.join(", ")}.` : "Every probed service is up.",
    href: "/services",
    cta: "Open services",
  };
}

export function ingestionCard(ingress: OverviewInputs["ingress"]): HealthCard {
  const metrics = ingress?.metrics;
  if (!metrics || metrics.available === false) return unavailable("ingestion", "Agent ingestion", "/hosts", "Open hosts");
  const quarantined = metrics.quarantined ?? 0;
  const retrying = metrics.retrying ?? 0;
  const tone: Tone = quarantined > 0 ? "high" : retrying > 0 ? "medium" : "ok";
  const p95 = metrics.processing_p95_seconds;
  return {
    id: "ingestion",
    label: "Agent ingestion",
    value: quarantined + retrying === 0 ? "Healthy" : String(quarantined + retrying),
    of: quarantined + retrying === 0 ? undefined : quarantined > 0 ? "need attention" : "retrying",
    tone,
    ratio: null,
    detail:
      quarantined > 0
        ? `${quarantined} quarantined, ${retrying} retrying.`
        : retrying > 0
          ? `${retrying} reports retrying.`
          : p95 == null
            ? "Reports are being processed."
            : `Processing p95 ${p95.toFixed(1)}s.`,
    href: "/hosts",
    cta: "Open hosts",
  };
}

function postureCard(overview: OverviewResponse): HealthCard {
  const by = overview.posture.by_severity;
  const total = overview.posture.total_open;
  const tone: Tone = by.critical > 0 ? "critical" : by.high > 0 ? "high" : by.medium > 0 ? "medium" : total > 0 ? "neutral" : "ok";
  return {
    id: "posture",
    label: "Open posture findings",
    value: String(total),
    tone,
    ratio: null,
    detail: total === 0 ? "Nothing open." : `${by.critical} critical, ${by.high} high, ${by.medium} medium.`,
    href: "/aws-posture",
    cta: "Open posture",
    segments: [
      { label: "Critical", count: by.critical, tone: "critical" },
      { label: "High", count: by.high, tone: "high" },
      { label: "Medium", count: by.medium, tone: "medium" },
      { label: "Low", count: by.low, tone: "neutral" },
      { label: "Info", count: by.informational, tone: "neutral" },
    ],
  };
}

/** The six "is the platform healthy and collecting?" cards, in reading order. */
export function buildHealthCards(input: OverviewInputs): HealthCard[] {
  return [
    hostsCard(input.overview),
    servicesCard(input.services),
    connectorsCard(input.connectors),
    ingestionCard(input.ingress),
    postureCard(input.overview),
    {
      id: "volume",
      label: "Events, last 24h",
      value: fmtCount(input.overview.volume_24h),
      tone: "neutral",
      ratio: null,
      detail: "Stored events. High-volume heartbeats are filtered out.",
      href: "/events",
      cta: "Open events",
    },
  ];
}

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  /** Share of the largest row, 0..1, for bar length. */
  ratio: number;
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational", "unscored"];
const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Info",
  unscored: "Unscored",
};

/** Severity rows in a fixed order, always all of them, bars relative to the largest. */
export function severityBreakdown(counts: Record<string, number>): BreakdownRow[] {
  const max = Math.max(1, ...SEVERITY_ORDER.map((key) => counts[key] ?? 0));
  return SEVERITY_ORDER.map((key) => ({
    key,
    label: SEVERITY_LABEL[key] ?? key,
    count: counts[key] ?? 0,
    ratio: (counts[key] ?? 0) / max,
  }));
}
