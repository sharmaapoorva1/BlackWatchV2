"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { VpnCertificate, VpnClient, VpnSession } from "@/lib/types";
import { certBand, certDaysLeft, certImpact, formatDuration, type CertBand, type RenewalItem } from "@/lib/vpn-view";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { TimestampCell } from "./TimestampCell";

// ---------------------------------------------------------------------------
// Connected clients
// ---------------------------------------------------------------------------

function fmtBytes(b: number | null | undefined): string {
  if (b == null) return "?";
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

export function VpnClientsTable({ clients, server }: { clients: VpnClient[]; server: string }) {
  const columns = useMemo<ColumnDef<VpnClient, unknown>[]>(
    () => [
      {
        id: "common_name",
        header: "Common name",
        accessorFn: (c) => c.common_name ?? "",
        enableHiding: false,
        meta: { label: "Common name", className: "font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.common_name ?? "—",
      },
      {
        id: "user",
        header: "User",
        accessorFn: (c) => c.username ?? "",
        meta: { label: "User", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.username ?? "—",
      },
      {
        id: "real_ip",
        header: "Real IP",
        accessorFn: (c) => c.real_ip ?? "",
        meta: { label: "Real IP", className: "text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.real_ip} className="text-xs text-fg-muted" />,
      },
      {
        id: "virtual_ip",
        header: "Virtual IP",
        accessorFn: (c) => c.virtual_address ?? "",
        meta: { label: "Virtual IP", className: "text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.virtual_address} className="text-xs text-fg-muted" />,
      },
      {
        id: "connected_since",
        header: "Connected since",
        accessorFn: (c) => (c.connected_since ? Date.parse(c.connected_since) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Connected since", className: "whitespace-nowrap font-mono text-xs text-fg-subtle" },
        cell: ({ row }) => row.original.connected_since ?? "—",
      },
      {
        id: "bytes",
        header: "Bytes rx / tx",
        accessorFn: (c) => (c.bytes_received ?? 0) + (c.bytes_sent ?? 0),
        sortDescFirst: true,
        meta: { label: "Bytes rx / tx", className: "text-right font-mono text-xs text-fg-muted", headerClassName: "text-right" },
        cell: ({ row }) => `${fmtBytes(row.original.bytes_received)} / ${fmtBytes(row.original.bytes_sent)}`,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId={`vpn-clients-${server}-v2`}
      ariaLabel={`Clients connected to ${server}`}
      columns={columns}
      data={clients}
      getRowId={(c, index) => `${c.common_name ?? "?"}-${c.real_ip ?? "?"}-${index}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

const BAND_STYLE: Record<CertBand, { borderClass: string; textClass: string }> = {
  expired: { borderClass: "bg-sev-critical", textClass: "text-sev-critical" },
  critical: { borderClass: "bg-sev-critical", textClass: "text-sev-critical" },
  high: { borderClass: "bg-sev-high", textClass: "text-sev-high" },
  warning: { borderClass: "bg-sev-medium", textClass: "text-sev-medium" },
  ok: { borderClass: "bg-transparent", textClass: "text-fg-muted" },
  unknown: { borderClass: "bg-fg-subtle", textClass: "text-fg-disabled" },
};

function bandFor(cert: VpnCertificate, now: number): { borderClass: string; textClass: string } {
  if (cert.error) return { borderClass: "bg-sev-medium", textClass: "text-sev-medium" };
  return BAND_STYLE[certBand(certDaysLeft(cert, now))];
}

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  return days < 0 ? `expired ${Math.abs(days).toFixed(0)}d ago` : `${days.toFixed(1)}d`;
}

function formatAbsolute(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // YYYY-MM-DD HH:mm UTC: concise, tabular, time-zone-stable.
    return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
  } catch {
    return iso;
  }
}

function SourcePill({ source }: { source?: string | null }) {
  const tone =
    source === "pki"
      ? "border-signal/30 text-signal"
      : source === "live"
        ? "border-line text-fg"
        : "border-line-soft text-fg-subtle";
  return (
    <span
      className={clsx("inline-flex items-center border px-1.5 py-0.5 font-mono text-xs", tone)}
      title={source === "pki" ? "easy-rsa source of truth" : source === "live" ? "what OpenVPN actually reads" : ""}
    >
      {source ?? "?"}
    </span>
  );
}

function KindPill({ kind, revoked }: { kind: string; revoked?: boolean }) {
  const tone =
    kind === "ca"
      ? "border-line text-fg"
      : kind === "server"
        ? "border-signal/40 text-signal"
        : kind === "crl"
          ? "border-line text-fg-muted"
          : revoked
            ? "border-line text-fg-disabled"
            : "border-line-soft text-fg-muted";
  return (
    <span className={clsx("inline-flex items-center border px-1.5 py-0.5 font-mono text-xs", tone)}>
      {revoked ? "revoked" : kind}
    </span>
  );
}

export function VpnCertsTable({
  certs,
  server,
  now,
  notDeployed = [],
}: {
  certs: VpnCertificate[];
  server: string;
  /** Page render time in ms, so days-left agree between server and browser. */
  now: number;
  /** Names whose live copy is older than the renewed PKI copy. */
  notDeployed?: string[];
}) {
  const columns = useMemo<ColumnDef<VpnCertificate, unknown>[]>(
    () => [
      {
        id: "source",
        header: "Source",
        accessorFn: (c) => c.source ?? "",
        enableHiding: false,
        meta: { label: "Source", className: "relative" },
        cell: ({ row }) => (
          <>
            <span
              aria-hidden
              className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", bandFor(row.original, now).borderClass)}
            />
            <SourcePill source={row.original.source} />
            {row.original.source === "live" && notDeployed.includes(row.original.name) && (
              <span className="ml-1.5 text-xs text-sev-high" title="A renewed copy exists in the PKI but OpenVPN is still using this older one">
                renewed, not deployed
              </span>
            )}
          </>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        accessorFn: (c) => c.kind,
        meta: { label: "Kind" },
        cell: ({ row }) => <KindPill kind={row.original.kind} revoked={row.original.revoked} />,
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (c) => c.name,
        meta: { label: "Name", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.name,
      },
      {
        id: "impact",
        header: "If it expires",
        enableSorting: false,
        meta: { label: "If it expires", className: "text-xs text-fg-muted" },
        cell: ({ row }) => certImpact(row.original),
      },
      {
        id: "subject",
        header: "Subject / path",
        enableSorting: false,
        meta: { label: "Subject / path", className: "break-all font-mono text-xs text-fg-muted" },
        cell: ({ row }) =>
          row.original.error ? (
            <span className="text-sev-critical" title={row.original.path ?? ""}>
              {row.original.error}
            </span>
          ) : (
            <span title={row.original.path ?? ""}>{row.original.subject ?? row.original.path ?? "—"}</span>
          ),
      },
      {
        id: "not_after",
        header: "Not after",
        accessorFn: (c) => (c.not_after ? Date.parse(c.not_after) || 0 : 0),
        meta: { label: "Not after", className: "whitespace-nowrap font-mono text-xs text-fg-muted" },
        cell: ({ row }) => (row.original.not_after ? formatAbsolute(row.original.not_after) : "—"),
      },
      {
        id: "days_left",
        header: "Days left",
        // Errors and unknowns sort last, matching the server-side default order.
        accessorFn: (c) => certDaysLeft(c, now) ?? Number.POSITIVE_INFINITY,
        meta: { label: "Days left", className: "text-right font-mono text-xs tabular-nums", headerClassName: "text-right" },
        cell: ({ row }) => <span className={bandFor(row.original, now).textClass}>{daysLabel(certDaysLeft(row.original, now))}</span>,
      },
    ],
    [now, notDeployed],
  );

  return (
    <DataTable
      tableId={`vpn-certs-${server}-v2`}
      ariaLabel={`Certificates on ${server}`}
      columns={columns}
      data={certs}
      getRowId={(c) => `${c.source ?? "?"}-${c.kind}-${c.name}-${c.path ?? ""}`}
      initialSorting={[{ id: "days_left", desc: false }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Renewal queue: what to renew next, across servers
// ---------------------------------------------------------------------------

export function VpnRenewalTable({ items, now }: { items: RenewalItem[]; now: number }) {
  const columns = useMemo<ColumnDef<RenewalItem, unknown>[]>(
    () => [
      {
        id: "certificate",
        header: "Certificate",
        accessorFn: (i) => i.cert.name,
        enableHiding: false,
        meta: { label: "Certificate", className: "relative break-all font-mono text-xs text-fg" },
        cell: ({ row }) => (
          <>
            <span aria-hidden className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", BAND_STYLE[row.original.band].borderClass)} />
            {row.original.cert.name}
          </>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        accessorFn: (i) => i.cert.kind,
        meta: { label: "Kind" },
        cell: ({ row }) => <KindPill kind={row.original.cert.kind} />,
      },
      {
        id: "server",
        header: "Server",
        accessorFn: (i) => i.server,
        meta: { label: "Server", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.server,
      },
      {
        id: "impact",
        header: "If it expires",
        enableSorting: false,
        meta: { label: "If it expires", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.impact,
      },
      {
        id: "expires",
        header: "Expires",
        accessorFn: (i) => (i.cert.not_after ? Date.parse(i.cert.not_after) || 0 : 0),
        meta: { label: "Expires", className: "whitespace-nowrap font-mono text-xs text-fg-muted" },
        cell: ({ row }) => (row.original.cert.not_after ? formatAbsolute(row.original.cert.not_after) : "—"),
      },
      {
        id: "days_left",
        header: "Days left",
        accessorFn: (i) => i.days ?? Number.POSITIVE_INFINITY,
        meta: { label: "Days left", className: "text-right font-mono text-xs tabular-nums", headerClassName: "text-right" },
        cell: ({ row }) => <span className={BAND_STYLE[row.original.band].textClass}>{daysLabel(row.original.days)}</span>,
      },
    ],
    [now],
  );

  return (
    <DataTable
      tableId="vpn-renewals-v2"
      ariaLabel="Certificates to renew next"
      columns={columns}
      data={items}
      getRowId={(i) => `${i.server}-${i.cert.kind}-${i.cert.name}`}
      initialSorting={[{ id: "days_left", desc: false }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Session history
// ---------------------------------------------------------------------------

export function VpnSessionsTable({ sessions, now }: { sessions: VpnSession[]; now: number }) {
  const columns = useMemo<ColumnDef<VpnSession, unknown>[]>(
    () => [
      {
        id: "identity",
        header: "User",
        accessorFn: (x) => x.identity,
        enableHiding: false,
        meta: { label: "User", className: "text-xs text-fg" },
        cell: ({ row }) => row.original.identity,
      },
      {
        id: "ip",
        header: "Source IP",
        accessorFn: (x) => x.real_ip ?? "",
        meta: { label: "Source IP", className: "text-xs text-fg-muted" },
        cell: ({ row }) => <IpCell value={row.original.real_ip} className="text-xs text-fg-muted" />,
      },
      {
        id: "server",
        header: "Server",
        accessorFn: (x) => x.server,
        meta: { label: "Server", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.server,
      },
      {
        id: "started",
        header: "Started",
        accessorFn: (x) => (x.started_at ? Date.parse(x.started_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Started", className: "whitespace-nowrap" },
        cell: ({ row }) => (row.original.started_at ? <TimestampCell value={row.original.started_at} /> : "—"),
      },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (x) => {
          if (!x.started_at) return 0;
          const end = x.ended_at ? Date.parse(x.ended_at) : now;
          return Math.max((end - Date.parse(x.started_at)) / 1000, 0);
        },
        sortDescFirst: true,
        meta: { label: "Duration", className: "whitespace-nowrap text-right font-mono text-xs tabular-nums text-fg-muted", headerClassName: "text-right" },
        cell: ({ row }) => {
          const x = row.original;
          if (!x.started_at) return "—";
          if (!x.ended_at) return <span className="text-sev-resolved">connected</span>;
          return formatDuration((Date.parse(x.ended_at) - Date.parse(x.started_at)) / 1000);
        },
      },
      {
        id: "bytes",
        header: "Data rx / tx",
        accessorFn: (x) => (x.bytes_received ?? 0) + (x.bytes_sent ?? 0),
        sortDescFirst: true,
        meta: { label: "Data rx / tx", className: "text-right font-mono text-xs text-fg-muted", headerClassName: "text-right" },
        cell: ({ row }) => (row.original.ended_at ? `${fmtBytes(row.original.bytes_received)} / ${fmtBytes(row.original.bytes_sent)}` : "—"),
      },
    ],
    [now],
  );

  return (
    <DataTable
      tableId="vpn-sessions-v2"
      ariaLabel="Recent VPN sessions"
      columns={columns}
      data={sessions}
      getRowId={(x, index) => `${x.server}-${x.identity}-${x.started_at ?? index}`}
      initialSorting={[{ id: "started", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Auth attempts
// ---------------------------------------------------------------------------

export interface VpnAuthRow {
  event_id: string;
  event_time: string;
  outcome: string | null;
  principal: string | null;
  source_ip: string | null;
}

export function VpnAuthTable({ rows }: { rows: VpnAuthRow[] }) {
  const columns = useMemo<ColumnDef<VpnAuthRow, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Date.parse(r.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.event_time} />,
      },
      {
        id: "result",
        header: "Result",
        accessorFn: (r) => (r.outcome === "success" ? 1 : 0),
        meta: { label: "Result" },
        cell: ({ row }) => {
          const ok = row.original.outcome === "success";
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", ok ? "bg-sev-resolved" : "bg-sev-critical")} />
              <span className={ok ? "text-fg-muted" : "text-fg"}>{ok ? "success" : "FAILED"}</span>
            </span>
          );
        },
      },
      {
        id: "user",
        header: "User",
        accessorFn: (r) => r.principal ?? "",
        meta: { label: "User", className: "text-xs text-fg" },
        cell: ({ row }) => (
          <Link href={`/events/${row.original.event_id}`} className="hover:text-signal">
            {row.original.principal ?? "—"}
          </Link>
        ),
      },
      {
        id: "source_ip",
        header: "Source IP",
        accessorFn: (r) => r.source_ip ?? "",
        meta: { label: "Source IP", className: "text-xs" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} className="text-xs text-fg-muted" />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="vpn-auth-v2"
      ariaLabel="Recent VPN auth attempts"
      columns={columns}
      data={rows}
      getRowId={(r) => r.event_id}
      initialSorting={[{ id: "time", desc: true }]}
    />
  );
}
