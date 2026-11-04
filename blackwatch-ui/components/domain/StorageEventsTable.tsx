"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { StorageCriticalEvent, StorageS3SecurityEvent } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

type StorageRow = StorageCriticalEvent & Partial<StorageS3SecurityEvent>;

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

function rowId(event: StorageRow, index: number): string {
  return event.event_id ?? `${event.action}-${event.event_time}-${index}`;
}

/**
 * Storage event tables. `critical` is the recent-critical list (shows the
 * domain); `s3` is the S3 security activity (shows the grouped signal).
 */
export function StorageEventsTable({
  events,
  variant,
}: {
  events: StorageRow[];
  variant: "critical" | "s3";
}) {
  const columns = useMemo<ColumnDef<StorageRow, unknown>[]>(
    () => [
      {
        id: "event",
        header: "Event",
        accessorFn: (e) => e.message ?? e.action,
        enableHiding: false,
        meta: { label: "Event", className: "relative min-w-48" },
        cell: ({ row }) => {
          const event = row.original;
          return (
            <>
              <span
                aria-hidden
                className={`pointer-events-none absolute left-0 top-0 h-full w-0.5 ${severityBorderBg(event.severity)}`}
              />
              <div className="min-w-0 break-words text-xs text-fg">{event.message ?? event.action}</div>
              {event.message && <div className="mt-0.5 font-mono text-xs text-fg-subtle">{event.action}</div>}
            </>
          );
        },
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (e) => SEVERITY_RANK[String(e.severity)] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      variant === "s3"
        ? {
            id: "signal",
            header: "Signal",
            accessorFn: (e) => e.signal ?? e.action,
            meta: { label: "Signal", className: "text-xs text-fg-muted" },
            cell: ({ row }) => {
              const event = row.original;
              const count = event.count ?? 1;
              return (
                <>
                  <span className="font-medium text-fg">{event.signal ?? event.action}</span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {count > 1 ? `${count} grouped accesses` : "1 access"}
                  </span>
                </>
              );
            },
          }
        : {
            id: "domain",
            header: "Domain",
            accessorFn: (e) => e.group ?? "",
            meta: { label: "Domain", className: "font-mono text-xs text-fg-muted" },
            cell: ({ row }) => row.original.group,
          },
      {
        id: "target",
        header: variant === "s3" ? "Bucket / object" : "Target",
        accessorFn: (e) => e.target_id ?? "",
        meta: { label: variant === "s3" ? "Bucket / object" : "Target", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => (
          <div className="max-w-[22rem] break-words" title={row.original.target_id ?? undefined}>
            {row.original.target_id ?? "—"}
          </div>
        ),
      },
      {
        id: "principal",
        header: variant === "s3" ? "Requester / evidence" : "Principal",
        accessorFn: (e) => e.principal ?? (e.source_ips ?? (e.source_ip ? [e.source_ip] : [])).join(", "),
        meta: { label: variant === "s3" ? "Requester / evidence" : "Principal", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => {
          const event = row.original;
          const sourceIps = event.source_ips ?? (event.source_ip ? [event.source_ip] : []);
          return (
            <>
              {event.principal ? (
                <div className="break-words" title={event.principal}>
                  {event.principal}
                </div>
              ) : sourceIps.length ? (
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
                  {sourceIps.map((ip) => (
                    <IpCell key={ip} value={ip} className="text-xs text-fg-muted" />
                  ))}
                </div>
              ) : (
                <span>—</span>
              )}
              {event.reason && (
                <div className="mt-1 max-w-[20rem] font-sans text-xs leading-relaxed text-fg-subtle">{event.reason}</div>
              )}
            </>
          );
        },
      },
      {
        id: "when",
        header: "When",
        accessorFn: (e) => (e.event_time ? Date.parse(e.event_time) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "When", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.event_time ? <TimestampCell value={row.original.event_time} /> : <span className="text-fg-disabled">—</span>,
      },
      {
        id: "open",
        header: "Details",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Details", isActions: true },
        cell: ({ row }) =>
          row.original.event_id ? (
            <Link href={`/events/${row.original.event_id}`} className="text-xs text-signal hover:underline">
              open
            </Link>
          ) : null,
      },
    ],
    [variant],
  );

  return (
    <DataTable
      tableId={variant === "s3" ? "storage-s3-security-v2" : "storage-critical-v2"}
      ariaLabel={variant === "s3" ? "S3 security activity" : "Recent critical storage events"}
      columns={columns}
      data={events}
      getRowId={rowId}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}
