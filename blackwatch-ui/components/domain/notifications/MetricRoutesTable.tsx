"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import type { MetricRouteTableRow } from "@/lib/notification-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { deletePerfAlertAction, togglePerfAlertAction } from "@/app/notifications/perf-alerts/actions";

const METRIC_LABEL: Record<string, string> = {
  memory_pct: "Memory %",
  cpu_utilization_pct: "CPU utilization %",
  disk_pct_max: "Disk %",
};

const OPERATOR: Record<string, string> = { gte: "≥", gt: ">", lte: "≤", lt: "<" };

/** Host-metric alert rules, with per-row turn on/off, edit and delete. */
export function MetricRoutesTable({ rules }: { rules: MetricRouteTableRow[] }) {
  const columns = useMemo<ColumnDef<MetricRouteTableRow, unknown>[]>(
    () => [
      {
        id: "metric",
        header: "Metric",
        accessorFn: (rule) => METRIC_LABEL[rule.metric] ?? rule.metric,
        enableHiding: false,
        meta: { label: "Metric", className: "text-sm text-fg" },
        cell: ({ row }) => METRIC_LABEL[row.original.metric] ?? row.original.metric,
      },
      {
        id: "trigger",
        header: "Trigger",
        accessorFn: (rule) => rule.threshold,
        meta: { label: "Trigger", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => {
          const rule = row.original;
          return `${OPERATOR[rule.comparison] ?? "≥"} ${rule.threshold}% / ${rule.minutes}m · ${rule.scope}`;
        },
      },
      {
        id: "channel",
        header: "Channel",
        accessorFn: (rule) => rule.channels.join(", "),
        meta: { label: "Channel", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.channels.join(", ") || "—",
      },
      {
        id: "state",
        header: "State",
        accessorFn: (rule) => (rule.enabled ? 1 : 0),
        meta: { label: "State" },
        cell: ({ row }) => (
          <span className={clsx("text-xs", row.original.enabled ? "text-signal" : "text-fg-subtle")}>
            {row.original.enabled ? "on" : "off"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => {
          const rule = row.original;
          return (
            <div className="inline-flex items-center gap-1.5">
              <ActionForm
                action={togglePerfAlertAction}
                fields={{ id: rule.id, target: rule.enabled ? "off" : "on" }}
              >
                {rule.enabled ? "Turn off" : "Turn on"}
              </ActionForm>
              <Button asChild size="sm" variant="ghost">
                <Link
                  href={`/notifications/perf-alerts/${encodeURIComponent(rule.id)}/edit`}
                  aria-label={`Edit metric ${rule.name}`}
                >
                  <Pencil size={12} />
                </Link>
              </Button>
              <ActionForm
                action={deletePerfAlertAction}
                fields={{ id: rule.id, name: rule.name }}
                variant="danger"
                pendingLabel="Deleting…"
                confirmMessage={`Delete performance alert “${rule.name}”? This cannot be undone.`}
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
      tableId="notifications-metric-routes-v2"
      ariaLabel="Metric routes"
      columns={columns}
      data={rules}
      getRowId={(rule) => rule.id}
    />
  );
}
