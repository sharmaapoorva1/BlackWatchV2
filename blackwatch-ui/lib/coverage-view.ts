import type { HealthCard } from "./overview";

export interface CoverageSummaryCounts {
  total: number;
  healthy: number;
  attention: number;
  disabled: number;
  stale: number;
}

/** Collector health cards. Attention and stale collectors mean data may be missing. */
export function buildCoverageCards(summary: CoverageSummaryCounts): HealthCard[] {
  const of = summary.total > 0 ? `of ${summary.total}` : undefined;
  const share = (value: number) => (summary.total > 0 ? value / summary.total : null);
  return [
    {
      id: "attention",
      label: "Needs attention",
      value: String(summary.attention),
      of,
      tone: summary.attention > 0 ? "high" : "ok",
      ratio: share(summary.attention),
      detail: summary.attention > 0 ? "Failing, unverified or never run. Data may be missing." : "No collector needs a fix.",
      href: "#collectors",
      cta: "Show collectors",
    },
    {
      id: "stale",
      label: "Stale",
      value: String(summary.stale),
      of,
      tone: summary.stale > 0 ? "high" : "ok",
      ratio: share(summary.stale),
      detail: summary.stale > 0 ? "Has not run recently. Its data is out of date." : "Every collector ran recently.",
      href: "#collectors",
      cta: "Show collectors",
    },
    {
      id: "healthy",
      label: "Healthy",
      value: String(summary.healthy),
      of,
      tone: summary.healthy > 0 ? "ok" : "neutral",
      ratio: share(summary.healthy),
      detail: "Ran recently and succeeded.",
      href: "#collectors",
      cta: "Show collectors",
    },
    {
      id: "disabled",
      label: "Disabled",
      value: String(summary.disabled),
      of,
      tone: "neutral",
      ratio: null,
      detail: summary.disabled > 0 ? "Switched off, so not collecting." : "None switched off.",
      href: "#collectors",
      cta: "Show collectors",
    },
  ];
}
