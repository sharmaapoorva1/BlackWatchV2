"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ChannelTableRow } from "@/lib/notification-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Severity } from "@/components/ui/StatusDot";
import { TimestampCell } from "@/components/domain/TimestampCell";
// Server actions are imported where they are used (see ActionForm).
import { deleteChannelAction, testChannelAction, toggleChannelAction } from "@/app/notifications/actions";

export function NotificationChannelsTable({ channels }: { channels: ChannelTableRow[] }) {
  const columns = useMemo<ColumnDef<ChannelTableRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (channel) => channel.name,
        enableHiding: false,
        meta: { label: "Name" },
        cell: ({ row }) => (
          <Link
            href={`/notifications/channels/${row.original.id}`}
            className="text-sm text-fg transition-colors hover:text-signal"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (channel) => channel.type,
        meta: { label: "Type", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.type,
      },
      {
        id: "state",
        header: "State",
        accessorFn: (channel) => (channel.enabled ? 1 : 0),
        meta: { label: "State" },
        cell: ({ row }) => (
          <StatusPill
            label={row.original.enabled ? "enabled" : "disabled"}
            severity={row.original.enabled ? "resolved" : "neutral"}
          />
        ),
      },
      {
        id: "last_status",
        header: "Last status",
        accessorFn: (channel) => channel.last_status ?? "",
        meta: { label: "Last status" },
        cell: ({ row }) => {
          const { last_status: status, last_error: error } = row.original;
          const severity: Severity = status === "ok" ? "resolved" : status ? "critical" : "neutral";
          return <StatusPill label={status ?? "never"} severity={severity} title={error ?? undefined} />;
        },
      },
      {
        id: "last_sent",
        header: "Last sent",
        accessorFn: (channel) => (channel.last_sent_at ? Date.parse(channel.last_sent_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last sent", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.last_sent_at ? (
            <TimestampCell value={row.original.last_sent_at} />
          ) : (
            <span className="font-mono text-xs text-fg-disabled">—</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => {
          const channel = row.original;
          return (
            <div className="inline-flex items-center gap-1.5">
              <ActionForm action={testChannelAction} fields={{ id: channel.id }} pendingLabel="Sending…">
                Test
              </ActionForm>
              <ActionForm
                action={toggleChannelAction}
                fields={{ id: channel.id, enabled: channel.enabled ? "off" : "on" }}
              >
                {channel.enabled ? "Disable" : "Enable"}
              </ActionForm>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/notifications/channels/${channel.id}`} aria-label={`Edit channel ${channel.name}`}>
                  <Pencil size={12} />
                </Link>
              </Button>
              <ActionForm
                action={deleteChannelAction}
                fields={{ id: channel.id }}
                variant="danger"
                pendingLabel="Deleting…"
                confirmMessage={`Delete channel “${channel.name}”? This cannot be undone.`}
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
      tableId="notifications-channels-v2"
      ariaLabel="Channels"
      columns={columns}
      data={channels}
      getRowId={(channel) => channel.id}
    />
  );
}
