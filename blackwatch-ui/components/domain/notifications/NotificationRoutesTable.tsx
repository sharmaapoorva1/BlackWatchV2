"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { computeRouteState, type RouteTableRow } from "@/lib/notification-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { PendingButton } from "@/components/ui/PendingButton";
import { SeverityChip } from "@/components/ui/SeverityChip";
import {
  deleteRouteAction,
  silenceRouteAction,
  testRouteAction,
  toggleRouteAction,
} from "@/app/notifications/route-actions";

/** Alert routes for one module group, with per-row test/silence/toggle/delete. */
export function NotificationRoutesTable({
  routes,
  tableId,
  ariaLabel,
}: {
  routes: RouteTableRow[];
  tableId: string;
  ariaLabel: string;
}) {
  const columns = useMemo<ColumnDef<RouteTableRow, unknown>[]>(
    () => [
      {
        id: "source",
        header: "Source",
        accessorFn: (route) => (route.kind === "custom" && route.name ? route.name : route.module_label),
        enableHiding: false,
        meta: { label: "Source" },
        cell: ({ row }) => {
          const route = row.original;
          return (
            <>
              <div className="text-sm text-fg">{route.kind === "custom" && route.name ? route.name : route.module_label}</div>
              {route.kind === "custom" && (
                <div className="font-mono text-xs text-fg-subtle">{route.module_label}</div>
              )}
            </>
          );
        },
      },
      {
        id: "trigger",
        header: "Trigger",
        enableSorting: false,
        meta: { label: "Trigger" },
        cell: ({ row }) =>
          row.original.severities.length === 0 ? (
            <span className="text-xs text-fg-muted">custom condition</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.severities.map((severity) => (
                <SeverityChip key={severity} severity={severity} />
              ))}
            </div>
          ),
      },
      {
        id: "channel",
        header: "Channel",
        accessorFn: (route) => (route.channels.length > 0 ? route.channels.join(", ") : (route.channel ?? "")),
        meta: { label: "Channel", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => {
          const route = row.original;
          const names = route.channels.length > 0 ? route.channels.join(", ") : route.channel;
          return names ? (
            <>
              <span className="text-fg-subtle">→ </span>
              {names}
            </>
          ) : (
            "—"
          );
        },
      },
      {
        id: "state",
        header: "State",
        accessorFn: (route) => computeRouteState(route).label,
        meta: { label: "State" },
        cell: ({ row }) => {
          const state = computeRouteState(row.original);
          return <span className={clsx("text-xs", state.className)}>{state.label}</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => {
          const route = row.original;
          const label = route.name ?? route.module_label;
          return (
            <div className="inline-flex items-center gap-1.5">
              <ActionForm
                action={testRouteAction}
                fields={{ channel: route.channel ?? "" }}
                disabled={!route.channel}
                pendingLabel="Sending…"
              >
                Test
              </ActionForm>
              <form action={silenceRouteAction} className="inline-flex items-center gap-1">
                <input type="hidden" name="id" value={route.id} />
                <NativeSelect
                  name="hours"
                  defaultValue={route.silenced ? "0" : "1"}
                  className="h-7 text-xs"
                  aria-label={`Silence duration for ${label}`}
                >
                  <option value="1">1h</option>
                  <option value="4">4h</option>
                  <option value="24">24h</option>
                  <option value="0">clear</option>
                </NativeSelect>
                <PendingButton size="sm" variant="secondary" pendingLabel="…">
                  {route.silenced ? "Un-silence" : "Silence"}
                </PendingButton>
              </form>
              <ActionForm
                action={toggleRouteAction}
                fields={{ id: route.id, target: route.enabled ? "off" : "on" }}
              >
                {route.enabled ? "Turn off" : "Turn on"}
              </ActionForm>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/notifications/rules/${encodeURIComponent(route.id)}/edit`} aria-label={`Edit route ${label}`}>
                  <Pencil size={12} />
                </Link>
              </Button>
              <ActionForm
                action={deleteRouteAction}
                fields={{ id: route.id }}
                variant="danger"
                pendingLabel="Deleting…"
                confirmMessage={`Delete route “${route.name}”? This cannot be undone.`}
              >
                <Trash2 size={11} /> Delete
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
      tableId={tableId}
      ariaLabel={ariaLabel}
      columns={columns}
      data={routes}
      getRowId={(route) => route.id}
    />
  );
}
