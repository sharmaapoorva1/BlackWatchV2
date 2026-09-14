"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "warning" | "info";

// Classify by string smell. Server actions redirect with human-written msgs
// so we sniff obvious keywords instead of piping a structured kind through
// the URL.
function classify(msg: string): Kind {
  const m = msg.toLowerCase();
  if (/\btest:\s*sent\b/.test(m)) return "success";
  if (
    /\b(error|failed|unknown|invalid|no[_-]channel|no channel|denied)\b/.test(m)
  )
    return "error";
  if (/\b(warn|silenced|throttled|rate[_-]limited)\b/.test(m)) return "warning";
  if (
    /\b(saved|created|deleted|cleared|enabled|disabled|updated|off|on|test:)\b/.test(
      m,
    )
  )
    return "success";
  return "info";
}

const STYLES: Record<Kind, { severity: "success" | "error" | "warning" | "info"; icon: React.ComponentType<{ size?: number }> }> = {
  success: {
    icon: CheckCircle2,
    severity: "success",
  },
  error: {
    icon: XCircle,
    severity: "error",
  },
  warning: {
    icon: AlertTriangle,
    severity: "warning",
  },
  info: {
    icon: Info,
    severity: "info",
  },
};

// Prominent flash toast fed by ?msg=... URL params.
//
// Why client + auto-hide: the message stays in the URL until the user
// navigates or refreshes. Without auto-hide, stale banners linger. 4s is
// long enough to read, short enough not to feel sticky.
export function FlashToast({
  message,
  ttlMs = 4500,
}: {
  message: string;
  ttlMs?: number;
}) {
  const [visible, setVisible] = useState(true);
  const kind = classify(message);
  const style = STYLES[kind];
  const Icon = style.icon;

  useEffect(() => {
    // Strip ?msg= from the URL right away so a page refresh doesn't
    // re-render a stale banner. history.replaceState avoids a navigation.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("msg")) {
        url.searchParams.delete("msg");
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + (url.search ? url.search : "") + url.hash,
        );
      }
    }
    const t = setTimeout(() => setVisible(false), ttlMs);
    return () => clearTimeout(t);
  }, [ttlMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 flex items-start gap-2 border px-3 py-2.5 text-sm ${kind === "error" ? "border-danger/50 text-danger" : kind === "success" ? "border-sev-resolved/50 text-sev-resolved" : kind === "warning" ? "border-sev-high/50 text-sev-high" : "border-signal/50 text-signal"}`}
    >
      <Icon size={16} aria-hidden />
      <div className="flex w-full items-center justify-between gap-2">
        <span>{message}</span>
        <button
          type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
          className="shrink-0 p-1 text-current"
        ><X size={14} /></button>
      </div>
    </div>
  );
}
