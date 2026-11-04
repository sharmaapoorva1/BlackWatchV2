"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { IamPostureRow, IamRow } from "@/lib/iam-rows";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { IpCell } from "./IpCell";
import { EventLink } from "./EventPeek";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

function OutcomePill({ outcome }: { outcome: string | null }) {
  const ok = outcome === "success";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", ok ? "bg-sev-resolved" : "bg-sev-critical")} />
      <span className={ok ? "text-fg-muted" : "text-fg"}>{ok ? "success" : "FAILED"}</span>
    </span>
  );
}

function LoginKindPill({ kind }: { kind: string }) {
  const cls =
    kind === "root"
      ? "border-sev-critical/40 bg-sev-critical/10 text-sev-critical"
      : kind === "sso"
        ? "border-signal/30 bg-signal/10 text-signal"
        : "border-line-soft bg-surface-1 text-fg-muted";
  return (
    <span className={clsx("inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-xs", cls)}>{kind}</span>
  );
}

export interface IamEventsTableProps {
  rows: IamRow[];
  tableId: string;
  ariaLabel: string;
  showOutcome?: boolean;
  showSourceIp?: boolean;
  showTarget?: boolean;
  showSgDetail?: boolean;
  showExposureDetail?: boolean;
  showLoginKind?: boolean;
}

export function IamEventsTable({
  rows,
  tableId,
  ariaLabel,
  showOutcome,
  showSourceIp,
  showTarget,
  showSgDetail,
  showExposureDetail,
  showLoginKind,
}: IamEventsTableProps) {
  const columns = useMemo<ColumnDef<IamRow, unknown>[]>(() => {
    const cols: ColumnDef<IamRow, unknown>[] = [
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Date.parse(r.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "relative whitespace-nowrap" },
        cell: ({ row }) => (
          <>
            <span
              aria-hidden
              className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(row.original.severity))}
            />
            <TimestampCell value={row.original.event_time} />
          </>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (r) => SEVERITY_RANK[r.severity ?? ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        id: "action",
        header: "Action",
        accessorFn: (r) => r.action,
        meta: { label: "Action", className: "break-all" },
        cell: ({ row }) => (
          <EventLink
            eventId={row.original.event_id}
            className="font-mono text-xs text-fg transition-colors hover:text-signal"
          >
            {row.original.action}
          </EventLink>
        ),
      },
    ];
    if (showLoginKind) {
      cols.push({
        id: "kind",
        header: "Kind",
        accessorFn: (r) => r.login_kind,
        meta: { label: "Kind" },
        cell: ({ row }) => <LoginKindPill kind={row.original.login_kind} />,
      });
    }
    cols.push({
      id: "actor",
      header: "Actor",
      accessorFn: (r) => r.principal ?? "",
      meta: { label: "Actor", className: "break-all text-xs text-fg" },
      cell: ({ row }) => row.original.principal ?? <span className="text-fg-disabled">—</span>,
    });
    if (showOutcome) {
      cols.push({
        id: "result",
        header: "Result",
        accessorFn: (r) => (r.outcome === "success" ? 1 : 0),
        meta: { label: "Result" },
        cell: ({ row }) => <OutcomePill outcome={row.original.outcome} />,
      });
    }
    if (showSourceIp) {
      cols.push({
        id: "source_ip",
        header: "Source IP",
        accessorFn: (r) => r.source_ip ?? "",
        meta: { label: "Source IP", className: "text-xs" },
        cell: ({ row }) => <IpCell value={row.original.source_ip} className="text-xs text-fg-muted" />,
      });
    }
    const detailLabel = showTarget
      ? showSgDetail
        ? "Target / detail"
        : showExposureDetail
          ? "Target / exposure flag"
          : "Target"
      : "Detail";
    cols.push({
      id: "detail",
      header: detailLabel,
      accessorFn: (r) => r.target,
      meta: { label: detailLabel, className: "break-words font-mono text-xs text-fg-muted" },
      cell: ({ row }) =>
        row.original.detail.map((segment, index) => (
          <span
            key={index}
            className={
              segment.tone === "critical"
                ? "text-sev-critical"
                : segment.tone === "medium"
                  ? "text-sev-medium"
                  : segment.tone === "strong"
                    ? "text-fg"
                    : undefined
            }
          >
            {segment.text}
          </span>
        )),
    });
    return cols;
  }, [showOutcome, showSourceIp, showTarget, showSgDetail, showExposureDetail, showLoginKind]);

  return (
    <DataTable
      tableId={tableId}
      ariaLabel={ariaLabel}
      columns={columns}
      data={rows}
      getRowId={(r) => r.event_id}
      initialSorting={[{ id: "time", desc: true }]}
    />
  );
}

export function IamPostureEventsTable({ rows }: { rows: IamPostureRow[] }) {
  const columns = useMemo<ColumnDef<IamPostureRow, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Date.parse(r.event_time) || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "relative whitespace-nowrap" },
        cell: ({ row }) => (
          <>
            <span
              aria-hidden
              className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(row.original.severity))}
            />
            <TimestampCell value={row.original.event_time} />
          </>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (r) => SEVERITY_RANK[r.severity ?? ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        id: "finding",
        header: "Finding",
        accessorFn: (r) => r.finding_type,
        meta: { label: "Finding" },
        cell: ({ row }) =>
          row.original.finding_id ? (
            <Link href={`/aws-posture/${row.original.finding_id}`} className="font-mono text-xs text-fg hover:text-signal">
              {row.original.finding_type}
            </Link>
          ) : (
            <span className="font-mono text-xs text-fg">{row.original.finding_type}</span>
          ),
      },
      {
        id: "region",
        header: "Region",
        accessorFn: (r) => r.region,
        meta: { label: "Region", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.region,
      },
      {
        id: "resource",
        header: "Resource",
        accessorFn: (r) => r.resource_id,
        meta: { label: "Resource", className: "break-all font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.resource_id,
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="iam-posture-events-v2"
      ariaLabel="New posture findings"
      columns={columns}
      data={rows}
      getRowId={(r) => r.event_id}
      initialSorting={[{ id: "time", desc: true }]}
    />
  );
}
