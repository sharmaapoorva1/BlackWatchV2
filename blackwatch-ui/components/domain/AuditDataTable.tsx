"use client";

import { useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { TimestampCell } from "./TimestampCell";

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string | null;
  actor_role: string | null;
  ip: string | null;
  method: string;
  path: string;
  status: number;
  body_summary: string | null;
}

function statusClass(status: number): string {
  if (status >= 500) return "text-sev-critical";
  if (status >= 400) return "text-sev-medium";
  return "text-fg-muted";
}

/** The append-only audit log: newest first, sortable, filtered server-side. */
export function AuditDataTable({ rows }: { rows: AuditEntry[] }) {
  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (row) => Date.parse(row.ts) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.ts} />,
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (row) => row.actor ?? "",
        meta: { label: "Actor" },
        cell: ({ row }) => row.original.actor ?? "—",
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (row) => row.actor_role ?? "",
        meta: { label: "Role", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.actor_role ?? "—",
      },
      {
        id: "ip",
        header: "IP",
        accessorFn: (row) => row.ip ?? "",
        meta: { label: "IP", className: "font-mono text-xs" },
        cell: ({ row }) => <IpCell value={row.original.ip} className="text-xs" />,
      },
      {
        id: "method",
        header: "Method",
        accessorFn: (row) => row.method,
        meta: { label: "Method", className: "font-mono text-xs" },
        cell: ({ row }) => row.original.method,
      },
      {
        id: "path",
        header: "Path",
        accessorFn: (row) => row.path,
        meta: { label: "Path", className: "break-all font-mono text-xs" },
        cell: ({ row }) => row.original.path,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        meta: { label: "Status" },
        cell: ({ row }) => (
          <span className={`font-mono text-xs ${statusClass(row.original.status)}`}>{row.original.status}</span>
        ),
      },
      {
        id: "body",
        header: "Body",
        enableSorting: false,
        meta: { label: "Body", className: "max-w-[36rem] break-words font-mono text-xs text-fg-subtle" },
        cell: ({ row }) => row.original.body_summary ?? "",
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="audit-log"
      ariaLabel="Audit log"
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      initialSorting={[{ id: "time", desc: true }]}
      emptyMessage="No audit rows (or not authorized)."
    />
  );
}
