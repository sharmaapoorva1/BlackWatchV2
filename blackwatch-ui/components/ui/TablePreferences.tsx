"use client";

import { useEffect, useState } from "react";
import { NativeSelect } from "./NativeSelect";

export const TABLE_PAGE_SIZE_KEY = "bw.table.defaultPageSize";
export const TABLE_PAGE_SIZE_EVENT = "bw:table-page-size";
export const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_TABLE_PAGE_SIZE = 25;

export function readTablePageSize(): number {
  try {
    const value = Number(localStorage.getItem(TABLE_PAGE_SIZE_KEY));
    return TABLE_PAGE_SIZES.includes(value as (typeof TABLE_PAGE_SIZES)[number])
      ? value
      : DEFAULT_TABLE_PAGE_SIZE;
  } catch {
    return DEFAULT_TABLE_PAGE_SIZE;
  }
}

export function TablePageSizeSetting() {
  const [value, setValue] = useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    setValue(readTablePageSize());
  }, []);

  function onChange(next: number) {
    setValue(next);
    try {
      localStorage.setItem(TABLE_PAGE_SIZE_KEY, String(next));
      window.dispatchEvent(new CustomEvent(TABLE_PAGE_SIZE_EVENT, { detail: next }));
    } catch {
      // Browser storage can be unavailable in private browsing.
    }
  }

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm">Default table rows</p>
        <p className="mt-0.5 text-[11px] text-subtle">
          Applies to every table in this browser. You can still change an
          individual table temporarily from its footer.
        </p>
      </div>
      <NativeSelect value={String(value)} onChange={(event) => onChange(Number(event.target.value))} aria-label="Default rows per table" className="w-[120px]">
        {TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
      </NativeSelect>
    </div>
  );
}
