"use client";

import { useState, useId } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "./Button";

// Collapsible section with a caret + label trigger. Used anywhere a form
// has an optional-detail area (advanced settings, custom message template,
// per-rule overrides). Consistent with the rest of BW: text-fg-subtle
// uppercase micro-label, focus ring in signal color, no motion beyond a
// 150ms caret rotate — matches the "forensic minimalism" aesthetic.
//
// State (8): default · hover · focus-visible · active (press) · open
//            · closed · disabled — collapse never has loading/error/success,
//            those live on the children.
export function Disclosure({
  label,
  defaultOpen = false,
  disabled = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => !disabled && setOpen((s) => !s)}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        className="min-h-6 px-0 text-[11px] uppercase tracking-[0.08em]"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />{label}
      </Button>
      {/* Keep children mounted when collapsed so form fields inside them
          still contribute to FormData on submit — hide visually via
          `hidden`. Screen readers get correct aria-expanded semantics. */}
      <div id={panelId} hidden={!open} className="pl-2">{children}</div>
    </div>
  );
}
