"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ConnectorTableRow } from "@/lib/connector-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { ConnectorActionButton } from "./ConnectorActionButton";
// Server actions are imported where they are used (see ActionForm).
import { deleteConnectorAction, toggleConnectorAction } from "@/app/connectors/actions";

export function ConnectorsTable({ connectors }: { connectors: ConnectorTableRow[] }) {
  const columns = useMemo<ColumnDef<ConnectorTableRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.name,
        enableHiding: false,
        meta: { label: "Name", className: "text-sm text-fg" },
        cell: ({ row }) => row.original.name,
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.type,
        meta: { label: "Type", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.type,
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        meta: { label: "Details", className: "break-words font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.details,
      },
      {
        id: "verified",
        header: "Verified",
        accessorFn: (row) => (row.verified ? 1 : 0),
        meta: { label: "Verified" },
        cell: ({ row }) => (
          <StatusPill
            severity={row.original.verified ? "resolved" : "neutral"}
            label={row.original.verified ? "verified" : "not tested"}
          />
        ),
      },
      {
        id: "schedule",
        header: "Schedule",
        accessorFn: (row) => (row.enabled ? 1 : 0),
        meta: { label: "Schedule", className: "font-mono text-xs" },
        cell: ({ row }) => (
          <>
            <span className={row.original.enabled ? "text-fg" : "text-fg-subtle"}>
              {row.original.enabled ? "on" : "off"}
            </span>
            <span className="ml-1 text-fg-subtle">· {row.original.interval_seconds}s</span>
          </>
        ),
      },
      {
        id: "last_run",
        header: "Last run",
        accessorFn: (row) => (row.last_run_at ? Date.parse(row.last_run_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last run", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.last_run_at ? (
            <TimestampCell value={row.original.last_run_at} />
          ) : (
            <span className="text-fg-disabled">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status.label,
        meta: { label: "Status", className: "min-w-40" },
        cell: ({ row }) => (
          <>
            <StatusPill severity={row.original.status.severity} label={row.original.status.label} />
            {/* The failure reason lives with the status so it reads as one unit,
                including in the mobile card layout. */}
            {row.original.error && (
              <p className="mt-1 max-w-sm break-words font-mono text-xs text-sev-critical">{row.original.error}</p>
            )}
          </>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => {
          const connector = row.original;
          return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <ConnectorActionButton connectorId={connector.id} kind="test" />
              <ConnectorActionButton connectorId={connector.id} kind="manual" disabled={!connector.verified} />
              <ActionForm
                action={toggleConnectorAction}
                fields={{ connector_id: connector.id, enabled: connector.enabled ? "off" : "on" }}
                disabled={!connector.verified}
                title={!connector.verified ? "Test successfully first" : undefined}
              >
                {connector.enabled ? "Disable" : "Enable"}
              </ActionForm>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/connectors/${connector.id}`} title="Edit" aria-label={`Edit connector ${connector.name}`}>
                  <Pencil size={12} />
                </Link>
              </Button>
              <ActionForm
                action={deleteConnectorAction}
                fields={{ connector_id: connector.id }}
                variant="danger"
                pendingLabel="Deleting…"
                confirmMessage={`Delete connector “${connector.name}”? This cannot be undone.`}
              >
                Delete
              </ActionForm>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="connectors-v2"
      ariaLabel="Connectors"
      columns={columns}
      data={connectors}
      getRowId={(connector) => connector.id}
    />
  );
}
