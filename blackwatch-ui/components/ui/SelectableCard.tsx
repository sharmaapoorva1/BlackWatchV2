"use client";


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
    <label className={`relative block border p-3 transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-fg-muted"} ${error ? "border-danger" : checked ? "border-signal bg-surface" : "border-line bg-canvas"}`}>
      <span className="flex w-full items-start gap-2">
        <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-signal)]" />
        <span className={`min-w-0 text-sm ${checked ? "text-fg" : "text-muted"}`}><span className="block">{title}</span>{description && <span className="mt-1 block text-[11px] text-subtle">{description}</span>}</span>
      </span>
    </label>
  );
}
