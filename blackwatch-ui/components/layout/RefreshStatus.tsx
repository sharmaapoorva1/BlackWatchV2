"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import clsx from "clsx";
import {
  formatAge,
  getRefreshState,
  getServerRefreshState,
  patchRefreshState,
  subscribeRefresh,
} from "@/lib/refresh-store";

// Right-aligned strip at the top of the page area. Appears only on pages that
// poll (they render <AutoRefresh>), and answers "is this live, and how old is
// what I am looking at?" with a way to freeze the page while reading.
export function RefreshStatus() {
  const { active, intervalMs, lastRefreshAt, paused } = useSyncExternalStore(
    subscribeRefresh,
    getRefreshState,
    getServerRefreshState,
  );
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  const age = lastRefreshAt !== null && now !== null ? formatAge(now - lastRefreshAt) : "just now";
  const seconds = Math.round(intervalMs / 1000);

  return (
    <div className="mb-3 flex items-center justify-end gap-3 text-xs text-fg-muted">
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className={clsx("h-1.5 w-1.5 rounded-full", paused ? "bg-sev-medium" : "bg-signal animate-signal-pulse")}
        />
        {paused ? "Paused" : `Live · every ${seconds}s`} · updated {age}
      </span>
      <button
        type="button"
        onClick={() => patchRefreshState({ paused: !paused })}
        aria-pressed={paused}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-line px-2.5 text-fg-muted transition-colors hover:border-signal hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-7"
      >
        {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
