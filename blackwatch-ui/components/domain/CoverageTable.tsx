"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CoverageRow, CoverageStatus } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimestampCell } from "./TimestampCell";

function statusSeverity(status: CoverageStatus): "critical" | "high" | "resolved" | "neutral" {
  if (status === "failing") return "critical";
  if (status === "stale" || status === "unverified") return "high";
  if (status === "healthy") return "resolved";
  return "neutral";
}

export function CoverageTable({ rows }: { rows: CoverageRow[] }) {
  const columns = useMemo<ColumnDef<CoverageRow, unknown>[]>(
    () => [
      {
        id: "source",
        header: "Source",
        accessorFn: (row) => row.source,
        enableHiding: false,
        meta: { label: "Source", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.source,
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (row) => row.module,
        meta: { label: "Module" },
        cell: ({ row }) => (
          <Link href={row.original.module_href} className="text-sm text-signal hover:underline">
            {row.original.module}
          </Link>
        ),
      },
      {
        id: "connector",
        header: "Connector",
        accessorFn: (row) => row.connector_name,
        meta: { label: "Connector", className: "text-sm text-fg" },
        cell: ({ row }) => row.original.connector_name,
      },
      {
        id: "last_seen",
        header: "Last seen",
        accessorFn: (row) => (row.last_seen_event ? Date.parse(row.last_seen_event) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last seen", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.last_seen_event ? (
            <TimestampCell value={row.original.last_seen_event} />
          ) : (
            <span className="font-mono text-xs text-fg-disabled">never</span>
          ),
      },
      {
        id: "verification",
        header: "Verification",
        accessorFn: (row) => (row.verified ? 1 : 0),
        meta: { label: "Verification" },
        cell: ({ row }) => (
          <StatusPill
            severity={row.original.verified ? "resolved" : "neutral"}
            label={row.original.verified ? "verified" : "not tested"}
          />
        ),
      },
      {
        id: "state",
        header: "State",
        accessorFn: (row) => row.status,
        meta: { label: "State" },
        cell: ({ row }) => (
          <StatusPill
            severity={statusSeverity(row.original.status)}
            label={row.original.status}
            title={row.original.reason}
          />
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="coverage-list-v2"
      ariaLabel="Source coverage"
      columns={columns}
      data={rows}
      getRowId={(row) => row.connector_id}
    />
  );
}
