"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { X, ExternalLink, Loader2 } from "lucide-react";

import {
  IpLookupResult,
  type IpApiResponse,
} from "./IpLookupResult";
import { investigationStartHref } from "@/lib/investigation-flow";
import { Button } from "@/components/ui/Button";

interface IpLookupModalProps {
  ip: string | null;
  onClose: () => void;
}

// Opens an in-page IP lookup. No navigation, no page transition. Fetches via
// the Next.js /api/tools/ip-lookup route (which aggregates the fast lookup
// and optional threat-intelligence sources).
export function IpLookupModal({ ip, onClose }: IpLookupModalProps) {
  const open = !!ip;
  const [result, setResult] = useState<IpApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ip) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    fetch(`/api/tools/ip-lookup?ip=${encodeURIComponent(ip)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json()) as IpApiResponse;
        if (!cancelled) setResult(data);
      })
      .catch((exc) => {
        if (!cancelled) setError(String(exc));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ip]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent aria-describedby={undefined} className="bg-canvas">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
            <DialogTitle className="font-mono text-xs text-fg-subtle">
              IP lookup · {ip}
            </DialogTitle>
            <div className="flex items-center gap-3">
              {ip && (
                <div className="flex items-center gap-3">
                  <Link
                    href={investigationStartHref(ip)}
                    className="inline-flex items-center gap-1 text-xs text-signal hover:text-fg"
                    onClick={onClose}
                  >
                    investigate <ExternalLink size={10} />
                  </Link>
                  <Link
                    href={`/tools/ip-lookup?ip=${encodeURIComponent(ip)}`}
                    className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
                    onClick={onClose}
                  >
                    open standalone tool <ExternalLink size={10} />
                  </Link>
                </div>
              )}
              <DialogClose asChild>
                <Button size="sm" variant="ghost"
                  type="button"
                  aria-label="Close"
                  className="text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                >
                  <X size={14} />
                </Button>
              </DialogClose>
            </div>
          </div>

          <div className="p-5">
            {loading && (
              <div className="flex items-center gap-2 py-6 text-sm text-fg-muted">
                <Loader2 size={14} className="animate-spin" />
                Looking up…
              </div>
            )}
            {error && !loading && (
              <div role="alert" aria-live="assertive" className="border border-sev-critical/40 bg-sev-critical/5 px-4 py-3 text-sm text-sev-critical">
                {error}
              </div>
            )}
            {result && !loading && (
              <IpLookupResult query={ip ?? ""} result={result} compact />
            )}
          </div>
        </DialogContent>
    </Dialog>
  );
}
