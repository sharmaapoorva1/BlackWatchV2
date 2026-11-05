import type { HealthCard } from "./overview";

export type UebaTab = "anomalies" | "baselines";

export const parseUebaTab = (value: string | undefined): UebaTab => (value === "baselines" ? "baselines" : "anomalies");

const n = (value: number) => value.toLocaleString("en-US");
const distinct = (values: string[]) => new Set(values.filter(Boolean)).size;

/** Most common value, ties broken alphabetically; "" for none. */
export function topValue(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

/** Anomaly cards: how many, how many principals, and which dimension fires most. */
export function buildAnomalyCards(rows: { principal_id: string; dimension: string }[]): HealthCard[] {
  const principals = distinct(rows.map((r) => r.principal_id));
  const top = topValue(rows.map((r) => r.dimension));
  return [
    {
      id: "anomalies",
      label: "First-seen anomalies",
      value: n(rows.length),
      tone: rows.length > 0 ? "high" : "ok",
      ratio: null,
      detail: rows.length > 0 ? "A principal did something it had never done before." : "Nothing new. Principals may still be in their warm-up window.",
      href: "#anomalies",
      cta: "Show anomalies",
    },
    {
      id: "principals",
      label: "Principals involved",
      value: n(principals),
      tone: principals > 0 ? "medium" : "ok",
      ratio: null,
      detail: principals > 0 ? "Distinct users, roles or services." : "None.",
      href: "#anomalies",
      cta: "Show anomalies",
    },
    {
      id: "dimension",
      label: "Most common dimension",
      value: top || "—",
      tone: "neutral",
      ratio: null,
      detail: top ? "The behavior that changed most often." : "No anomalies to group.",
      href: "#anomalies",
      cta: "Show anomalies",
    },
  ];
}

/** Baseline cards for the explorer: size of the result and its spread. */
export function buildBaselineCards(rows: { principal_id: string; dimension: string }[], limit: number): HealthCard[] {
  return [
    {
      id: "baselines",
      label: "Baseline rows",
      value: n(rows.length),
      tone: "neutral",
      ratio: null,
      detail: rows.length >= limit ? `Showing the first ${n(limit)}. Narrow the filter to see the rest.` : "Matching the current filter.",
      href: "#baselines",
      cta: "Show baselines",
    },
    {
      id: "principals",
      label: "Principals",
      value: n(distinct(rows.map((r) => r.principal_id))),
      tone: "neutral",
      ratio: null,
      detail: "Distinct principals in these rows.",
      href: "#baselines",
      cta: "Show baselines",
    },
    {
      id: "dimensions",
      label: "Dimensions",
      value: n(distinct(rows.map((r) => r.dimension))),
      tone: "neutral",
      ratio: null,
      detail: "Behaviors being tracked, such as source IP.",
      href: "#baselines",
      cta: "Show baselines",
    },
  ];
}
