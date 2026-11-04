"use client";

import { useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatEpoch } from "@/lib/ueba-rows";

export interface BaselineRow {
  principal_type: string;
  principal_id: string;
  dimension: string;
  value: string;
  first_seen: number;
  last_seen: number;
  count: number;
}

export function BaselineTable({ rows }: { rows: BaselineRow[] }) {
  const columns = useMemo<ColumnDef<BaselineRow, unknown>[]>(
    () => [
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.principal_type,
        meta: { label: "Type", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.principal_type,
      },
      {
        id: "principal",
        header: "Principal",
        accessorFn: (row) => row.principal_id,
        meta: { label: "Principal" },
        cell: ({ row }) => row.original.principal_id,
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
        header: "Value",
        accessorFn: (row) => row.value,
        meta: { label: "Value", className: "break-all font-mono text-xs" },
        cell: ({ row }) => row.original.value,
      },
      {
        id: "count",
        header: "Count",
        accessorFn: (row) => row.count,
        sortDescFirst: true,
        meta: { label: "Count", className: "text-right tabular-nums", headerClassName: "text-right" },
        cell: ({ row }) => row.original.count,
      },
      {
        id: "first_seen",
        header: "First seen",
        accessorFn: (row) => row.first_seen,
        sortDescFirst: true,
        meta: { label: "First seen", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => formatEpoch(row.original.first_seen),
      },
      {
        id: "last_seen",
        header: "Last seen",
        accessorFn: (row) => row.last_seen,
        sortDescFirst: true,
        meta: { label: "Last seen", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => formatEpoch(row.original.last_seen),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="ueba-baselines-v2"
      ariaLabel="UEBA baselines"
      columns={columns}
      data={rows}
      getRowId={(row) => `${row.principal_type}|${row.principal_id}|${row.dimension}|${row.value}`}
      emptyMessage="No baseline rows."
    />
  );
}
