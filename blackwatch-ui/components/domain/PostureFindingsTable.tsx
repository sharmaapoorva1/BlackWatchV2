"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { PostureFinding } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { SeverityBadge, severityBorderBg } from "./SeverityBadge";
import { TimestampCell } from "./TimestampCell";

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

/** Findings for one resource type; most severe first. */
export function PostureFindingsTable({
  findings,
  tableId,
  ariaLabel,
}: {
  findings: PostureFinding[];
  tableId: string;
  ariaLabel: string;
}) {
  const columns = useMemo<ColumnDef<PostureFinding, unknown>[]>(
    () => [
      {
        id: "severity",
        header: "Severity",
        accessorFn: (finding) => SEVERITY_RANK[String(finding.severity)] ?? 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Severity", className: "relative" },
        cell: ({ row }) => (
          <>
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute left-0 top-0 h-full w-0.5",
                severityBorderBg(String(row.original.severity)),
              )}
            />
            <SeverityBadge severity={String(row.original.severity)} />
          </>
        ),
      },
      {
        id: "resource",
        header: "Resource",
        accessorFn: (finding) => finding.resource_id,
        meta: { label: "Resource", className: "break-all font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.resource_id,
      },
      {
        id: "finding",
        header: "Finding",
        accessorFn: (finding) => finding.finding_type,
        meta: { label: "Finding" },
        cell: ({ row }) => (
          <Link
            href={`/aws-posture/${row.original.finding_id}`}
            className="font-mono text-xs text-fg transition-colors hover:text-signal"
          >
            {row.original.finding_type}
          </Link>
        ),
      },
      {
        id: "region",
        header: "Region",
        accessorFn: (finding) => finding.region ?? "",
        meta: { label: "Region", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.region ?? "—",
      },
      {
        id: "last_seen",
        header: "Last seen",
        accessorFn: (finding) => Date.parse(finding.last_seen) || 0,
        sortDescFirst: true,
        meta: { label: "Last seen", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.last_seen} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId={tableId}
      ariaLabel={ariaLabel}
      columns={columns}
      data={findings}
      getRowId={(finding) => finding.finding_id}
      initialSorting={[{ id: "severity", desc: true }]}
    />
  );
}
