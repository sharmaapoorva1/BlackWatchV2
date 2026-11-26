"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { AwsActivityRow } from "@/lib/aws-timeline-view";
import { userTimelineHref } from "@/lib/aws-timeline-view";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { EventLink } from "./EventPeek";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

/** Who did what, when. Click a user for their history, an action for the event. */
export function AwsActivityTable({ rows, hours, tableId }: { rows: AwsActivityRow[]; hours: number; tableId: string }) {
  const columns = useMemo<ColumnDef<AwsActivityRow, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Date.parse(r.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "relative whitespace-nowrap" },
        cell: ({ row }) => (
          <>
            <span
              aria-hidden
              className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(row.original.severity))}
            />
            <TimestampCell value={row.original.event_time} />
          </>
        ),
      },
      {
        id: "user",
        header: "User",
        accessorFn: (r) => r.principal ?? "",
        enableHiding: false,
        meta: { label: "User", className: "break-all text-xs" },
        cell: ({ row }) =>
          row.original.principal ? (
            <Link
              href={userTimelineHref(row.original.principal, hours)}
              className="text-fg underline-offset-2 hover:text-signal hover:underline"
            >
              {row.original.principal}
            </Link>
          ) : (
            <span className="text-fg-disabled">—</span>
          ),
      },
      {
        id: "action",
        header: "Action",
        accessorFn: (r) => r.action,
        enableHiding: false,
        meta: { label: "Action", className: "break-all" },
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <EventLink eventId={row.original.event_id} className="font-mono text-xs text-fg transition-colors hover:text-signal">
              {row.original.action}
            </EventLink>
            {row.original.failed && <span className="text-xs text-sev-critical">failed</span>}
          </span>
        ),
      },
      {
        id: "target",
        header: "Target",
        accessorFn: (r) => r.target ?? "",
        meta: { label: "Target", className: "break-all text-xs text-fg-muted" },
        cell: ({ row }) => row.original.target ?? <span className="text-fg-disabled">—</span>,
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (r) => SEVERITY_RANK[r.severity ?? ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        id: "ip",
        header: "Source IP",
        accessorFn: (r) => r.source_ip ?? "",
        meta: { label: "Source IP", className: "text-xs" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} className="text-xs text-fg-muted" />,
      },
    ],
    [hours],
  );

  return (
    <DataTable
      tableId={tableId}
      ariaLabel="AWS activity"
      columns={columns}
      data={rows}
      getRowId={(r) => r.event_id}
      initialSorting={[{ id: "time", desc: true }]}
      emptyMessage="No activity."
    />
  );
}
