import type { ApiGwSummary } from "./types";
import type { HealthCard } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");

/** Error share of all requests, 0..1; null when there is no traffic. */
export function errorRate(summary: Pick<ApiGwSummary, "requests" | "err_4xx" | "err_5xx">, kind: "err_4xx" | "err_5xx"): number | null {
  return summary.requests > 0 ? summary[kind] / summary.requests : null;
}

export function buildApiGwCards(summary: ApiGwSummary, alertCount: number, alertHours: number, failureCount: number, failureHours: number): HealthCard[] {
  return [
    {
      id: "alerts",
      label: "Alerts",
      value: n(alertCount),
      tone: alertCount > 0 ? "high" : "ok",
      ratio: null,
      detail: alertCount > 0 ? `New source, auth burst, scanner or 5xx burst in the last ${alertHours}h.` : `No attack or new-source alerts in the last ${alertHours}h.`,
      href: "#alerts",
      cta: "Show alerts",
    },
    {
      id: "5xx",
      label: "Server errors (5xx)",
      value: n(summary.err_5xx),
      of: `of ${n(summary.requests)} requests`,
      tone: summary.err_5xx > 0 ? "critical" : "ok",
      ratio: errorRate(summary, "err_5xx"),
      detail: summary.err_5xx > 0 ? "Your backends are failing requests." : "No server errors.",
      href: "#failures",
      cta: "Show failures",
    },
    {
      id: "4xx",
      label: "Client errors (4xx)",
      value: n(summary.err_4xx),
      of: `of ${n(summary.requests)} requests`,
      tone: summary.err_4xx > 0 ? "medium" : "ok",
      ratio: errorRate(summary, "err_4xx"),
      detail: failureCount > 0 ? `${n(failureCount)} auth or server failures in the last ${failureHours}h.` : "No recent auth failures.",
      href: "#failures",
      cta: "Show failures",
    },
    {
      id: "sources",
      label: "Unique sources",
      value: n(summary.sources),
      tone: "neutral",
      ratio: null,
      detail: summary.last_activity ? "Real client IPs seen in the logs." : "No traffic yet.",
      href: "#sources",
      cta: "Show source IPs",
    },
  ];
}
