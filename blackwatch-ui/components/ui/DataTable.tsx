"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { LiveRegion } from "./LiveRegion";
import { TablePagination } from "./Pagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_EVENT,
  readTablePageSize,
} from "./TablePreferences";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain-text column name: shown in the Columns menu and as the mobile card label. */
    label?: string;
    /** Extra classes for this column's cells. */
    className?: string;
    /** Extra classes for this column's header cell. */
    headerClassName?: string;
    /** Marks a row-actions column: right-aligned, labelled "Actions" in card mode, never hidden. */
    isActions?: boolean;
  }
}

const MIN_COLUMN_WIDTH = 72;
const MAX_COLUMN_WIDTH = 1200;

function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private browsing): preferences last for this view only */
  }
}

const isVisibilityState = (value: unknown): value is VisibilityState =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "boolean");

const isWidths = (value: unknown): value is Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.values(value).every(
    (entry) => typeof entry === "number" && entry >= MIN_COLUMN_WIDTH && entry <= MAX_COLUMN_WIDTH,
  );

export interface DataTableProps<TData> {
  /** Column definitions. Use `meta.label` for any column whose header is not plain text. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Stable id: column visibility and widths are remembered per table id. */
  tableId: string;
  ariaLabel: string;
  getRowId?: (row: TData, index: number) => string;
  initialSorting?: SortingState;
  emptyMessage?: ReactNode;
  /** Extra classes for a body row (e.g. a state tint). */
  rowClassName?: (row: Row<TData>) => string | undefined;
  /** Stack rows as cards on narrow screens (default). Pass false to scroll horizontally instead. */
  responsive?: boolean;
}

/**
 * Data-driven table built on TanStack Table with the project's table styling.
 * It keeps everything the JSX-children `Table` provides: sortable headers with
 * `aria-sort`, a Columns menu, drag-to-resize, per-browser page size, mobile
 * card layout, and live-region announcements. Use it for new tables and
 * migrate old ones when they are next touched; columns are defined in a client
 * file because cell renderers are functions.
 */
