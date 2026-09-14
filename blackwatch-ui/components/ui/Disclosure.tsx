"use client";

import { useState, useId } from "react";
import { ChevronRight } from "lucide-react";
import { Box, Button, Collapse } from "@mui/material";

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
    <Box>
      <Button
        type="button"
        size="small"
        variant="text"
        color="inherit"
        startIcon={<ChevronRight size={12} strokeWidth={2} />}
        onClick={() => !disabled && setOpen((s) => !s)}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        sx={{ px: 0, color: "text.secondary", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", minHeight: 24, "& .MuiButton-startIcon": { transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms ease" }, "&:hover": { bgcolor: "transparent", color: "text.primary" } }}
      >
        {label}
      </Button>
      {/* Keep children mounted when collapsed so form fields inside them
          still contribute to FormData on submit — hide visually via
          `hidden`. Screen readers get correct aria-expanded semantics. */}
      <Collapse id={panelId} in={open} timeout="auto" unmountOnExit={false} sx={{ pl: 2 }}>
        {children}
      </Collapse>
    </Box>
  );
}
