"use client";

import { Box, FormControlLabel, Radio, Checkbox, Typography } from "@mui/material";

// Radio-as-card and checkbox-as-card in one primitive. Used anywhere a
// form asks "pick one of these things" (metric, scope, channel) — the
// visible target is a titled card, but the underlying input is a real
// <input type="radio"> or <input type="checkbox"> so FormData + keyboard
// nav + a11y announcements work unmodified.
//
// Consistent visual grammar with the rest of BW: line-soft border,
// surface-2 fill when active, signal color on hover and focus, no
// motion beyond a 150ms color transition.
//
// State (8): default · hover · focus-visible · active (press) · selected
//            · disabled · loading (parent-controlled aria-busy on form) ·
//            error (parent sets `error`). No self-owned loading; the
//            card is passive — its parent form drives async work.
export function SelectableCard({
  type,
  name,
  value,
  checked,
  onChange,
  title,
  description,
  disabled = false,
  error = false,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <Box component="label" sx={{ position: "relative", display: "block", cursor: disabled ? "not-allowed" : "pointer", border: 1, borderColor: error ? "error.main" : checked ? "signal.main" : "divider", bgcolor: checked ? "background.paper" : "background.default", p: 1.5, opacity: disabled ? 0.5 : 1, transition: "border-color 150ms ease, background-color 150ms ease", "&:hover": { borderColor: disabled ? "divider" : "text.secondary" } }}>
      <FormControlLabel
        sx={{ m: 0, width: "100%", alignItems: "flex-start", gap: 1 }}
        control={type === "radio" ? <Radio size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} /> : <Checkbox size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />}
        label={<Box sx={{ minWidth: 0 }}><Typography variant="body2" color={checked ? "text.primary" : "text.secondary"}>{title}</Typography>{description && <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>{description}</Typography>}</Box>}
      />
      {checked && <input type="hidden" name={name} value={value} />}
    </Box>
  );
}
