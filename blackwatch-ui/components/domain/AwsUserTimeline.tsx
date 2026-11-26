"use client";

import { useState } from "react";
import clsx from "clsx";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { Download } from "lucide-react";
import type { EventEnvelope } from "@/lib/types";
import { eventsToCsv, groupByDay } from "@/lib/aws-timeline-view";
import { Button } from "@/components/ui/Button";
import { EventLink } from "./EventPeek";
import { IpCell } from "./IpCell";

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

const PAGE = 100;

// Severity is accent only: a dot on the rail. No severity gets a hollow grey dot.
const DOT: Record<string, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  informational: "bg-sev-low",
};

const localDay = (event: EventEnvelope) => format(new Date(event.event_time), "yyyy-MM-dd");

function dayLabel(first: EventEnvelope): string {
  const date = new Date(first.event_time);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE d MMM yyyy");
}

// One row of the rail: time on the left, the line and dot in the middle, the
// content on the right. Each row draws its own slice of the line, so the line
// is continuous from the first row to the last.
const ROW = "grid grid-cols-[4rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)]";
const RAIL = "relative before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-line";

/** A real timeline: one continuous line, a dot per event, day markers on the line. */
export function UserTimeline({ events }: { events: EventEnvelope[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = [...events].sort((a, b) => Date.parse(b.event_time) - Date.parse(a.event_time)).slice(0, visible);
  const days = groupByDay(shown, localDay);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        {days.map((day) => (
          <li key={day.day} className="list-none">
            <h3 className={clsx(ROW, "items-center pt-4 first:pt-0")}>
              <span />
              <span className={clsx(RAIL, "flex h-6 items-center justify-center")}>
                <span aria-hidden className="relative h-3 w-3 rounded-full border-2 border-signal bg-canvas" />
              </span>
              <span className="text-sm font-semibold text-fg">
                {dayLabel(day.events[0])}
                <span className="ml-2 text-xs font-normal text-fg-subtle">
                  {day.events.length} event{day.events.length === 1 ? "" : "s"}
                </span>
              </span>
            </h3>
            <ol className="flex flex-col">
              {day.events.map((e) => {
                const when = new Date(e.event_time);
                const ip = (e.actor as { source_ip?: string } | undefined)?.source_ip;
                const target = e.target?.id ?? e.target?.name;
                const failed = e.outcome !== undefined && e.outcome !== "success";
                const dot = DOT[(e.severity as string) ?? ""];
                return (
                  <li key={e.event_id} className={clsx(ROW, "group")}>
                    <time
                      dateTime={e.event_time}
                      title={`${format(when, "yyyy-MM-dd HH:mm:ss")} · ${formatDistanceToNowStrict(when, { addSuffix: true })}`}
                      className="pt-2 text-right font-mono text-xs text-fg-muted"
                    >
                      {format(when, "HH:mm:ss")}
                    </time>
                    <span className={clsx(RAIL, "block")}>
                      <span
                        aria-hidden
                        className={clsx(
                          "absolute left-1/2 top-[0.8rem] h-2 w-2 -translate-x-1/2 rounded-full",
                          dot ?? "border border-fg-subtle bg-canvas",
                        )}
                      />
                    </span>
                    <div className="min-w-0 py-1.5 pr-1">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <EventLink eventId={e.event_id} className="break-all font-mono text-xs text-fg transition-colors hover:text-signal">
                          {e.action}
                        </EventLink>
                        {failed && <span className="text-xs text-sev-critical">failed</span>}
                        {e.severity ? <span className="text-xs text-fg-subtle">{String(e.severity)}</span> : null}
                      </div>
                      {(target || ip) && (
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 text-xs text-fg-muted">
                          {target && <span className="break-all">{String(target)}</span>}
                          {ip && <IpCell value={ip} className="text-xs text-fg-subtle" />}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {events.length > visible && (
        <div className="flex items-center gap-3 pl-[5.5rem] sm:pl-[6rem]">
          <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((n) => n + PAGE)}>
            Show {Math.min(PAGE, events.length - visible)} older
          </Button>
          <span className="text-xs text-fg-subtle">
            {visible} of {events.length}
          </span>
        </div>
      )}
    </div>
  );
}
