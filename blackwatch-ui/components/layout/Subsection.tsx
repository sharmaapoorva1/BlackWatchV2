"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Event the section navigator fires so a collapsed block opens before scrolling to it. */
export const EXPAND_EVENT = "bw:expand-subsection";

/**
 * A titled, collapsible block inside a `Section` (the h3 level). Large
 * inventories (processes, packages, units) start collapsed so you can scroll
 * past them; the header always shows what is inside (the count) and the
 * section navigator can jump straight to it, opening it on the way.
 *
 * Content stays mounted while collapsed, so tables keep their sort, page and
 * column choices.
 */
export function Subsection({
  id,
  title,
  count,
  summary,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  /** Number of records inside, shown next to the title. */
  count?: number;
  /** One short line on the right: mode, scope or freshness. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id}-body`;

  useEffect(() => {
    // Arriving with #id in the URL, or via the navigator, opens this block.
    if (window.location.hash === `#${id}`) setOpen(true);
    const onExpand = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) setOpen(true);
    };
    window.addEventListener(EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(EXPAND_EVENT, onExpand);
  }, [id]);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-[calc(var(--sticky-header-h,0px)+1rem)]">
      <h3 id={`${id}-title`} className="m-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-1 px-3 text-left transition-colors hover:border-signal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-10"
        >
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={cn("shrink-0 text-fg-subtle transition-transform", open && "rotate-90")}
          />
          <span className="text-sm font-semibold text-fg">{title}</span>
          {count !== undefined && (
            <span className="rounded border border-line-soft px-1.5 font-mono text-xs text-fg-muted">{count}</span>
          )}
          {summary && <span className="ml-auto hidden min-w-0 truncate text-xs font-normal text-fg-subtle sm:block">{summary}</span>}
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="mt-3 min-w-0">
        {children}
      </div>
    </section>
  );
}
