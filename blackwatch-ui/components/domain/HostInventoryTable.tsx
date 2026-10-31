"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/Input";
import { Table, TableEmpty } from "@/components/ui/Table";

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
      <Table tableId={tableId} ariaLabel={title}>
        <thead>
          <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            {columns.map((column) => (
              <th key={column.label} className="whitespace-nowrap px-3 py-2 text-left font-normal">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <TableEmpty columns={columns.length}>
              {rows.length === 0 ? "No inventory reported." : "No rows match this search."}
            </TableEmpty>
          ) : filteredRows.map((row) => (
            <tr key={row.key} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.key}-${index}`}
                  className={`max-w-[32rem] break-words px-3 py-2 text-xs ${columns[index]?.mono ? "font-mono text-fg-muted" : "text-fg"}`}
                >
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
