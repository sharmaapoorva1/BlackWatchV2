"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { Download } from "lucide-react";
import type { EventEnvelope } from "@/lib/types";
import {
  collapseRuns,
  dayCells,
  eventsToCsv,
  isFailed,
  isFlagged,
  type TimelineRun,
} from "@/lib/aws-timeline-view";
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

const PAGE_RUNS = 60;

// Severity is accent only: a dot on the rail. No severity gets a hollow grey dot.
const DOT: Record<string, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  informational: "bg-sev-low",
};

const localDay = (event: EventEnvelope) => format(new Date(event.event_time), "yyyy-MM-dd");

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE d MMM yyyy");
}

// One row of the rail: time on the left, the line and dot in the middle, the
// content on the right. Each row draws its own slice of the line, so the line
// is continuous from the first row to the last.
const ROW = "grid grid-cols-[4rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)]";
const RAIL = "relative before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-line";

/** The big picture: one cell per day, darker means busier. Click a day to jump to it. */
function DayStrip({ cells, onJump }: { cells: ReturnType<typeof dayCells>; onJump: (day: string) => void }) {
  const max = Math.max(1, ...cells.map((c) => c.count));
  const shade = (count: number) => {
    if (count === 0) return "bg-surface-2";
    const r = count / max;
    return r > 0.75 ? "bg-signal/80" : r > 0.5 ? "bg-signal/55" : r > 0.25 ? "bg-signal/35" : "bg-signal/20";
  };
  return (
    <div>
      <div className="flex gap-1" role="list" aria-label="Activity by day">
        {cells.map((c) => {
          const label = `${format(new Date(`${c.day}T12:00:00`), "EEE d MMM")}: ${c.count} event${c.count === 1 ? "" : "s"}${c.flagged ? `, ${c.flagged} flagged` : ""}`;
          const cls = clsx(
            "h-7 min-w-2 flex-1 rounded-sm",
            shade(c.count),
            c.flagged > 0 && "border-b-2 border-sev-high",
          );
          return c.count > 0 ? (
            <button key={c.day} type="button" role="listitem" title={label} aria-label={label} onClick={() => onJump(c.day)} className={clsx(cls, "cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70")} />
          ) : (
            <span key={c.day} role="listitem" title={label} aria-label={label} className={cls} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-fg-subtle">
        <span>{format(new Date(`${cells[0].day}T12:00:00`), "d MMM")}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function RunRow({ run, open, onToggle }: { run: TimelineRun; open: boolean; onToggle: () => void }) {
  const newest = run.events[0];
  const oldest = run.events[run.events.length - 1];
  const when = new Date(newest.event_time);
  const ip = (newest.actor as { source_ip?: string } | undefined)?.source_ip;
  const target = newest.target?.id ?? newest.target?.name;
  const failed = isFailed(newest);
  const dot = DOT[(newest.severity as string) ?? ""];
  const count = run.events.length;
  const spanDays = format(new Date(oldest.event_time), "yyyy-MM-dd") !== format(when, "yyyy-MM-dd");
  return (
    <li className={ROW}>
      <time
        dateTime={newest.event_time}
        title={`${format(when, "yyyy-MM-dd HH:mm:ss")} · ${formatDistanceToNowStrict(when, { addSuffix: true })}`}
        className="pt-1.5 text-right font-mono text-xs text-fg-muted"
      >
        {format(when, "HH:mm:ss")}
      </time>
      <span className={clsx(RAIL, "block")}>
        <span
          aria-hidden
          className={clsx(
            "absolute left-1/2 top-[0.6rem] h-2 w-2 -translate-x-1/2 rounded-full",
            dot ?? "border border-fg-subtle bg-canvas",
          )}
        />
      </span>
      <div className="min-w-0 py-1 pr-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <EventLink eventId={newest.event_id} className="break-all font-mono text-xs text-fg transition-colors hover:text-signal">
            {newest.action}
          </EventLink>
          {count > 1 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="cursor-pointer rounded border border-line-soft bg-surface-1 px-1.5 font-mono text-xs text-fg-muted transition-colors hover:border-signal hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              ×{count}
            </button>
          )}
          {failed && <span className="text-xs text-sev-critical">failed</span>}
          {newest.severity ? <span className="text-xs text-fg-subtle">{String(newest.severity)}</span> : null}
          {target && <span className="break-all text-xs text-fg-muted">{String(target)}</span>}
          {ip && <IpCell value={ip} className="text-xs text-fg-subtle" />}
          {count > 1 && !open && (
            <span className="text-xs text-fg-subtle">since {format(new Date(oldest.event_time), spanDays ? "d MMM HH:mm" : "HH:mm")}</span>
          )}
        </div>
        {count > 1 && open && (
          <ul className="mt-1 flex flex-col gap-0.5 border-l border-line-soft pl-3">
            {run.events.map((e) => {
              const t = new Date(e.event_time);
              return (
                <li key={e.event_id} className="text-xs">
                  <EventLink eventId={e.event_id} className="font-mono text-fg-muted transition-colors hover:text-signal">
                    {format(t, "d MMM HH:mm:ss")}
                  </EventLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * A real timeline, kept short: identical neighbouring events fold into one
 * row with a count, an overview strip shows the busy days, and "Flagged" hides
 * routine events. Order is never rearranged, so the sequence stays honest.
 */
export function UserTimeline({ events, hours }: { events: EventEnvelope[]; hours: number }) {
  const [view, setView] = useState<"all" | "flagged">("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE_RUNS);

  const flaggedCount = useMemo(() => events.filter(isFlagged).length, [events]);
  const filtered = useMemo(() => (view === "flagged" ? events.filter(isFlagged) : events), [events, view]);
  const runs = useMemo(() => collapseRuns(filtered), [filtered]);
  const shown = runs.slice(0, visible);
  const cells = useMemo(() => dayCells(filtered, Math.max(1, Math.round(hours / 24)), localDay), [filtered, hours]);

  const days: { day: string; runs: TimelineRun[] }[] = [];
  for (const run of shown) {
    const day = localDay(run.events[0]);
    const last = days[days.length - 1];
    if (last && last.day === day) last.runs.push(run);
    else days.push({ day, runs: [run] });
  }

  function jump(day: string) {
    const index = runs.findIndex((r) => localDay(r.events[0]) === day);
    if (index >= visible) setVisible(index + PAGE_RUNS);
    window.setTimeout(() => document.getElementById(`day-${day}`)?.scrollIntoView({ block: "start" }), 0);
  }

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {hours >= 168 && (
          <div className="min-w-[12rem] flex-1" style={{ maxWidth: `${Math.min(cells.length * 2.25, 36)}rem` }}>
            <DayStrip cells={cells} onJump={jump} />
          </div>
        )}
        <div role="group" aria-label="Which events to show" className="inline-flex overflow-hidden rounded-md border border-line">
          {(
            [
              ["all", `All ${events.length}`],
              ["flagged", `Flagged ${flaggedCount}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => {
                setView(id);
                setVisible(PAGE_RUNS);
              }}
              className={clsx(
                "flex min-h-11 cursor-pointer items-center px-3 text-xs font-medium transition-colors sm:min-h-8",
                view === id ? "bg-surface-2 text-fg" : "text-fg-subtle hover:bg-surface-1 hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-fg-muted">Nothing flagged. Every event here was routine.</p>
      ) : (
        <ol className="flex flex-col">
          {days.map((day) => (
            <li key={day.day} className="list-none">
              <h3
                id={`day-${day.day}`}
                className={clsx(ROW, "scroll-mt-[calc(var(--sticky-header-h,0px)+1rem)] items-center pt-3 first:pt-0")}
              >
                <span />
                <span className={clsx(RAIL, "flex h-6 items-center justify-center")}>
                  <span aria-hidden className="relative h-3 w-3 rounded-full border-2 border-signal bg-canvas" />
                </span>
                <span className="text-sm font-semibold text-fg">
                  {dayLabel(day.runs[0].events[0].event_time)}
                  <span className="ml-2 text-xs font-normal text-fg-subtle">
                    {day.runs.reduce((n, r) => n + r.events.length, 0)} events
                  </span>
                </span>
              </h3>
              <ol className="flex flex-col">
                {day.runs.map((run) => (
                  <RunRow key={run.key} run={run} open={open.has(run.key)} onToggle={() => toggle(run.key)} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {runs.length > visible && (
        <div className="flex items-center gap-3 pl-[5.5rem] sm:pl-[6rem]">
          <Button type="button" variant="secondary" size="sm" onClick={() => setVisible((n) => n + PAGE_RUNS)}>
            Show older
          </Button>
          <span className="text-xs text-fg-subtle">
            {visible} of {runs.length} rows
          </span>
        </div>
      )}
    </div>
  );
}
