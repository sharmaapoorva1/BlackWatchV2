"use client";

import { useMemo } from "react";
import type { NotificationLogEntry } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Severity } from "@/components/ui/StatusDot";
import { TimestampCell } from "./TimestampCell";
import { SeverityBadge } from "./SeverityBadge";
import { EventLink } from "./EventPeek";

const STATUS_SEVERITY: Record<string, Severity> = {
  sent: "resolved",
  failed: "critical",
  rate_limited: "medium",
  throttled: "medium",
  digested: "low",
  acked: "neutral",
};

/**
 * One table for both notification-log views: `full` (the log page) adds the
 * retry count and the message preview/error; `compact` (the notifications
 * landing page) shows only who/what/when.
 */
export function NotificationLogTable({
  entries,
  variant = "full",
  tableId,
  ariaLabel,
}: {
  entries: NotificationLogEntry[];
  variant?: "full" | "compact";
  tableId: string;
  ariaLabel: string;
}) {
  const columns = useMemo<ColumnDef<NotificationLogEntry, unknown>[]>(() => {
    const base: ColumnDef<NotificationLogEntry, unknown>[] = [
      {
        id: "time",
        header: "Time",
        accessorFn: (entry) => Date.parse(entry.ts) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.ts} />,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (entry) => entry.status,
        meta: { label: "Status" },
        cell: ({ row }) => (
          <StatusPill label={row.original.status} severity={STATUS_SEVERITY[row.original.status] ?? "neutral"} />
        ),
      },
      {
        id: "channel",
        header: "Channel",
        accessorFn: (entry) => entry.channel_name ?? "",
        meta: { label: "Channel", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.channel_name ?? "—",
      },
      {
        id: "rule",
        header: "Rule",
        accessorFn: (entry) => entry.rule_name ?? "",
        meta: { label: "Rule", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.rule_name ?? "—",
      },
      {
        id: "event",
        header: "Event",
        accessorFn: (entry) => entry.event_action ?? "",
        meta: { label: "Event" },
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex flex-wrap items-center gap-2">
              {entry.event_id ? (
                <EventLink
                  eventId={entry.event_id}
                  className="font-mono text-xs text-fg transition-colors hover:text-signal"
                >
                  {entry.event_action ?? "—"}
                </EventLink>
              ) : (
                <code className="font-mono text-xs text-fg-muted">{entry.event_action ?? "—"}</code>
              )}
              {entry.event_severity && <SeverityBadge severity={entry.event_severity} />}
            </div>
          );
        },
      },
    ];
    if (variant === "compact") return base;
    return [
      ...base,
      {
        id: "retries",
        header: "Retries",
        accessorFn: (entry) => entry.retries_used,
        meta: { label: "Retries", className: "text-right font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.retries_used,
      },
      {
        id: "preview",
        header: "Preview / error",
        accessorFn: (entry) => entry.error_message ?? entry.body_preview ?? "",
        meta: { label: "Preview / error", className: "max-w-md break-words font-mono text-xs text-fg-subtle" },
        cell: ({ row }) => row.original.error_message ?? row.original.body_preview ?? "",
      },
    ];
  }, [variant]);

  return (
    <DataTable
      tableId={tableId}
      ariaLabel={ariaLabel}
      columns={columns}
      data={entries}
      getRowId={(entry) => String(entry.id)}
      initialSorting={[{ id: "time", desc: true }]}
      emptyMessage="Nothing has fired yet."
    />
  );
}
