"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { TABLE_PAGE_SIZES } from "./TablePreferences";
import { NativeSelect } from "./NativeSelect";

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-3 py-2.5">
      <span aria-live="polite" className="font-mono text-[11px] text-muted">
        {first}–{last} <span className="text-fg-disabled">of</span> {total}
      </span>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">Rows <NativeSelect value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="w-[78px]" aria-label="Rows per page">
          {TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </NativeSelect></label>
        <span className="min-w-16 text-center font-mono text-[11px] text-muted">
          {page + 1} / {pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
