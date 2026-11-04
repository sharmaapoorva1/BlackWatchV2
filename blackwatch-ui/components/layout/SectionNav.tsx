"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EXPAND_EVENT } from "./Subsection";

export interface NavItem {
  id: string;
  label: string;
  count?: number;
}

export interface NavGroup extends NavItem {
  /** Subsections inside this section. */
  items?: NavItem[];
}

/**
 * "On this page": a table of contents for a long detail page. On wide screens
 * it is a sticky sidebar next to the content; on narrow screens it is a normal
 * (non-sticky) disclosure at the top, so nothing floats over the content.
 * The section you are reading is highlighted as you scroll, and clicking an
 * entry scrolls to it, opening it first if it is collapsed.
 */
export function SectionNav({ groups, label = "On this page" }: { groups: NavGroup[]; label?: string }) {
  const [activeId, setActiveId] = useState<string>(groups[0]?.id ?? "");
  const disclosure = useRef<HTMLDetailsElement>(null);

  const allIds = useMemo(() => groups.flatMap((group) => [group.id, ...(group.items ?? []).map((item) => item.id)]), [groups]);
  const activeGroup =
    groups.find((group) => group.id === activeId || (group.items ?? []).some((item) => item.id === activeId))?.id ?? groups[0]?.id;

  // Scroll-spy: the entry nearest the top of the scrolling area is "current".
  useEffect(() => {
    const root = document.getElementById("main-content");
    const targets = allIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        if (visible.size === 0) return;
        const [topmost] = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        setActiveId(topmost);
      },
      { root, rootMargin: "0px 0px -65% 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [allIds]);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<string>(EXPAND_EVENT, { detail: id }));
    setActiveId(id);
    if (disclosure.current) disclosure.current.open = false;
    // Wait a frame so an expanded block has its final height before scrolling.
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    });
  };

  const list = (
    <ul className="flex flex-col gap-0.5">
      {groups.map((group) => {
        const current = group.id === activeGroup;
        return (
          <li key={group.id}>
            <a
              href={`#${group.id}`}
              onClick={(event) => go(event, group.id)}
              aria-current={activeId === group.id ? "location" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 lg:min-h-8",
                current ? "bg-signal/10 font-medium text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
              )}
            >
              <span className="truncate">{group.label}</span>
              {group.count !== undefined && <span className="font-mono text-xs text-fg-subtle">{group.count}</span>}
            </a>
            {current && group.items && group.items.length > 0 && (
              <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(event) => go(event, item.id)}
                      aria-current={activeId === item.id ? "location" : undefined}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 lg:min-h-7",
                        activeId === item.id ? "text-signal" : "text-fg-subtle hover:text-fg",
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.count !== undefined && <span className="font-mono">{item.count}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label={label}>
      <details ref={disclosure} className="rounded-md border border-line bg-surface-1 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-medium text-fg">{label}</summary>
        <div className="border-t border-line-soft p-2">{list}</div>
      </details>
      <div className="hidden lg:block">
        <p className="mb-2 px-3 text-xs font-medium text-fg-muted">{label}</p>
        {list}
      </div>
    </nav>
  );
}
