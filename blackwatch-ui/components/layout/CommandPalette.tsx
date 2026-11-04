"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Globe, Search, ServerCog, Activity } from "lucide-react";
import { ALL_NAV_ITEMS, type NavIcon } from "./nav-config";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: NavIcon;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANCE_RE = /^i-[0-9a-f]{8,17}$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const CHORDS = new Map(
  ALL_NAV_ITEMS.filter((item) => item.chord).map((item) => [item.chord as string, item.href]),
);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Items the palette offers for the current query. Exported for reuse/tests. */
export function buildPaletteItems(rawQuery: string): PaletteItem[] {
  const query = rawQuery.trim();
  const needle = query.toLowerCase();
  const items: PaletteItem[] = [];

  if (query) {
    if (UUID_RE.test(query)) {
      items.push({ id: "event", label: `Open event ${query}`, href: `/events/${encodeURIComponent(query)}`, icon: Activity });
    }
    if (INSTANCE_RE.test(query)) {
      items.push({ id: "host", label: `Open host ${query}`, href: `/hosts/${encodeURIComponent(query)}`, icon: ServerCog });
    }
    if (IPV4_RE.test(query)) {
      items.push({ id: "ip", label: `Look up IP ${query}`, hint: "Threat intel and geo", href: `/tools/ip-lookup?ip=${encodeURIComponent(query)}`, icon: Globe });
    }
    items.push({
      id: "events-search",
      label: `Search events for “${query}”`,
      hint: "Actor, target, action, IP",
      href: `/events?q=${encodeURIComponent(query)}`,
      icon: Search,
    });
  }

  for (const nav of ALL_NAV_ITEMS) {
    const haystack = `${nav.label} ${nav.keywords ?? ""}`.toLowerCase();
    if (!needle || haystack.includes(needle)) {
      items.push({
        id: `nav:${nav.href}`,
        label: nav.label,
        hint: nav.chord ? `g then ${nav.chord}` : undefined,
        href: nav.href,
        icon: nav.icon,
      });
    }
  }
  return items;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chordArmed = useRef(false);

  const items = useMemo(() => buildPaletteItems(query), [query]);
  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  // Global shortcuts: Ctrl/Cmd+K and "/" open the palette; "g" then a letter
  // jumps to a page. Ignored while typing in a field.
  useEffect(() => {
    const disarm = () => {
      chordArmed.current = false;
      if (chordTimer.current) clearTimeout(chordTimer.current);
      chordTimer.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || open) return;
      if (event.key === "/") {
        event.preventDefault();
        onOpenChange(true);
        return;
      }
      if (chordArmed.current) {
        const href = CHORDS.get(event.key.toLowerCase());
        disarm();
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }
      if (event.key === "g") {
        chordArmed.current = true;
        chordTimer.current = setTimeout(disarm, 1200);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      disarm();
    };
  }, [open, onOpenChange, router]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    router.push(item.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(items.length ? (activeIndex + 1) % items.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(items.length ? (activeIndex - 1 + items.length) % items.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[activeIndex]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Content
          className="fixed left-1/2 top-[12vh] z-[61] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 border border-line bg-surface-1 shadow-2xl focus:outline-none"
          aria-describedby="command-palette-desc"
        >
          <Dialog.Title className="sr-only">Search and jump</Dialog.Title>
          <Dialog.Description id="command-palette-desc" className="sr-only">
            Type to search events or an IP, host or event id, or choose a page. Use arrow keys and Enter.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={15} aria-hidden="true" className="shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              aria-activedescendant={items.length ? `command-palette-item-${activeIndex}` : undefined}
              aria-label="Search events, IPs, hosts or pages"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search events, an IP, host or event id, or jump to a page"
              className="min-h-12 w-full bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
            />
          </div>
          <ul
            id="command-palette-list"
            ref={listRef}
            role="listbox"
            aria-label="Results"
            className="max-h-[50vh] overflow-y-auto py-1"
          >
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted">Nothing matches.</li>}
            {items.map((item, index) => {
              const Icon = item.icon;
              const selected = index === activeIndex;
              return (
                <li
                  key={item.id}
                  id={`command-palette-item-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(item)}
                  className={`mx-1 flex min-h-10 cursor-pointer items-center gap-3 rounded px-3 text-sm ${selected ? "bg-signal/10 text-fg" : "text-fg-muted"}`}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 font-mono text-xs text-fg-subtle">{item.hint}</span>}
                  {selected && <CornerDownLeft size={12} aria-hidden="true" className="shrink-0 text-fg-subtle" />}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-4 border-t border-line-soft px-3 py-2 text-xs text-fg-subtle">
            <span>↑↓ move</span>
            <span>↵ open</span>
            <span>esc close</span>
            <span className="ml-auto hidden sm:inline">Press / anywhere to search</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
