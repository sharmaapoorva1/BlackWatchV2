"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type {
  RdsAllowlistEntry,
  RdsAuthFailure,
  RdsDbSummary,
  RdsProxySource,
  RdsSession,
  RdsShapeBAlert,
} from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { IpCell } from "./IpCell";
import { TimestampCell } from "./TimestampCell";
// Server actions are imported where they are used (see ActionForm).
import { removeAllowlistUserAction } from "@/app/rds/allowlist-actions";

const NUMERIC = "text-right font-mono text-xs";
const num = (n: number) => n.toLocaleString("en-US");

function Time({ value }: { value: string | null | undefined }) {
  return value ? <TimestampCell value={value} /> : <span className="text-fg-disabled">—</span>;
}

function Dash() {
  return <span className="text-fg-disabled">—</span>;
}

function SourcePill({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    postgres: { label: "postgres", color: "bg-sev-resolved" },
    rds_proxy: { label: "proxy", color: "bg-sev-medium" },
    unknown: { label: "?", color: "bg-fg-subtle" },
  };
  const { label, color } = map[type] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-fg-muted">{label}</span>
    </span>
  );
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const days = Math.floor(secs / 86400);
  if (days >= 1) {
    const hours = Math.floor((secs % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const hours = Math.floor(secs / 3600);
  if (hours >= 1) {
    const mins = Math.floor((secs % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${Math.floor(secs / 60)}m`;
}

// ---------------------------------------------------------------------------
// Shape-B alerts feed
// ---------------------------------------------------------------------------

const SHAPE_B: Record<RdsShapeBAlert["action"], { label: string; color: string }> = {
  "rds.proxy.source.new": { label: "new proxy source", color: "bg-sev-high" },
  "rds.session.new_source": { label: "user × new IP", color: "bg-sev-high" },
  "rds.user.unknown": { label: "unknown user", color: "bg-sev-critical" },
};

export function ShapeBAlertsTable({ alerts }: { alerts: RdsShapeBAlert[] }) {
  const columns = useMemo<ColumnDef<RdsShapeBAlert, unknown>[]>(
    () => [
      {
        id: "when",
        header: "When",
        accessorFn: (a) => (a.event_time ? Date.parse(a.event_time) || 0 : 0),
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "When", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.event_time} />,
      },
      {
        id: "signal",
        header: "Signal",
        accessorFn: (a) => SHAPE_B[a.action]?.label ?? a.action,
        meta: { label: "Signal" },
        cell: ({ row }) => {
          const entry = SHAPE_B[row.original.action];
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", entry?.color ?? "bg-fg-subtle")} />
              <span className="text-fg-muted">{entry?.label ?? row.original.action}</span>
            </span>
          );
        },
      },
      {
        id: "user",
        header: "User",
        accessorFn: (a) => a.user ?? "",
        meta: { label: "User", className: "text-fg" },
        cell: ({ row }) => row.original.user || <Dash />,
      },
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (a) => a.source_ip ?? "",
        meta: { label: "Source IP", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} />,
      },
      {
        id: "detail",
        header: "Detail",
        accessorFn: (a) => a.message ?? "",
        meta: { label: "Detail", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.message || <Dash />,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="rds-shape-b-v2"
      ariaLabel="RDS detection alerts"
      columns={columns}
      data={alerts}
      getRowId={(a, index) => a.event_id ?? `${a.event_time}-${a.action}-${a.user}-${a.source_ip}-${index}`}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Proxy source IPs
// ---------------------------------------------------------------------------

export function ProxySourcesTable({ sources }: { sources: RdsProxySource[] }) {
  const columns = useMemo<ColumnDef<RdsProxySource, unknown>[]>(
    () => [
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (s) => s.source_ip,
        enableHiding: false,
        meta: { label: "Source IP", className: "font-mono text-xs text-fg" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} />,
      },
      {
        id: "connects",
        header: "Connects",
        accessorFn: (s) => s.connect_count,
        sortDescFirst: true,
        meta: { label: "Connects", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => num(row.original.connect_count),
      },
      {
        id: "first_seen",
        header: "First seen",
        accessorFn: (s) => Date.parse(s.first_seen_at) || 0,
        meta: { label: "First seen", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <TimestampCell value={row.original.first_seen_at} />,
      },
      {
        id: "last_seen",
        header: "Last seen",
        accessorFn: (s) => Date.parse(s.last_seen_at) || 0,
        sortDescFirst: true,
        meta: { label: "Last seen", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <TimestampCell value={row.original.last_seen_at} />,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="rds-proxy-sources-v2"
      ariaLabel="RDS proxy source IPs"
      columns={columns}
      data={sources}
      getRowId={(s) => s.source_ip}
      initialSorting={[{ id: "last_seen", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Allowlist entries (with a Remove action per row)
// ---------------------------------------------------------------------------

export function AllowlistEntriesTable({ entries, kind }: { entries: RdsAllowlistEntry[]; kind: string }) {
  const columns = useMemo<ColumnDef<RdsAllowlistEntry, unknown>[]>(
    () => [
      {
        id: "username",
        header: "Username",
        accessorFn: (u) => u.username,
        enableHiding: false,
        meta: { label: "Username", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.username,
      },
      {
        id: "kind",
        header: "Kind",
        accessorFn: (u) => u.kind,
        meta: { label: "Kind", className: "text-xs" },
        cell: ({ row }) => (
          <span
            className={clsx(
              "inline-block rounded px-1.5 py-0.5 text-xs",
              row.original.kind === "human" ? "bg-signal/10 text-signal" : "bg-fg-subtle/10 text-fg-muted",
            )}
          >
            {row.original.kind}
          </span>
        ),
      },
      {
        id: "note",
        header: "Note",
        accessorFn: (u) => u.note ?? "",
        meta: { label: "Note", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.note || <Dash />,
      },
      {
        id: "added",
        header: "Added",
        accessorFn: (u) => Date.parse(u.added_at) || 0,
        sortDescFirst: true,
        meta: { label: "Added", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <TimestampCell value={row.original.added_at} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => (
          <ActionForm
            action={removeAllowlistUserAction}
            fields={{ username: row.original.username }}
            variant="danger"
            pendingLabel="Removing…"
            confirmMessage={`Remove ${row.original.username} from the allowlist?`}
          >
            Remove
          </ActionForm>
        ),
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId={`rds-allowlist-${kind}-v2`}
      ariaLabel={`RDS allowlist: ${kind}`}
      columns={columns}
      data={entries}
      getRowId={(u) => u.username}
    />
  );
}

// ---------------------------------------------------------------------------
// Databases summary
// ---------------------------------------------------------------------------

export function DatabasesTable({ databases }: { databases: RdsDbSummary[] }) {
  const columns = useMemo<ColumnDef<RdsDbSummary, unknown>[]>(
    () => [
      {
        id: "database",
        header: "Database",
        accessorFn: (d) => d.db_instance,
        enableHiding: false,
        meta: { label: "Database", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.db_instance,
      },
      {
        id: "source",
        header: "Source",
        accessorFn: (d) => d.source_type,
        meta: { label: "Source" },
        cell: ({ row }) => <SourcePill type={row.original.source_type} />,
      },
      {
        id: "active",
        header: "Active",
        accessorFn: (d) => d.active,
        sortDescFirst: true,
        meta: { label: "Active", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => (
          <span className={row.original.active > 0 ? "text-sev-resolved" : "text-fg-disabled"}>{row.original.active}</span>
        ),
      },
      {
        id: "auth_failures",
        header: "Auth fails 24h",
        accessorFn: (d) => d.auth_failures_24h,
        sortDescFirst: true,
        meta: { label: "Auth fails 24h", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => (
          <span className={row.original.auth_failures_24h > 0 ? "text-sev-critical" : "text-fg-muted"}>
            {row.original.auth_failures_24h}
          </span>
        ),
      },
      {
        id: "total_seen",
        header: "Total seen",
        accessorFn: (d) => d.total_seen,
        sortDescFirst: true,
        meta: { label: "Total seen", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => row.original.total_seen,
      },
      {
        id: "last_activity",
        header: "Last activity",
        accessorFn: (d) => (d.last_activity ? Date.parse(d.last_activity) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last activity", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.last_activity} />,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="rds-databases-v2"
      ariaLabel="RDS databases"
      columns={columns}
      data={databases}
      getRowId={(d) => `${d.db_instance}:${d.source_type}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Sessions (live and history)
// ---------------------------------------------------------------------------

export function SessionsTable({ sessions, live = false }: { sessions: RdsSession[]; live?: boolean }) {
  const columns = useMemo<ColumnDef<RdsSession, unknown>[]>(() => {
    const base: ColumnDef<RdsSession, unknown>[] = [
      {
        id: "database",
        header: "Database",
        accessorFn: (s) => s.db_instance,
        enableHiding: false,
        meta: { label: "Database", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => (
          <>
            {row.original.db_instance}
            {row.original.db_name && <span className="ml-1 text-fg-muted">({row.original.db_name})</span>}
          </>
        ),
      },
      {
        id: "user",
        header: "User",
        accessorFn: (s) => s.db_user ?? "",
        meta: { label: "User", className: "text-fg" },
        cell: ({ row }) => row.original.db_user || <Dash />,
      },
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (s) => s.source_ip ?? "",
        meta: { label: "Source IP", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => (
          <>
            <IpCell value={row.original.source_ip} />
            {row.original.source_ip && row.original.source_port ? (
              <span className="text-fg-subtle">:{row.original.source_port}</span>
            ) : null}
          </>
        ),
      },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (s) => s.duration_seconds,
        sortDescFirst: true,
        meta: { label: "Duration", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => formatDuration(row.original.duration_seconds),
      },
      {
        id: "connected",
        header: live ? "Connected since" : "Connected at",
        accessorFn: (s) => (s.connected_at ? Date.parse(s.connected_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: live ? "Connected since" : "Connected at", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.connected_at} />,
      },
    ];
    if (live) return base;
    return [
      ...base,
      {
        id: "disconnected",
        header: "Disconnected",
        accessorFn: (s) => (s.disconnected_at ? Date.parse(s.disconnected_at) || 0 : Number.MAX_SAFE_INTEGER),
        meta: { label: "Disconnected", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) =>
          row.original.disconnected_at ? (
            <TimestampCell value={row.original.disconnected_at} />
          ) : (
            <span className="text-sev-resolved">still open</span>
          ),
      },
    ];
  }, [live]);
  return (
    <DataTable
      tableId={live ? "rds-sessions-live-v2" : "rds-sessions-history-v2"}
      ariaLabel={live ? "Live RDS sessions" : "RDS session history"}
      columns={columns}
      data={sessions}
      getRowId={(s) => s.session_id}
    />
  );
}

// ---------------------------------------------------------------------------
// Auth failures
// ---------------------------------------------------------------------------

export function AuthFailuresTable({ failures }: { failures: RdsAuthFailure[] }) {
  const columns = useMemo<ColumnDef<RdsAuthFailure, unknown>[]>(
    () => [
      {
        id: "when",
        header: "When",
        accessorFn: (f) => (f.event_time ? Date.parse(f.event_time) || 0 : 0),
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "When", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.event_time} />,
      },
      {
        id: "database",
        header: "Database",
        accessorFn: (f) => f.db_instance ?? "",
        meta: { label: "Database", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.db_instance || "—",
      },
      {
        id: "user",
        header: "User",
        accessorFn: (f) => f.user ?? "",
        meta: { label: "User", className: "text-fg" },
        cell: ({ row }) => row.original.user || <Dash />,
      },
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (f) => f.source_ip ?? "",
        meta: { label: "Source IP", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} />,
      },
      {
        id: "source",
        header: "Source",
        accessorFn: (f) => f.source_type ?? "",
        meta: { label: "Source" },
        cell: ({ row }) => <SourcePill type={row.original.source_type || "unknown"} />,
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (f) => f.reason ?? f.message ?? "",
        meta: { label: "Reason", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.reason || row.original.message || "—",
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="rds-auth-failures-v2"
      ariaLabel="RDS authentication failures"
      columns={columns}
      data={failures}
      getRowId={(f, index) => f.event_id ?? `${f.event_time}-${f.user}-${f.source_ip}-${index}`}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}
