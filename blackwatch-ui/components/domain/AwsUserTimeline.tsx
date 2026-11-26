"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { Download } from "lucide-react";
import type { EventEnvelope } from "@/lib/types";
import { eventsToCsv, groupByDay } from "@/lib/aws-timeline-view";
import { Button } from "@/components/ui/Button";
import { EventLink } from "./EventPeek";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";

export function DownloadCsvButton({ events, principal }: { events: EventEnvelope[]; principal: string }) {
  function download() {
    const blob = new Blob([eventsToCsv(events)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safe = principal.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "user";
    link.href = url;
    link.download = `aws-timeline-${safe}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button type="button" variant="secondary" size="sm" onClick={download} disabled={events.length === 0}>
      <Download size={14} aria-hidden /> Download CSV
    </Button>
  );
}

/** Vertical history of one user: days newest first, each event a line with its time. */
export function UserTimeline({ events }: { events: EventEnvelope[] }) {
  const days = groupByDay(events);
  if (days.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day.day} aria-label={day.day}>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-fg-subtle">
            {day.day} · {day.events.length} event{day.events.length === 1 ? "" : "s"}
          </h3>
          <ol className="flex flex-col border-l border-line-soft">
            {day.events.map((e) => {
              const ip = (e.actor as { source_ip?: string } | undefined)?.source_ip;
              const target = e.target?.id ?? e.target?.name;
              const failed = e.outcome !== undefined && e.outcome !== "success";
              return (
                <li key={e.event_id} className="relative flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 pl-4">
                  <span
                    aria-hidden
                    className={clsx("absolute -left-[3px] top-3 h-1.5 w-1.5 rounded-full", severityBorderBg(e.severity as string | null))}
                  />
                  <time dateTime={e.event_time} className="font-mono text-xs text-fg-muted">
                    {format(new Date(e.event_time), "HH:mm:ss")}
                  </time>
                  <EventLink eventId={e.event_id} className="break-all font-mono text-xs text-fg hover:text-signal">
                    {e.action}
                  </EventLink>
                  {failed && <span className="text-xs text-sev-critical">FAILED</span>}
                  <SeverityBadge severity={(e.severity as string | null | undefined) ?? null} />
                  {target && <span className="break-all text-xs text-fg-muted">{String(target)}</span>}
                  {ip && <span className="font-mono text-xs text-fg-subtle">{ip}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
