"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { ProbeAgent } from "@/lib/types";
import type { ServiceTableRow } from "@/lib/service-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { SeverityBadge } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

// `unknown` means BlackWatch cannot see the service, so any stored latency or
// check time is meaningless and is shown as a dash.
const STATUS_RANK: Record<string, number> = { down: 0, degraded: 1, unknown: 2, up: 3, disabled: 4 };

function ServiceStatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    up: { color: "bg-sev-resolved", label: "up" },
    down: { color: "bg-sev-critical", label: "DOWN" },
    degraded: { color: "bg-sev-medium", label: "degraded" },
    // unknown = unprobeable but AWS still wants it running. Yellow to
    // signal "we can't see, look at AWS state".
    unknown: { color: "bg-sev-medium", label: "unknown" },
    disabled: { color: "bg-fg-disabled", label: "disabled" },
  };
  const { color, label } = map[status] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", color)} />
      <span className={status === "down" ? "text-fg" : "text-fg-muted"}>{label}</span>
    </span>
  );
}

function Tags({ tags }: { tags: [string, string][] }) {
  if (tags.length === 0) return <>—</>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {tags.map(([key, value]) => (
        <code key={key}>
          {key}={value}
        </code>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Probe agents
// ---------------------------------------------------------------------------

export function ProbeAgentsTable({ agents }: { agents: ProbeAgent[] }) {
  const columns = useMemo<ColumnDef<ProbeAgent, unknown>[]>(
    () => [
      {
        id: "vpc",
        header: "VPC",
        accessorFn: (agent) => agent.vpc,
        enableHiding: false,
        meta: { label: "VPC", className: "font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.vpc,
      },
      {
        id: "agent",
        header: "Agent",
        accessorFn: (agent) => (agent.active === true ? 1 : 0),
        meta: { label: "Agent" },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className={clsx("h-1.5 w-1.5 rounded-full", row.original.active === true ? "bg-sev-resolved" : "bg-sev-critical")}
            />
            <span className="text-fg-muted">{row.original.active === true ? "reporting" : "stale / down"}</span>
          </span>
        ),
      },
      {
        id: "last_report",
        header: "Last report",
        accessorFn: (agent) => (agent.last_report ? Date.parse(agent.last_report) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last report", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.last_report ? (
            <TimestampCell value={row.original.last_report} />
          ) : (
            <span className="text-fg-disabled">—</span>
          ),
      },
      {
        id: "version",
        header: "Version",
        accessorFn: (agent) => agent.agent_version ?? "",
        meta: { label: "Version", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.agent_version ?? "—",
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="services-agents-v2"
      ariaLabel="Per-VPC probe agents"
      columns={columns}
      data={agents}
      getRowId={(agent) => agent.vpc}
    />
  );
}

// ---------------------------------------------------------------------------
// Live services (one table per VPC)
// ---------------------------------------------------------------------------

export function ServicesTable({ services, vpc }: { services: ServiceTableRow[]; vpc: string }) {
  const columns = useMemo<ColumnDef<ServiceTableRow, unknown>[]>(
    () => [
      {
        id: "service",
        header: "Service",
        accessorFn: (s) => s.name,
        enableHiding: false,
        meta: { label: "Service", className: "text-fg" },
        cell: ({ row }) => row.original.name,
      },
      {
        id: "tier",
        header: "Tier",
        accessorFn: (s) => s.tier,
        meta: { label: "Tier", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.tier,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (s) => STATUS_RANK[s.status] ?? 2,
        meta: { label: "Status" },
        cell: ({ row }) => <ServiceStatusPill status={row.original.status} />,
      },
      {
        id: "latency",
        header: "Latency",
        accessorFn: (s) => (s.status === "unknown" || s.latency_ms == null ? -1 : s.latency_ms),
        sortDescFirst: true,
        meta: { label: "Latency", className: "text-right font-mono text-xs text-fg-muted", headerClassName: "text-right" },
        cell: ({ row }) =>
          row.original.status === "unknown" || row.original.latency_ms == null ? "—" : `${row.original.latency_ms}ms`,
      },
      {
        id: "fails",
        header: "Fails",
        accessorFn: (s) => (s.status === "unknown" ? -1 : s.consecutive_fails),
        sortDescFirst: true,
        meta: { label: "Fails", className: "text-right font-mono text-xs", headerClassName: "text-right" },
        cell: ({ row }) => {
          const hide = row.original.status === "unknown";
          return (
            <span className={!hide && row.original.consecutive_fails > 0 ? "text-sev-critical" : "text-fg-muted"}>
              {hide ? "—" : row.original.consecutive_fails}
            </span>
          );
        },
      },
      {
        id: "last_check",
        header: "Last check",
        accessorFn: (s) => (s.status === "unknown" || s.age_seconds == null ? Number.MAX_SAFE_INTEGER : s.age_seconds),
        meta: { label: "Last check", className: "font-mono text-xs" },
        cell: ({ row }) => {
          const s = row.original;
          if (s.status === "unknown" || s.age_seconds == null) return <span className="text-fg-disabled">—</span>;
          return (
            <>
              <span className="text-fg-muted">{s.age_seconds}s ago</span>
              {s.stale && <span className="ml-1.5 text-xs text-sev-medium">stale</span>}
            </>
          );
        },
      },
      {
        id: "severity",
        header: "Sev",
        accessorFn: (s) => SEVERITY_RANK[s.severity_when_down] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity when down" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity_when_down} />,
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        meta: { label: "Tags", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <Tags tags={row.original.tags} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId={`services-${vpc}-v2`}
      ariaLabel={`Services in ${vpc}`}
      columns={columns}
      data={services}
      getRowId={(s) => s.id}
      initialSorting={[{ id: "status", desc: false }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Archive (services down for a long time)
// ---------------------------------------------------------------------------

export function ArchivedServicesTable({ services }: { services: ServiceTableRow[] }) {
  const columns = useMemo<ColumnDef<ServiceTableRow, unknown>[]>(
    () => [
      {
        id: "vpc",
        header: "VPC",
        accessorFn: (s) => s.vpc,
        meta: { label: "VPC", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.vpc,
      },
      {
        id: "service",
        header: "Service",
        accessorFn: (s) => s.name,
        enableHiding: false,
        meta: { label: "Service", className: "text-fg-muted" },
        cell: ({ row }) => row.original.name,
      },
      {
        id: "tier",
        header: "Tier",
        accessorFn: (s) => s.tier,
        meta: { label: "Tier", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.tier,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (s) => STATUS_RANK[s.status] ?? 2,
        meta: { label: "Status" },
        cell: ({ row }) => <ServiceStatusPill status={row.original.status} />,
      },
      {
        id: "down_for",
        header: "Down for",
        // Longest outage first: smaller `down_since` means down for longer.
        accessorFn: (s) => (s.down_since_ms == null ? Number.MAX_SAFE_INTEGER : s.down_since_ms),
        meta: { label: "Down for", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.down_for,
      },
      {
        id: "severity",
        header: "Sev",
        accessorFn: (s) => SEVERITY_RANK[s.severity_when_down] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity when down" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity_when_down} />,
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        meta: { label: "Tags", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => <Tags tags={row.original.tags} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="services-archive-v2"
      ariaLabel="Archived services"
      columns={columns}
      data={services}
      getRowId={(s) => s.id}
    />
  );
}
