import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { AttentionItem } from "@/lib/attention";

const LEVEL_BAR: Record<AttentionItem["level"], string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
};

const LEVEL_LABEL: Record<AttentionItem["level"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

/**
 * What to act on now, ranked, each row linking to the view that resolves it.
 * The page supplies the heading (this is the body of its "Needs attention"
 * section). An empty list is an explicit "all clear" so silence is never
 * ambiguous.
 */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-md border border-line-soft bg-surface-1 px-4 py-3">
        <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-sev-resolved" />
        <p className="text-sm text-fg">Nothing needs attention. Hosts, connectors, services and ingestion are healthy, and no high-severity findings are open.</p>
      </div>
    );
  }

  return (
    <ul aria-label="Items needing attention, most urgent first" className="overflow-hidden rounded-md border border-line bg-surface-1">
      {items.map((item) => (
        <li key={item.id} className="border-b border-line-soft last:border-0">
          <Link
            href={item.href}
            className="group relative flex min-h-14 items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70"
          >
            <span aria-hidden="true" className={clsx("absolute inset-y-0 left-0 w-0.5", LEVEL_BAR[item.level])} />
            <span className="w-16 shrink-0 text-xs font-medium text-fg-muted">{LEVEL_LABEL[item.level]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{item.title}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{item.detail}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-signal group-hover:underline">
              Review <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
