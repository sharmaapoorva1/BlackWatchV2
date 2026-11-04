"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Investigation } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { TimestampCell } from "@/components/domain/TimestampCell";

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function InvestigationList({ investigations }: { investigations: Investigation[] }) {
  const columns = useMemo<ColumnDef<Investigation, unknown>[]>(
    () => [
      {
        id: "investigation",
        header: "Investigation",
        accessorFn: (item) => item.title,
        enableHiding: false,
        meta: { label: "Investigation" },
        cell: ({ row }) => (
          <>
            <Link
              href={`/investigations/${row.original.id}`}
              className="font-medium text-fg hover:text-signal hover:underline"
            >
              {row.original.title}
            </Link>
            <div className="mt-1 break-all font-mono text-xs text-fg-subtle">{row.original.id}</div>
          </>
        ),
      },
      {
        id: "observable",
        header: "Observable",
        accessorFn: (item) => item.observables.join(", "),
        meta: { label: "Observable", className: "break-all font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.observables.join(", ") || "—",
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (item) => item.status,
        meta: { label: "Status", className: "text-xs" },
        cell: ({ row }) => formatStatus(row.original.status),
      },
      {
        id: "priority",
        header: "Priority",
        accessorFn: (item) => PRIORITY_RANK[item.priority] ?? 0,
        sortDescFirst: true,
        meta: { label: "Priority", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.priority,
      },
      {
        id: "results",
        header: "Results",
        accessorFn: (item) => item.result_count,
        sortDescFirst: true,
        meta: { label: "Results", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.result_count,
      },
      {
        id: "updated",
        header: "Updated",
        accessorFn: (item) => Date.parse(item.updated_at) || 0,
        sortDescFirst: true,
        meta: { label: "Updated", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.updated_at} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="investigations-list-v2"
      ariaLabel="Investigations"
      columns={columns}
      data={investigations}
      getRowId={(item) => item.id}
      initialSorting={[{ id: "updated", desc: true }]}
      emptyMessage="No investigations yet."
    />
  );
}

export function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}
