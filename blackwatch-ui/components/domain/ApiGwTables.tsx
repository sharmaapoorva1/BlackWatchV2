"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { ApiGwAlert, ApiGwApi, ApiGwFailure, ApiGwSource } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { TimestampCell } from "./TimestampCell";

const num = (n: number) => n.toLocaleString("en-US");

function Time({ value }: { value: string | null | undefined }) {
  return value ? <TimestampCell value={value} /> : <span className="text-fg-disabled">—</span>;
}

function ErrorCount({ count, tone }: { count: number; tone: "text-sev-medium" | "text-sev-critical" }) {
  return <span className={count > 0 ? tone : "text-fg-disabled"}>{num(count)}</span>;
}

const NUMERIC = "text-right font-mono text-xs";

// ---------------------------------------------------------------------------
// Active APIs
// ---------------------------------------------------------------------------

export function ApisTable({ apis }: { apis: ApiGwApi[] }) {
  const columns = useMemo<ColumnDef<ApiGwApi, unknown>[]>(
    () => [
      {
        id: "api",
        header: "API name",
        accessorFn: (a) => a.api_name,
        enableHiding: false,
        meta: { label: "API name", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.api_name,
      },
      {
        id: "sources",
        header: "Sources",
        accessorFn: (a) => a.source_count,
        sortDescFirst: true,
        meta: { label: "Sources", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => num(row.original.source_count),
      },
      {
        id: "requests",
        header: "Requests",
        accessorFn: (a) => a.request_count,
        sortDescFirst: true,
        meta: { label: "Requests", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => num(row.original.request_count),
      },
      {
        id: "e4xx",
        header: "4xx",
        accessorFn: (a) => a.error_4xx_count,
        sortDescFirst: true,
        meta: { label: "4xx", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => <ErrorCount count={row.original.error_4xx_count} tone="text-sev-medium" />,
      },
      {
        id: "e5xx",
        header: "5xx",
        accessorFn: (a) => a.error_5xx_count,
        sortDescFirst: true,
        meta: { label: "5xx", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => <ErrorCount count={row.original.error_5xx_count} tone="text-sev-critical" />,
      },
      {
        id: "first_seen",
        header: "First seen",
        accessorFn: (a) => (a.first_seen_at ? Date.parse(a.first_seen_at) || 0 : 0),
        meta: { label: "First seen", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.first_seen_at} />,
      },
      {
        id: "last_seen",
        header: "Last request",
        accessorFn: (a) => (a.last_seen_at ? Date.parse(a.last_seen_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last request", className: "whitespace-nowrap font-mono text-xs" },
        cell: ({ row }) => <Time value={row.original.last_seen_at} />,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="api-gw-apis-v2"
      ariaLabel="Active APIs"
      columns={columns}
      data={apis}
      getRowId={(a) => a.api_name}
      initialSorting={[{ id: "requests", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const ALERT_LABEL: Record<ApiGwAlert["action"], { label: string; color: string }> = {
  "api.source.new": { label: "new source", color: "bg-sev-high" },
  "api.auth.burst": { label: "auth burst", color: "bg-sev-critical" },
  "api.error.burst": { label: "5xx burst", color: "bg-sev-medium" },
  "api.scanner_ua": { label: "scanner UA", color: "bg-sev-high" },
};

export function AlertsTable({ alerts }: { alerts: ApiGwAlert[] }) {
  const columns = useMemo<ColumnDef<ApiGwAlert, unknown>[]>(
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
        accessorFn: (a) => ALERT_LABEL[a.action]?.label ?? a.action,
        meta: { label: "Signal" },
        cell: ({ row }) => {
          const entry = ALERT_LABEL[row.original.action];
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", entry?.color ?? "bg-fg-subtle")} />
              <span className="text-fg-muted">{entry?.label ?? row.original.action}</span>
            </span>
          );
        },
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
        cell: ({ row }) => row.original.message || <span className="text-fg-disabled">—</span>,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="api-gw-alerts-v2"
      ariaLabel="API Gateway alerts"
      columns={columns}
      data={alerts}
      getRowId={(a, index) => a.event_id ?? `${a.event_time}-${a.action}-${a.source_ip}-${index}`}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export function SourcesTable({ sources }: { sources: ApiGwSource[] }) {
  const columns = useMemo<ColumnDef<ApiGwSource, unknown>[]>(
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
        id: "api",
        header: "API",
        accessorFn: (s) => s.api_name,
        meta: { label: "API", className: "break-all font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.api_name,
      },
      {
        id: "requests",
        header: "Requests",
        accessorFn: (s) => s.request_count,
        sortDescFirst: true,
        meta: { label: "Requests", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => num(row.original.request_count),
      },
      {
        id: "e4xx",
        header: "4xx",
        accessorFn: (s) => s.error_4xx_count,
        sortDescFirst: true,
        meta: { label: "4xx", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => <ErrorCount count={row.original.error_4xx_count} tone="text-sev-medium" />,
      },
      {
        id: "e5xx",
        header: "5xx",
        accessorFn: (s) => s.error_5xx_count,
        sortDescFirst: true,
        meta: { label: "5xx", className: NUMERIC, headerClassName: "text-right" },
        cell: ({ row }) => <ErrorCount count={row.original.error_5xx_count} tone="text-sev-critical" />,
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
      tableId="api-gw-sources-v2"
      ariaLabel="API Gateway sources"
      columns={columns}
      data={sources}
      getRowId={(s) => s.source_ip}
      initialSorting={[{ id: "requests", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

export function FailuresTable({ failures }: { failures: ApiGwFailure[] }) {
  const columns = useMemo<ColumnDef<ApiGwFailure, unknown>[]>(
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
        id: "kind",
        header: "Kind",
        accessorFn: (f) => f.action,
        meta: { label: "Kind", className: "text-xs text-fg-muted" },
        cell: ({ row }) => (row.original.action === "api.auth.failure" ? "auth" : "5xx"),
      },
      {
        id: "api",
        header: "API",
        accessorFn: (f) => f.api_name ?? "",
        meta: { label: "API", className: "max-w-[20rem] wrap-anywhere font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.api_name || <span className="text-fg-disabled">unknown API</span>,
      },
      {
        id: "route",
        header: "Route",
        accessorFn: (f) => f.route_key ?? "",
        meta: { label: "Route", className: "max-w-[24rem] wrap-anywhere font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.route_key || <span className="text-fg-disabled">—</span>,
      },
      {
        id: "method",
        header: "Method",
        accessorFn: (f) => f.method ?? "",
        meta: { label: "Method", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.method || "—",
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (f) => f.status ?? 0,
        sortDescFirst: true,
        meta: { label: "Status", className: "font-mono text-xs" },
        cell: ({ row }) => {
          const status = row.original.status ?? 0;
          return (
            <span className={status >= 500 ? "text-sev-critical" : status >= 400 ? "text-sev-medium" : "text-fg-muted"}>
              {row.original.status ?? "—"}
            </span>
          );
        },
      },
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (f) => f.source_ip ?? "",
        meta: { label: "Source IP", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} />,
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (f) => f.reason ?? "",
        meta: { label: "Reason", className: "max-w-[32rem] wrap-anywhere text-xs text-fg-muted" },
        cell: ({ row }) => row.original.reason || <span className="text-fg-disabled">—</span>,
      },
      {
        id: "user_agent",
        header: "User agent",
        accessorFn: (f) => f.user_agent ?? "",
        meta: { label: "User agent", className: "max-w-[40rem] wrap-anywhere font-mono text-xs text-fg-subtle" },
        cell: ({ row }) => row.original.user_agent || <span className="text-fg-disabled">—</span>,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="api-gw-failures-v2"
      ariaLabel="API Gateway failures"
      columns={columns}
      data={failures}
      getRowId={(f, index) => f.event_id ?? `${f.event_time}-${f.action}-${f.source_ip}-${index}`}
      initialSorting={[{ id: "when", desc: true }]}
    />
  );
}
