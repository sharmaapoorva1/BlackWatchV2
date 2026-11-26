"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { AwsTimelineUser } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { SeverityBadge } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

export function AwsTimelineUsersTable({ rows, hours }: { rows: AwsTimelineUser[]; hours: number }) {
  const columns = useMemo<ColumnDef<AwsTimelineUser, unknown>[]>(
    () => [
      {
        id: "user",
        header: "User",
        accessorFn: (r) => r.principal,
        enableHiding: false,
        meta: { label: "User", className: "break-all text-xs" },
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link
              href={`/aws-timeline/user?principal=${encodeURIComponent(row.original.principal)}&hours=${hours}`}
              className="text-fg underline-offset-2 hover:text-signal hover:underline"
            >
              {row.original.principal}
            </Link>
            {row.original.is_root && (
              <span className="inline-flex h-5 items-center rounded-sm border border-sev-critical/40 bg-sev-critical/10 px-1.5 font-mono text-xs text-sev-critical">
                root
              </span>
            )}
          </span>
        ),
      },
      {
        id: "last",
        header: "Last activity",
        accessorFn: (r) => Date.parse(r.last_seen) || 0,
        sortDescFirst: true,
        meta: { label: "Last activity", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.last_seen} />,
      },
      {
        id: "events",
        header: "Events",
        accessorFn: (r) => r.events,
        sortDescFirst: true,
        meta: { label: "Events", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.events.toLocaleString("en-US"),
      },
      {
        id: "failed",
        header: "Failed",
        accessorFn: (r) => r.failed,
        sortDescFirst: true,
        meta: { label: "Failed", className: "font-mono text-xs" },
        cell: ({ row }) =>
          row.original.failed > 0 ? (
            <span className="text-sev-critical">{row.original.failed}</span>
          ) : (
            <span className="text-fg-disabled">0</span>
          ),
      },
      {
        id: "ips",
        header: "Source IPs",
        accessorFn: (r) => r.source_ips,
        sortDescFirst: true,
        meta: { label: "Source IPs", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.source_ips,
      },
      {
        id: "severity",
        header: "Highest severity",
        accessorFn: (r) => SEVERITY_RANK[r.top_severity ?? ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Highest severity" },
        cell: ({ row }) => <SeverityBadge severity={row.original.top_severity} />,
      },
    ],
    [hours],
  );

  return (
    <DataTable
      tableId="aws-timeline-users"
      ariaLabel="AWS users and roles seen in CloudTrail"
      columns={columns}
      data={rows}
      getRowId={(r) => r.principal}
      initialSorting={[{ id: "last", desc: true }]}
      emptyMessage="No users seen in this window."
    />
  );
}
