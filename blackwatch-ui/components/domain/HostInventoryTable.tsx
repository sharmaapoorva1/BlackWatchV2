"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/Input";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

export interface HostInventoryRow {
  key: string;
  cells: string[];
}

export function HostInventoryTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Array<{ label: string; mono?: boolean }>;
  rows: HostInventoryRow[];
}) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => row.cells.join(" ").toLocaleLowerCase().includes(normalized));
  }, [query, rows]);
  const tableId = `host-${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const tableColumns = useMemo<ColumnDef<HostInventoryRow, unknown>[]>(
    () =>
      columns.map((column, index) => ({
        id: `col-${index}`,
        header: column.label,
        accessorFn: (row) => row.cells[index] ?? "",
        meta: {
          label: column.label,
          className: `max-w-[32rem] break-words text-xs ${column.mono ? "font-mono text-fg-muted" : "text-fg"}`,
        },
        cell: ({ row }) => row.original.cells[index] || "—",
      })),
    [columns],
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <Input
          aria-label={`Search ${title}`}
          autoComplete="off"
          className="max-w-sm"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${title.toLocaleLowerCase()}…`}
          type="search"
          value={query}
        />
        <span aria-live="polite" className="font-mono text-[11px] text-fg-subtle">
          {filteredRows.length} of {rows.length}
        </span>
      </div>
      <DataTable
        tableId={`${tableId}-v2`}
        ariaLabel={title}
        columns={tableColumns}
        data={filteredRows}
        getRowId={(row) => row.key}
        emptyMessage={rows.length === 0 ? "No inventory reported." : "No rows match this search."}
      />
    </div>
  );
}
