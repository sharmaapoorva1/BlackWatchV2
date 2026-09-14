"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Accordion, AccordionDetails, AccordionSummary, Badge, Typography } from "@mui/material";

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
    <Accordion expanded={open} onChange={toggle} disableGutters sx={{ mb: 1.5, border: 1, borderColor: "divider", bgcolor: "background.paper", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} aria-controls={panelId} id={`${panelId}-header`}>
        <Typography sx={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</Typography>
        {typeof count === "number" && <Typography component="span" sx={{ ml: 1, fontFamily: "monospace", fontSize: 10, color: "text.secondary" }}>[{count}]</Typography>}
        {subtitle && <Typography component="span" variant="caption" sx={{ ml: 1 }}>{subtitle}</Typography>}
      </AccordionSummary>
      <AccordionDetails id={panelId}>{children}</AccordionDetails>
    </Accordion>
  );
}
