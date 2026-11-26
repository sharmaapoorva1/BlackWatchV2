import Link from "next/link";
import clsx from "clsx";
import { AWS_TIMELINE_TABS, AWS_TIMELINE_WINDOWS, type AwsTimelineTab } from "@/lib/aws-timeline-view";

/** Time window: three short options, one active. `hrefFor` builds each link. */
export function WindowSwitch({ hours, hrefFor }: { hours: number; hrefFor: (hours: number) => string }) {
  return (
    <nav aria-label="Time window" className="inline-flex overflow-hidden rounded-md border border-line">
      {AWS_TIMELINE_WINDOWS.map((w) => (
        <Link
          key={w.hours}
          href={hrefFor(w.hours)}
          aria-current={hours === w.hours ? "true" : undefined}
          className={clsx(
            "flex min-h-11 items-center px-3 text-xs font-medium transition-colors sm:min-h-8",
            hours === w.hours ? "bg-surface-2 text-fg" : "text-fg-subtle hover:bg-surface-1 hover:text-fg",
          )}
        >
          {w.label}
        </Link>
      ))}
    </nav>
  );
}

/** View tabs with counts. Active tab has the signal underline. */
export function ActivityTabs({
  tab,
  counts,
  hrefFor,
}: {
  tab: AwsTimelineTab;
  counts: Record<AwsTimelineTab, number>;
  hrefFor: (tab: AwsTimelineTab) => string;
}) {
  return (
    <nav aria-label="Activity views" className="flex gap-1 overflow-x-auto border-b border-line-soft text-sm">
      {AWS_TIMELINE_TABS.map((t) => (
        <Link
          key={t.id}
          href={hrefFor(t.id)}
          aria-current={tab === t.id ? "page" : undefined}
          className={clsx(
            "-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 transition-colors sm:min-h-9",
            tab === t.id ? "border-signal text-fg" : "border-transparent text-fg-subtle hover:text-fg",
          )}
        >
          {t.label}
          <span className="font-mono text-xs text-fg-subtle">{counts[t.id]}</span>
        </Link>
      ))}
    </nav>
  );
}
