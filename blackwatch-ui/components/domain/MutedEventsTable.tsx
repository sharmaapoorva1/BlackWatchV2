"use client";

import { useMemo } from "react";
import type { MutedEvent } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
// Server actions are imported where they are used (see ActionForm).
import { unmuteAction } from "@/app/rules/actions";

/** `null` means the mute matches any value, which is different from a literal
 *  empty string (the API rejects those), so show it as an explicit "any". */
function FilterValue({ value }: { value: string | null }) {
  return value === null ? <span className="text-fg-disabled">any</span> : <>{value}</>;
}

export function MutedEventsTable({ muted }: { muted: MutedEvent[] }) {
  const columns = useMemo<ColumnDef<MutedEvent, unknown>[]>(
    () => [
      {
        id: "action",
        header: "Action",
        accessorFn: (m) => m.action,
        enableHiding: false,
        meta: { label: "Action", className: "font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.action,
      },
      {
        id: "source_type",
        header: "Source type",
        accessorFn: (m) => m.source_type ?? "",
        meta: { label: "Source type", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <FilterValue value={row.original.source_type} />,
      },
      {
        id: "username",
        header: "Username",
        accessorFn: (m) => m.username ?? "",
        meta: { label: "Username", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <FilterValue value={row.original.username} />,
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (m) => m.reason ?? "",
        meta: { label: "Reason", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <FilterValue value={row.original.reason} />,
      },
      {
        id: "note",
        header: "Note",
        accessorFn: (m) => m.note ?? "",
        meta: { label: "Note", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.note ?? <span className="text-fg-disabled">—</span>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => (
          <ActionForm action={unmuteAction} fields={{ id: String(row.original.id) }} variant="ghost">
            Unmute
          </ActionForm>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="muted-events-v2"
      ariaLabel="Muted events"
      columns={columns}
      data={muted}
      getRowId={(m) => String(m.id)}
    />
  );
}
