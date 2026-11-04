"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { UebaAnomalyTableRow } from "@/lib/ueba-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { TimestampCell } from "./TimestampCell";

export function UebaAnomalyTable({ rows }: { rows: UebaAnomalyTableRow[] }) {
  const columns = useMemo<ColumnDef<UebaAnomalyTableRow, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (row) => Date.parse(row.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.event_time} />,
      },
      {
        id: "action",
        header: "Action",
        accessorFn: (row) => row.action,
        meta: { label: "Action", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.action,
      },
      {
        id: "principal",
        header: "Principal",
        accessorFn: (row) => row.principal_id,
        meta: { label: "Principal" },
        cell: ({ row }) => (
          <>
            <span className="text-fg">{row.original.principal_id}</span>
            {row.original.principal_type && (
              <span className="ml-1 text-fg-muted">({row.original.principal_type})</span>
            )}
          </>
        ),
      },
      {
        id: "dimension",
        header: "Dimension",
        accessorFn: (row) => row.dimension,
        meta: { label: "Dimension", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.dimension,
      },
      {
        id: "value",
        header: "New value",
        accessorFn: (row) => row.value,
        meta: { label: "New value", className: "break-all font-mono text-xs" },
        cell: ({ row }) => row.original.value,
      },
      {
        id: "trigger",
        header: "Trigger",
        enableSorting: false,
        meta: { label: "Trigger" },
        cell: ({ row }) =>
          row.original.trigger_event_id ? (
            <Link
              href={`/events/${encodeURIComponent(row.original.trigger_event_id)}`}
              className="text-signal underline-offset-2 hover:underline"
            >
              trigger
            </Link>
          ) : null,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="ueba-anomalies-v2"
      ariaLabel="UEBA first-seen anomalies"
      columns={columns}
      data={rows}
      getRowId={(row) => row.event_id}
      initialSorting={[{ id: "time", desc: true }]}
      emptyMessage="No first-seen anomalies yet."
    />
  );
}