export function DataTable<TData>({
  columns,
  data,
  tableId,
  ariaLabel,
  getRowId,
  initialSorting = [],
  emptyMessage = "Nothing to show.",
  rowClassName,
  responsive = true,
}: DataTableProps<TData>) {
  const visibilityKey = `bw-datatable-visibility-v1-${tableId}`;
  const widthKey = `bw-datatable-widths-v1-${tableId}`;

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  });
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Restore per-browser preferences after mount (never during SSR).
  useEffect(() => {
    setColumnVisibility(readStored(visibilityKey, {}, isVisibilityState));
    setColumnWidths(readStored(widthKey, {}, isWidths));
    setPagination({ pageIndex: 0, pageSize: readTablePageSize() });
    setHydrated(true);
  }, [visibilityKey, widthKey]);

  useEffect(() => {
    const apply = () => setPagination({ pageIndex: 0, pageSize: readTablePageSize() });
    window.addEventListener(TABLE_PAGE_SIZE_EVENT, apply);
    return () => window.removeEventListener(TABLE_PAGE_SIZE_EVENT, apply);
  }, []);

  useEffect(() => {
    if (hydrated) writeStored(visibilityKey, columnVisibility);
  }, [hydrated, visibilityKey, columnVisibility]);

  useEffect(() => {
    if (hydrated) writeStored(widthKey, columnWidths);
  }, [hydrated, widthKey, columnWidths]);

  const onSortingChange = useCallback<OnChangeFn<SortingState>>((updater) => {
    setSorting((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const first = next[0];
      setMessage(first ? `Sorted ${first.desc ? "descending" : "ascending"}.` : "Sorting cleared.");
      return next;
    });
  }, []);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, columnVisibility, pagination },
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Pages re-render with a fresh `data` array on every auto-refresh. Without
    // this the table would jump back to page 1 every few seconds.
    autoResetPageIndex: false,
  });

  const total = table.getPrePaginationRowModel().rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  // If the data shrinks (a refresh, a new filter) keep the page index valid.
  useEffect(() => {
    setPagination((current) =>
      current.pageIndex > pageCount - 1 ? { ...current, pageIndex: pageCount - 1 } : current,
    );
  }, [pageCount]);

  const startResize = (columnId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth =
      columnWidths[columnId] ?? event.currentTarget.parentElement?.getBoundingClientRect().width ?? 120;
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX),
      );
      setColumnWidths((current) => ({ ...current, [columnId]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div className="min-w-0">
      <LiveRegion message={message} />
      <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-line bg-surface [[data-panel]_&]:rounded-none [[data-panel]_&]:border-0">
      {hideableColumns.length > 1 && (
        <div className="flex justify-end border-b border-line-soft px-2 py-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                <Columns3 size={14} aria-hidden="true" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel className="text-xs text-fg-subtle">Visible columns</DropdownMenuLabel>
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  // Keep the menu open so several columns can be toggled at once.
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => {
                    column.toggleVisibility(checked);
                    const name = column.columnDef.meta?.label ?? column.id;
                    setMessage(`${name} ${checked ? "shown" : "hidden"}.`);
                  }}
                >
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  table.resetColumnVisibility();
                  setColumnWidths({});
                  setSorting(initialSorting);
                  setMessage("Columns restored.");
                }}
              >
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className={cn("bw-table-shell max-w-full bg-surface", responsive && "bw-table-shell-cards")}>
        <table className="bw-table w-full border-collapse text-sm" data-responsive={responsive ? "cards" : "scroll"} aria-label={ariaLabel}>
          <thead className="border-b border-line bg-surface-2 text-left text-xs text-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="h-10">
                {group.headers.map((header) => {
                  const column = header.column;
                  const canSort = column.getCanSort();
                  const sorted = column.getIsSorted();
                  const width = columnWidths[column.id];
                  const label = column.columnDef.meta?.label ?? column.id;
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      data-actions={column.columnDef.meta?.isActions ? true : undefined}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                      style={width !== undefined ? { width, minWidth: width } : undefined}
                      className={cn("relative whitespace-nowrap px-3 py-2 font-semibold", column.columnDef.meta?.headerClassName)}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          title={`Sort by ${label}`}
                          className="inline-flex min-h-11 w-full items-center justify-between gap-2 pr-2 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70 sm:min-h-8"
                        >
                          <span>{flexRender(column.columnDef.header, header.getContext())}</span>
                          <SortIcon size={13} aria-hidden="true" className={sorted ? "text-signal" : "text-fg-subtle"} />
                        </button>
                      ) : (
                        flexRender(column.columnDef.header, header.getContext())
                      )}
                      <button
                        type="button"
                        aria-label={`Resize ${label}`}
                        title="Resize column"
                        onPointerDown={(event) => startResize(column.id, event)}
                        className="bw-col-resize-handle cursor-col-resize touch-none border-0 bg-transparent p-0 after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-line-soft hover:after:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70"
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr data-empty="true">
                <td colSpan={Math.max(visibleColumnCount, 1)} className="bw-empty px-4 py-8 text-center text-sm text-fg-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={cn("transition-colors hover:bg-surface-2/60", rowClassName?.(row))}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      data-label={cell.column.columnDef.meta?.label ?? cell.column.id}
                      data-actions={cell.column.columnDef.meta?.isActions ? true : undefined}
                      className={cn(
                        "px-3 py-2 align-top",
                        cell.column.columnDef.meta?.isActions && "whitespace-nowrap text-right",
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={pagination.pageIndex}
        pageSize={pagination.pageSize}
        total={total}
        onPageChange={(page) => {
          setPagination((current) => ({ ...current, pageIndex: page }));
          setMessage(`Showing page ${page + 1} of ${pageCount}.`);
        }}
        onPageSizeChange={(size) => {
          setPagination({ pageIndex: 0, pageSize: size });
          setMessage(`Showing ${size} rows per page.`);
        }}
      />
      </div>
    </div>
  );
}

export type { ColumnDef } from "@tanstack/react-table";
