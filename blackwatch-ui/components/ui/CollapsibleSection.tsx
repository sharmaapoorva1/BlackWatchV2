"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// Collapsible group wrapper. Persists open/closed per `storageKey` in
// localStorage so operator's grouping state survives navigations.
// Defaults to open on first visit.
export function CollapsibleSection({
  storageKey,
  title,
  subtitle,
  count,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  storageKey: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);
  const panelId = `collapsible-${useId().replace(/:/g, "")}`;
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (isControlled) {
      setHydrated(true);
      return;
    }
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === "0") setInternalOpen(false);
      else if (v === "1") setInternalOpen(true);
    } catch {}
    setHydrated(true);
  }, [isControlled, storageKey]);

  useEffect(() => {
    if (!hydrated || isControlled) return;
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [open, storageKey, hydrated, isControlled]);

  function toggle() {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className="mb-3 border border-line bg-surface">
      <button type="button" onClick={toggle} aria-controls={panelId} aria-expanded={open} id={`${panelId}-header`} className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70 sm:min-h-10">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span className="text-xs uppercase tracking-[0.1em]">{title}</span>
        {typeof count === "number" && <span className="ml-1 font-mono text-[10px] text-muted">[{count}]</span>}
        {subtitle && <span className="ml-1 text-[11px] text-subtle">{subtitle}</span>}
      </button>
      <div id={panelId} hidden={!open} className="px-3 pb-3">{children}</div>
    </section>
  );
}
