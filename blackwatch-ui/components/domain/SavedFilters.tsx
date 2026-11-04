"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, X } from "lucide-react";

// Per-browser saved filters for a list page. A filter is just the page's query
// string, so saving, sharing and restoring all reuse the URL that is already
// the source of truth. Stored in localStorage under a key per page.

type SavedFilter = { name: string; query: string };

function load(storageKey: string): SavedFilter[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedFilter =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SavedFilter).name === "string" &&
        typeof (item as SavedFilter).query === "string",
    );
  } catch {
    return [];
  }
}

function canonicalQuery(params: URLSearchParams): string {
  const copy = new URLSearchParams();
  [...params.entries()]
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => copy.append(key, value));
  return copy.toString();
}

export function SavedFilters({ storageKey }: { storageKey: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = canonicalQuery(new URLSearchParams(searchParams.toString()));
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setFilters(load(storageKey));
  }, [storageKey]);

  const persist = useCallback(
    (next: SavedFilter[]) => {
      setFilters(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage unavailable: filters last for this view only */
      }
    },
    [storageKey],
  );

  const alreadySaved = filters.some((filter) => filter.query === current);
  const canSave = current !== "" && !alreadySaved;

  if (filters.length === 0 && !canSave) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Saved filters" role="group">
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
        <Bookmark size={12} aria-hidden="true" /> Saved
      </span>
      {filters.map((filter) => {
        const active = filter.query === current;
        return (
          <span
            key={filter.query}
            className={`inline-flex items-center border text-xs ${active ? "border-signal text-fg" : "border-line text-fg-muted"}`}
          >
            <Link
              href={`${pathname}?${filter.query}`}
              aria-current={active ? "true" : undefined}
              className="inline-flex min-h-11 items-center px-2.5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
            >
              {filter.name}
            </Link>
            <button
              type="button"
              onClick={() => persist(filters.filter((item) => item.query !== filter.query))}
              aria-label={`Remove saved filter ${filter.name}`}
              className="inline-flex min-h-11 w-8 cursor-pointer items-center justify-center text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        );
      })}
      {canSave && !naming && (
        <button
          type="button"
          onClick={() => {
            setName("");
            setNaming(true);
          }}
          className="inline-flex min-h-11 cursor-pointer items-center border border-dashed border-line px-2.5 text-xs text-fg-muted hover:border-signal hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
        >
          Save current filter
        </button>
      )}
      {canSave && naming && (
        <form
          className="inline-flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            persist([...filters, { name: trimmed.slice(0, 40), query: current }]);
            setNaming(false);
          }}
        >
          <label className="sr-only" htmlFor="saved-filter-name">Filter name</label>
          <input
            id="saved-filter-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setNaming(false)}
            maxLength={40}
            placeholder="Name this filter"
            className="min-h-11 w-44 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center border border-signal px-2.5 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
