"use client";

import clsx from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Download } from "lucide-react";
import type { EventEnvelope } from "@/lib/types";
import { eventsToCsv, groupByDay } from "@/lib/aws-timeline-view";
import { Button } from "@/components/ui/Button";
import { Subsection } from "@/components/layout/Subsection";
import { EventLink } from "./EventPeek";
import { IpCell } from "./IpCell";
import { severityBorderBg } from "./SeverityBadge";

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

const OPEN_DAYS = 3;

/** One collapsible block per day, newest first. Each line: time, action, target, IP. */
export function UserTimeline({ events }: { events: EventEnvelope[] }) {
  const days = groupByDay(events);
  return (
    <div className="flex flex-col gap-3">
      {days.map((day, index) => (
        <Subsection
          key={day.day}
          id={`day-${day.day}`}
          title={day.day}
          count={day.events.length}
          defaultOpen={index < OPEN_DAYS}
        >
          <ul className="flex flex-col divide-y divide-line-soft rounded-md border border-line-soft bg-surface-1">
            {day.events.map((e) => {
              const when = new Date(e.event_time);
              const ip = (e.actor as { source_ip?: string } | undefined)?.source_ip;
              const target = e.target?.id ?? e.target?.name;
              const failed = e.outcome !== undefined && e.outcome !== "success";
              return (
                <li
                  key={e.event_id}
                  className="relative grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-3 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,14rem)_8rem]"
                >
                  <span
                    aria-hidden
                    className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(e.severity as string | null))}
                  />
                  <time
                    dateTime={e.event_time}
                    title={`${format(when, "yyyy-MM-dd HH:mm:ss")} · ${formatDistanceToNowStrict(when, { addSuffix: true })}`}
                    className="font-mono text-xs text-fg-muted"
                  >
                    {format(when, "HH:mm:ss")}
                  </time>
                  <span className="min-w-0 break-all">
                    <EventLink eventId={e.event_id} className="font-mono text-xs text-fg transition-colors hover:text-signal">
                      {e.action}
                    </EventLink>
                    {failed && <span className="ml-2 text-xs text-sev-critical">failed</span>}
                  </span>
                  <span className="col-start-2 min-w-0 break-all text-xs text-fg-muted sm:col-start-auto">{target ? String(target) : ""}</span>
                  <span className="col-start-2 text-xs sm:col-start-auto sm:text-right">
                    <IpCell value={ip ?? null} className="text-xs text-fg-subtle" />
                  </span>
                </li>
              );
            })}
          </ul>
        </Subsection>
      ))}
    </div>
  );
}
