import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import type { BreakdownRow, HealthCard, Tone } from "@/lib/overview";

const DOT: Record<Tone, string> = {
  ok: "bg-sev-resolved",
  neutral: "bg-fg-subtle",
  medium: "bg-sev-medium",
  high: "bg-sev-high",
  critical: "bg-sev-critical",
};

const TEXT: Record<Tone, string> = {
  ok: "text-sev-resolved",
  neutral: "text-fg",
  medium: "text-sev-medium",
  high: "text-sev-high",
  critical: "text-sev-critical",
};

const STATUS_WORD: Record<Tone, string> = {
  ok: "Healthy",
  neutral: "Info",
  medium: "Warning",
  high: "Degraded",
  critical: "Critical",
};

/**
 * One health signal: what it is, the number, whether that is good, why, and
 * where to go next. The whole card is the link. Tone is shown with a word as
 * well as colour, so it is never colour-only.
 */
export function StatCard({ card }: { card: HealthCard }) {
  const total = card.segments?.reduce((sum, segment) => sum + segment.count, 0) ?? 0;
  return (
    <Link
      href={card.href}
      className="group flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-1 p-4 transition-colors hover:border-signal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg-muted">{card.label}</h3>
        <span className={clsx("inline-flex items-center gap-1.5 text-xs", TEXT[card.tone])}>
          <span aria-hidden="true" className={clsx("h-1.5 w-1.5 rounded-full", DOT[card.tone])} />
          {STATUS_WORD[card.tone]}
        </span>
      </div>

      <p className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-fg">{card.value}</span>
        {card.of && <span className="text-sm text-fg-subtle">{card.of}</span>}
      </p>

      {card.ratio !== null && (
        <div
          role="img"
          aria-label={`${Math.round(card.ratio * 100)} percent`}
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className={clsx("h-full rounded-full", DOT[card.tone])} style={{ width: `${Math.round(card.ratio * 100)}%` }} />
        </div>
      )}

      {card.segments && total > 0 && (
        <div role="img" aria-label="Findings by severity" className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
          {card.segments
            .filter((segment) => segment.count > 0)
            .map((segment) => (
              <div
                key={segment.label}
                title={`${segment.label}: ${segment.count}`}
                className={clsx("h-full", DOT[segment.tone])}
                style={{ width: `${(segment.count / total) * 100}%` }}
              />
            ))}
        </div>
      )}

      <p className="text-xs text-fg-muted">{card.detail}</p>

      <span className="mt-auto inline-flex items-center gap-1 text-xs text-signal group-hover:underline">
        {card.cta} <ArrowUpRight size={12} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Labelled bars, one per row, each linking to the matching filtered list. */
export function BreakdownList({
  rows,
  hrefFor,
  emptyText,
}: {
  rows: BreakdownRow[];
  /** Link for a row, or null when the row has nothing to open. */
  hrefFor: (row: BreakdownRow) => string | null;
  emptyText: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return <p className="px-4 py-6 text-sm text-fg-muted">{emptyText}</p>;
  const tone: Record<string, Tone> = { critical: "critical", high: "high", medium: "medium", low: "neutral", informational: "neutral", unscored: "neutral" };
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((row) => {
        const href = row.count > 0 ? hrefFor(row) : null;
        const body = (
          <>
            <span className="w-20 shrink-0 text-sm text-fg-muted">{row.label}</span>
            <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className={clsx("block h-full rounded-full", DOT[tone[row.key] ?? "neutral"])}
                style={{ width: `${Math.round(row.ratio * 100)}%` }}
              />
            </span>
            <span className={clsx("w-14 shrink-0 text-right font-mono text-sm tabular-nums", row.count === 0 ? "text-fg-disabled" : "text-fg")}>
              {row.count.toLocaleString("en-US")}
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {href ? (
              <Link
                href={href}
                className="flex min-h-11 items-center gap-3 px-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70"
              >
                {body}
              </Link>
            ) : (
              <div className="flex min-h-11 items-center gap-3 px-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
