"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { HostSession } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { SeverityBadge } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

/** One line of the host's merged security activity (alerts, access, FIM). */
export interface HostActivityItem {
  key: string;
  at: string;
  kind: string;
  severity: string | null;
  action: string;
  actorOrTarget: string;
  href: string | null;
}

export function HostRecentActivityTable({ items }: { items: HostActivityItem[] }) {
  const columns = useMemo<ColumnDef<HostActivityItem, unknown>[]>(
    () => [
      {
        id: "when",
        header: "When",
        accessorFn: (item) => Date.parse(item.at) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "When", className: "whitespace-nowrap" },
        cell: ({ row }) => (row.original.at ? <TimestampCell value={row.original.at} /> : <span className="text-fg-disabled">—</span>),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (item) => item.kind,
        meta: { label: "Type", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.kind,
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (item) => SEVERITY_RANK[(item.severity ?? "").toLowerCase()] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) =>
          row.original.severity ? <SeverityBadge severity={row.original.severity} /> : <span className="text-xs text-fg-subtle">—</span>,
      },
      {
        id: "activity",
        header: "Activity",
        accessorFn: (item) => item.action,
        meta: { label: "Activity", className: "min-w-56 max-w-[30rem] break-words" },
        cell: ({ row }) =>
          row.original.href ? (
            <Link href={row.original.href} className="font-mono text-xs text-fg hover:text-signal">
              {row.original.action}
            </Link>
          ) : (
            <span className="font-mono text-xs text-fg">{row.original.action}</span>
          ),
      },
      {
        id: "actor",
        header: "Actor / target",
        accessorFn: (item) => item.actorOrTarget,
        meta: { label: "Actor / target", className: "min-w-40 max-w-56 break-words text-xs text-fg-muted" },
        cell: ({ row }) => row.original.actorOrTarget,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="host-recent-activity-v2"
      ariaLabel="Recent host security activity"
      columns={columns}
      data={items}
      getRowId={(item) => item.key}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}

export function HostSessionsTable({ sessions }: { sessions: HostSession[] }) {
  const columns = useMemo<ColumnDef<HostSession, unknown>[]>(
    () => [
      {
        id: "user",
        header: "User",
        accessorFn: (s) => s.user,
        enableHiding: false,
        meta: { label: "User", className: "text-fg" },
        cell: ({ row }) => row.original.user,
      },
      {
        id: "tty",
        header: "TTY",
        accessorFn: (s) => s.tty,
        meta: { label: "TTY", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.tty,
      },
      {
        id: "source",
        header: "Source IP",
        accessorFn: (s) => s.source ?? "",
        meta: { label: "Source IP", className: "text-xs" },
        cell: ({ row }) =>
          row.original.source ? <IpCell value={row.original.source} className="text-xs text-fg" /> : <span className="text-fg-subtle">local</span>,
      },
      {
        id: "login",
        header: "Login",
        accessorFn: (s) => s.login,
        meta: { label: "Login", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.login,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="host-sessions-v2"
      ariaLabel="Users currently logged in"
      columns={columns}
      data={sessions}
      getRowId={(s, index) => `${s.user}-${s.tty}-${index}`}
    />
  );
}
