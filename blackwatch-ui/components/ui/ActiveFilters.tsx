import Link from "next/link";
import { X } from "lucide-react";
import { activeParams, hrefWithout } from "@/lib/filters";

/**
 * Chips for the filters currently applied, each removing just that filter, so
 * it is always obvious why a list is short. Renders nothing with no filters.
 */
export function ActiveFilters({
  basePath,
  params,
  labels = {},
  hidden = [],
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  /** Friendly names for param keys, e.g. `{ q: "Search", module: "Module" }`. */
  labels?: Record<string, string>;
  /** Params that are page state (like `tab`), kept in links but not shown as chips. */
  hidden?: string[];
}) {
  const active = activeParams(params).filter(([key]) => !hidden.includes(key));
  if (active.length === 0) return null;
  // "Clear all" drops the filters but keeps page state such as the current tab.
  const keep = Object.fromEntries(hidden.map((key) => [key, params[key]]));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Active filters">
      <span className="text-xs text-fg-muted">Filtered by</span>
      {active.map(([key, value]) => (
        <Link
          key={key}
          href={hrefWithout(basePath, params, key)}
          aria-label={`Remove filter ${labels[key] ?? key}: ${value}`}
          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded border border-line px-2 text-xs text-fg transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
        >
          <span className="text-fg-muted">{labels[key] ?? key}:</span>
          <span className="truncate font-mono">{value}</span>
          <X size={12} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        </Link>
      ))}
      <Link
        href={hrefWithout(basePath, keep)}
        className="inline-flex min-h-11 items-center text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
      >
        Clear all
      </Link>
    </div>
  );
}
