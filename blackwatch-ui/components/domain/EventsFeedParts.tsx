import Link from "next/link";
import clsx from "clsx";
import {
  SEVERITY_FILTERS,
  SEVERITY_FILTER_LABEL,
  severityChipHref,
  type EventFilterParams,
  type SeverityFilter,
} from "@/lib/events-view";

const DOT: Record<SeverityFilter | "unscored", string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  informational: "bg-sev-low",
  unscored: "bg-fg-subtle",
};

/**
 * One-click severity filter. The chip you are on is highlighted and clicking it
 * again clears it; every other filter is kept. Counts are those of the events
 * currently shown, so they are only displayed while no severity is selected.
 */
export function SeverityChips({
  params,
  mix,
}: {
  params: EventFilterParams;
  mix: Record<SeverityFilter | "unscored", number>;
}) {
  const showCounts = !params.severity;
  return (
    <nav aria-label="Filter by severity" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-fg-muted">Severity</span>
      {SEVERITY_FILTERS.map((severity) => {
        const active = params.severity === severity;
        return (
          <Link
            key={severity}
            href={severityChipHref(params, severity)}
            aria-current={active ? "true" : undefined}
            className={clsx(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8",
              active ? "border-signal bg-signal/10 text-fg" : "border-line text-fg-muted hover:border-signal/60 hover:text-fg",
            )}
          >
            <span aria-hidden="true" className={clsx("h-1.5 w-1.5 rounded-full", DOT[severity])} />
            {SEVERITY_FILTER_LABEL[severity]}
            {showCounts && <span className="font-mono text-xs text-fg-subtle">{mix[severity]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Stacked bar of the severities in the events shown, so the feed's shape reads at a glance. */
export function SeverityMixBar({ mix }: { mix: Record<SeverityFilter | "unscored", number> }) {
  const order: (SeverityFilter | "unscored")[] = ["critical", "high", "medium", "low", "informational", "unscored"];
  const total = order.reduce((sum, key) => sum + mix[key], 0);
  if (total === 0) return null;
  const present = order.filter((key) => mix[key] > 0);
  return (
    <div className="space-y-1.5">
      <div role="img" aria-label="Severity mix of the events shown" className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
        {present.map((key) => (
          <div key={key} className={clsx("h-full", DOT[key])} style={{ width: `${(mix[key] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {present.map((key) => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={clsx("h-1.5 w-1.5 rounded-full", DOT[key])} />
            {key === "unscored" ? "Unscored" : SEVERITY_FILTER_LABEL[key]}
            <span className="font-mono text-fg-subtle">{mix[key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
