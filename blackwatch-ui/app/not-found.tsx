import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Page not found" };

// Shown for unknown URLs and for any page that calls notFound(). Offers the
// two places people usually meant to go instead of a dead end.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:py-16">
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-fg-subtle">404</p>
        <h1 className="font-display text-2xl font-semibold">We could not find that page</h1>
        <p className="text-sm text-fg-muted">
          The address may be mistyped, or the event, host or record it pointed to may no longer exist. Nothing was
          changed. Press <kbd className="rounded border border-line px-1 font-mono text-xs">/</kbd> to search.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary">
            <Link href="/">Back to overview</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/events">Browse events</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
