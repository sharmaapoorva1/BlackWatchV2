"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LiveRegion } from "@/components/ui/LiveRegion";
import {
  getRefreshState,
  getServerRefreshState,
  patchRefreshState,
  subscribeRefresh,
} from "@/lib/refresh-store";

// Calls router.refresh() on a fixed interval. Drop one of these into any
// page that should auto-update. Server components re-fetch transparently;
// the user sees no flicker because React reconciles the new tree.
//
// Pick the interval based on how fresh the surface needs to feel:
//   - /events, /notifications activity tail:        5_000
//   - /hosts heartbeats, /services probe results:  15_000
//   - /aws-posture findings:                        30_000
//
// The poller reports itself to the shared refresh store so the shell can show
// "updated Ns ago" and let the operator pause it (useful while reading or
// copying from a table that would otherwise re-render under the cursor).
//
// All polling is over normal HTTP — works behind any reverse proxy. No SSE,
// no WebSocket, no nginx tweak needed.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [message, setMessage] = useState("Live updates enabled.");
  const lastAnnouncement = useRef(0);
  const { paused } = useSyncExternalStore(subscribeRefresh, getRefreshState, getServerRefreshState);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    setMessage(paused ? "Live updates paused." : "Live updates enabled.");
  }, [paused]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    // The page that mounted us was just rendered by the server.
    patchRefreshState({ active: true, intervalMs, lastRefreshAt: Date.now() });

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => {
        if (pausedRef.current) return;
        router.refresh();
        patchRefreshState({ lastRefreshAt: Date.now() });
        // Do not make a screen reader repeat a five-second polling tick. A
        // periodic confirmation is enough; the visible page still refreshes
        // on every interval.
        const now = Date.now();
        if (now - lastAnnouncement.current >= 30_000) {
          lastAnnouncement.current = now;
          setMessage(`Live data refresh requested at ${new Date().toLocaleTimeString()}.`);
        }
      }, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      // Pause polling when the tab is in the background — saves a bunch of
      // backend calls when the operator has the dashboard open in a tab.
      if (document.hidden) stop();
      else {
        if (!pausedRef.current) {
          router.refresh();
          patchRefreshState({ lastRefreshAt: Date.now() });
        }
        start();
        setMessage("Live updates resumed.");
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      patchRefreshState({ active: false });
    };
  }, [router, intervalMs]);

  return <LiveRegion message={message} />;
}
