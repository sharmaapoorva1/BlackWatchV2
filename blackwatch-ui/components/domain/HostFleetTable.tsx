"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/layout/DataPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import type { HostSummary } from "@/lib/types";
import { hostGroup, hostState, type FleetGroup } from "@/lib/host-health";

function hostSearchText(host: HostSummary): string {
  return [
    host.display_name,
    host.hostname,
    host.instance_id,
    host.account,
    host.region,
    ...Object.entries(host.tags ?? {}).flat(),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function relativeAge(seconds: number): string {
  const age = Math.max(0, Math.floor(seconds));
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  if (age < 86400) return `${Math.floor(age / 3600)}h ago`;
  return `${Math.floor(age / 86400)}d ago`;
}

function AgentState({ host }: { host: HostSummary }) {
  const state = hostState(host);
  const reason = host.health_reason ?? host.delivery?.reason;
  const tone = state === "healthy"
    ? "text-sev-resolved"
    : state === "silent" || state === "data_loss_risk"
      ? "text-sev-critical"
      : "text-sev-medium";
  const dot = state === "healthy"
    ? "bg-sev-resolved"
    : state === "silent" || state === "data_loss_risk"
      ? "bg-sev-critical"
      : "bg-sev-medium";

  return (
    <div className="max-w-52 space-y-1" title={reason ?? undefined}>
      <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`}>
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {state.replaceAll("_", " ")}
      </span>
      <div className="font-mono text-xs text-fg-subtle">
        {host.age_seconds == null ? "no report yet" : relativeAge(host.age_seconds)}
        {host.delivery?.queue_delay_seconds != null && host.delivery.queue_delay_seconds > 0 && (
          <span title="Time from agent send to server acceptance"> · queue {Math.round(host.delivery.queue_delay_seconds)}s</span>
        )}
      </div>
      {state !== "healthy" && reason && (
        <div className="max-w-52 break-words text-xs text-fg-muted">{reason}</div>
      )}
    </div>
  );
}

function SurfaceCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex min-w-12 items-baseline justify-between gap-2 font-mono text-xs">
      <span className="text-fg">{value}</span>
      <span className="text-xs text-fg-subtle">{label}</span>
    </span>
  );
}

export function HostFleetTable({
  servers,
  initial,
}: {
  servers: HostSummary[];
  /** Starting filters, usually from the URL (`?health=attention&env=prod`). */
  initial?: { health?: string; environment?: string; query?: string };
}) {
  const [query, setQuery] = useState(initial?.query ?? "");
  const [health, setHealth] = useState(initial?.health ?? "");
  const [environment, setEnvironment] = useState(initial?.environment ?? "");

  const environments = useMemo(
    () => [...new Set(servers.map((host) => host.tags?.env).filter((value): value is string => Boolean(value)))].sort(),
    [servers],
  );

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return servers
      .filter((host) => !normalized || hostSearchText(host).includes(normalized))
      .filter((host) => !health || hostGroup(host) === health)
      .filter((host) => !environment || host.tags?.env === environment)
      .sort((left, right) => {
        const order: Record<FleetGroup, number> = { attention: 0, silent: 1, healthy: 2 };
        const groupOrder = order[hostGroup(left)] - order[hostGroup(right)];
        if (groupOrder !== 0) return groupOrder;
        return (right.age_seconds ?? Number.MAX_SAFE_INTEGER) - (left.age_seconds ?? Number.MAX_SAFE_INTEGER);
      });
  }, [servers, query, health, environment]);

  const hasFilters = Boolean(query || health || environment);

  const columns = useMemo<ColumnDef<HostSummary, unknown>[]>(
    () => [
      {
        id: "host",
        header: "Host",
        accessorFn: (host) => host.display_name || host.hostname || host.tags?.role || host.instance_id,
        enableHiding: false,
        meta: { label: "Host", className: "max-w-80" },
        cell: ({ row }) => {
          const host = row.original;
          const name = host.display_name || host.hostname || host.tags?.role || host.instance_id;
          const secondary = [host.display_name && host.hostname !== host.display_name ? host.hostname : null, host.instance_id]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link href={`/hosts/${host.instance_id}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
              <span className="block truncate text-sm text-fg hover:text-signal">{name}</span>
              <span className="mt-0.5 block truncate font-mono text-xs text-fg-subtle">{secondary}</span>
            </Link>
          );
        },
      },
      {
        id: "environment",
        header: "Environment",
        accessorFn: (host) => host.tags?.env ?? "",
        meta: { label: "Environment", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.tags?.env ?? "—",
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (host) => host.tags?.role ?? "",
        meta: { label: "Role", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.tags?.role ?? "—",
      },
      {
        id: "agent",
        header: "Agent / last report",
        // Needs-attention first, then silent, then healthy; oldest report first.
        accessorFn: (host) => ({ attention: 0, silent: 1, healthy: 2 })[hostGroup(host)] * 1e12 - Math.min(host.age_seconds ?? 1e11, 1e11),
        meta: { label: "Agent / last report", className: "min-w-40" },
        cell: ({ row }) => <AgentState host={row.original} />,
      },
      {
        id: "region",
        header: "Region",
        accessorFn: (host) => host.region ?? "",
        meta: { label: "Region", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.region ?? "—",
      },
      {
        id: "ports",
        header: "Ports",
        accessorFn: (host) => host.port_count,
        sortDescFirst: true,
        meta: { label: "Ports", className: "text-right", headerClassName: "text-right" },
        cell: ({ row }) => <SurfaceCount value={row.original.port_count} label="ports" />,
      },
      {
        id: "users",
        header: "Users",
        accessorFn: (host) => host.user_count,
        sortDescFirst: true,
        meta: { label: "Users", className: "text-right", headerClassName: "text-right" },
        cell: ({ row }) => <SurfaceCount value={row.original.user_count} label="users" />,
      },
      {
        id: "keys",
        header: "SSH keys",
        accessorFn: (host) => host.key_count,
        sortDescFirst: true,
        meta: { label: "SSH keys", className: "text-right", headerClassName: "text-right" },
        cell: ({ row }) => <SurfaceCount value={row.original.key_count} label="keys" />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <div role="search" aria-label="Filter host fleet" className="flex flex-wrap items-end gap-3">
        <Field label="Find a host" compact className="w-full sm:w-72">
          <Input
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, hostname, ID, tag…"
            type="search"
            value={query}
          />
        </Field>
        <Field label="Health" compact className="w-full sm:w-44">
          <NativeSelect onChange={(event) => setHealth(event.target.value)} value={health}>
            <option value="">Any health</option>
            <option value="attention">Needs attention</option>
            <option value="silent">Silent</option>
            <option value="healthy">Healthy</option>
          </NativeSelect>
        </Field>
        <Field label="Environment" compact className="w-full sm:w-44">
          <NativeSelect onChange={(event) => setEnvironment(event.target.value)} value={environment}>
            <option value="">All environments</option>
            {environments.map((value) => <option key={value} value={value}>{value}</option>)}
          </NativeSelect>
        </Field>
        {hasFilters && (
          <Button type="button" variant="secondary" size="sm" onClick={() => { setQuery(""); setHealth(""); setEnvironment(""); }}>
            Clear filters
          </Button>
        )}
        <p aria-live="polite" className="ml-auto font-mono text-xs text-fg-subtle">
          {rows.length} of {servers.length} hosts
        </p>
      </div>

      {rows.length === 0 ? (
        <DataPanel>
          <EmptyState>{servers.length === 0 ? "No hosts are reporting. Install and configure the BlackWatch host agent to begin." : "No hosts match these filters."}</EmptyState>
        </DataPanel>
      ) : (
        <DataTable
          tableId="host-fleet-v2"
          ariaLabel="BlackWatch host fleet"
          columns={columns}
          data={rows}
          getRowId={(host) => host.instance_id}
        />
      )}
    </div>
  );
}
