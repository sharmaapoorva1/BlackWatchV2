"use client";

import { useMemo } from "react";
import type { BlockPublicAccess, BucketStatus } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { TimestampCell } from "./TimestampCell";

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${className}`} />;
}

function PublicCell({ isPublic, reasons }: { isPublic: boolean; reasons: string[] | null }) {
  if (!isPublic) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-resolved" />
        <span className="text-fg-muted">private</span>
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-critical" />
        <span className="font-medium text-sev-critical">PUBLIC</span>
      </span>
      {reasons && reasons.length > 0 && <div className="text-xs text-fg-subtle">{reasons.join(", ")}</div>}
    </div>
  );
}

function VersioningCell({ versioning, mfaDelete }: { versioning: string | null; mfaDelete: boolean | null }) {
  if (versioning === "Enabled") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-resolved" />
        <span className="text-fg-muted">
          Enabled
          {mfaDelete && <span className="ml-1 text-fg-subtle">· MFA</span>}
        </span>
      </span>
    );
  }
  if (versioning === "Suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-medium" />
        <span className="text-sev-medium">Suspended</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Dot className="bg-fg-subtle" />
      <span className="text-fg-subtle">Disabled</span>
    </span>
  );
}

function BpaCell({ bpa }: { bpa: BlockPublicAccess | null }) {
  if (!bpa) return <span className="text-xs text-fg-subtle">not configured</span>;
  const allOn =
    bpa.block_public_acls && bpa.ignore_public_acls && bpa.block_public_policy && bpa.restrict_public_buckets;
  if (allOn) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-resolved" />
        <span className="text-fg-muted">all on</span>
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot className="bg-sev-medium" />
        <span className="text-sev-medium">partial</span>
      </span>
      <div className="font-mono text-xs text-fg-subtle">
        acls={String(bpa.block_public_acls)} · ig={String(bpa.ignore_public_acls)} · pol=
        {String(bpa.block_public_policy)} · rs={String(bpa.restrict_public_buckets)}
      </div>
    </div>
  );
}

function bpaRank(bpa: BlockPublicAccess | null): number {
  if (!bpa) return 0;
  const on = [bpa.block_public_acls, bpa.ignore_public_acls, bpa.block_public_policy, bpa.restrict_public_buckets].filter(Boolean).length;
  return on + 1;
}

export function BucketsDataTable({ buckets }: { buckets: BucketStatus[] }) {
  const columns = useMemo<ColumnDef<BucketStatus, unknown>[]>(
    () => [
      {
        id: "bucket",
        header: "Bucket",
        accessorFn: (b) => b.bucket_name,
        enableHiding: false,
        meta: { label: "Bucket", className: "relative" },
        cell: ({ row }) => (
          <>
            {row.original.public && (
              <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-sev-critical" />
            )}
            <div className="break-all font-mono text-xs text-fg">{row.original.bucket_name}</div>
          </>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        meta: { label: "Tags" },
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (!tags || Object.keys(tags).length === 0) return <span className="text-xs text-fg-disabled">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {Object.entries(tags).map(([key, value]) => (
                <code key={key} className="max-w-full break-words rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">
                  {key}={value}
                </code>
              ))}
            </div>
          );
        },
      },
      {
        id: "region",
        header: "Region",
        accessorFn: (b) => b.region ?? "",
        meta: { label: "Region", className: "font-mono text-xs text-fg-muted" },
        cell: ({ row }) => row.original.region ?? "—",
      },
      {
        id: "public",
        header: "Public",
        accessorFn: (b) => (b.public ? 1 : 0),
        sortDescFirst: true,
        meta: { label: "Public" },
        cell: ({ row }) => <PublicCell isPublic={row.original.public} reasons={row.original.public_reasons} />,
      },
      {
        id: "encryption",
        header: "Encryption",
        accessorFn: (b) => b.encryption,
        meta: { label: "Encryption" },
        cell: ({ row }) =>
          row.original.encryption === "none" ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Dot className="bg-sev-critical" />
              <span className="text-sev-critical">none</span>
            </span>
          ) : (
            <code className="font-mono text-xs text-fg-muted">{row.original.encryption}</code>
          ),
      },
      {
        id: "versioning",
        header: "Versioning",
        accessorFn: (b) => b.versioning ?? "",
        meta: { label: "Versioning" },
        cell: ({ row }) => <VersioningCell versioning={row.original.versioning} mfaDelete={row.original.mfa_delete} />,
      },
      {
        id: "bpa",
        header: "BPA",
        accessorFn: (b) => bpaRank(b.block_public_access),
        meta: { label: "Block public access" },
        cell: ({ row }) => <BpaCell bpa={row.original.block_public_access} />,
      },
      {
        id: "logging",
        header: "Logging",
        accessorFn: (b) => (b.logging_target ? 1 : 0),
        meta: { label: "Logging" },
        cell: ({ row }) =>
          row.original.logging_target ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Dot className="bg-sev-resolved" />
              <code className="break-all font-mono text-xs text-fg-muted">{row.original.logging_target}</code>
            </span>
          ) : (
            <span className="text-xs text-fg-subtle">off</span>
          ),
      },
      {
        id: "last_scan",
        header: "Last scan",
        accessorFn: (b) => (b.last_scan ? Date.parse(b.last_scan) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last scan", className: "whitespace-nowrap" },
        cell: ({ row }) =>
          row.original.last_scan ? <TimestampCell value={row.original.last_scan} /> : <span className="text-fg-disabled">—</span>,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="buckets-v2"
      ariaLabel="S3 buckets"
      columns={columns}
      data={buckets}
      getRowId={(b) => `${b.bucket_name}:${b.region ?? ""}`}
    />
  );
}
