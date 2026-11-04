"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { EventTableRow } from "@/lib/event-summary";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { TimestampCell } from "./TimestampCell";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { EventActionCell } from "./EventActionCell";

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

function severityOf(event: EventTableRow): string | null {
  return event.severity;
}

/** The Events page table: TanStack-backed, sortable, resizable, with a
 *  Columns menu. Columns live here (not in the server page) because cell
 *  renderers are functions and cannot cross the server/client boundary. */
export function EventsDataTable({ events }: { events: EventTableRow[] }) {
  const columns = useMemo<ColumnDef<EventTableRow, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (event) => Date.parse(event.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "relative whitespace-nowrap" },
        cell: ({ row }) => (
          <>
            {/* 2px severity left-border indicator, never a background fill */}
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute left-0 top-0 h-full w-0.5",
                severityBorderBg(severityOf(row.original)),
              )}
            />
            <TimestampCell value={row.original.event_time} />
          </>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (event) => SEVERITY_RANK[severityOf(event) ?? ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => <SeverityBadge severity={severityOf(row.original)} />,
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (event) => event.module,
        meta: { label: "Module", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.module || "—",
      },
      {
        id: "event",
        header: "Event",
        accessorFn: (event) => event.action,
        meta: { label: "Event" },
        cell: ({ row }) => <EventActionCell eventId={row.original.event_id} action={row.original.action} />,
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (event) => event.actor,
        meta: { label: "Actor", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.actor || "—",
      },
      {
        id: "target",
        header: "Target",
        accessorFn: (event) => event.target,
        meta: { label: "Target", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.target,
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        meta: { label: "Tags" },
        cell: ({ row }) => {
          const entries = row.original.tags;
          if (entries.length === 0) return <span className="text-xs text-fg-disabled">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {entries.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex max-w-full rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted"
                  title={`${key}: ${value}`}
                >
                  {key}={value}
                </span>
              ))}
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="events-feed"
      ariaLabel="Events"
      columns={columns}
      data={events}
      getRowId={(event) => event.event_id}
      initialSorting={[{ id: "time", desc: true }]}
      emptyMessage="No events match the current filters."
    />
  );
}
