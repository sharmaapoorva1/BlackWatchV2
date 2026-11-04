"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { HostActivityRow } from "@/lib/host-activity";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";
import { EventActionCell } from "./EventActionCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

function OutcomePill({ outcome }: { outcome: string | null }) {
  const success = outcome === "success";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs", success ? "text-fg-muted" : "text-sev-critical")}>
      <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", success ? "bg-sev-resolved" : "bg-sev-critical")} />
      {success ? "success" : outcome?.replaceAll("_", " ") ?? "unknown"}
    </span>
  );
}

/** SSH/sudo access and host configuration changes, merged and newest first. */
export function HostActivityDataTable({ rows }: { rows: HostActivityRow[] }) {
  const columns = useMemo<ColumnDef<HostActivityRow, unknown>[]>(
    () => [
      {
        id: "when",
        header: "When",
        accessorFn: (row) => Date.parse(row.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "When", className: "relative whitespace-nowrap" },
        cell: ({ row }) => (
          <>
            {row.original.kind !== "Access" && (
              <span
                aria-hidden
                className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(row.original.severity))}
              />
            )}
            <TimestampCell value={row.original.event_time} />
          </>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.kind,
        meta: { label: "Type", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.kind,
      },
      {
        id: "result",
        header: "Result",
        accessorFn: (row) =>
          row.kind === "Access" ? (row.outcome === "success" ? 0 : 1) : (SEVERITY_RANK[row.severity ?? ""] ?? 0),
        meta: { label: "Result" },
        cell: ({ row }) =>
          row.original.kind === "Access" ? (
            <OutcomePill outcome={row.original.outcome} />
          ) : (
            <SeverityBadge severity={row.original.severity} />
          ),
      },
      {
        id: "host",
        header: "Host",
        accessorFn: (row) => row.host_label,
        meta: { label: "Host", className: "text-xs text-fg-muted" },
        cell: ({ row }) =>
          row.original.host_id ? (
            <Link href={`/hosts/${row.original.host_id}`} className="hover:text-signal">
              {row.original.host_label}
            </Link>
          ) : (
            row.original.host_label
          ),
      },
      {
        id: "activity",
        header: "Activity",
        accessorFn: (row) => row.action,
        meta: { label: "Activity", className: "min-w-56" },
        cell: ({ row }) => <EventActionCell eventId={row.original.event_id} action={row.original.action} />,
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        meta: { label: "Details", className: "min-w-44 max-w-64 break-words text-xs text-fg-muted" },
        cell: ({ row }) =>
          row.original.kind === "Access" ? (
            <span>
              {row.original.principal ?? "unknown user"}
              {row.original.source_ip ? (
                <>
                  {" · "}
                  <IpCell value={row.original.source_ip} className="text-xs text-fg-muted" />
                </>
              ) : (
                ""
              )}
            </span>
          ) : (
            row.original.detail
          ),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="host-fleet-activity"
      ariaLabel="Recent host access and configuration activity"
      columns={columns}
      data={rows}
      getRowId={(row) => `${row.kind}:${row.event_id}`}
      initialSorting={[{ id: "when", desc: true }]}
      emptyMessage="No host access or configuration activity recorded yet."
    />
  );
}
