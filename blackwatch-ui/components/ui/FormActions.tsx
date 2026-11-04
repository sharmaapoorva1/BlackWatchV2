"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PendingButton } from "./PendingButton";

/**
 * The submit bar at the bottom of a form: one primary button that shows a
 * spinner and locks while the server action runs (and for read-only users),
 * plus an optional cancel link. Must be rendered inside the `<form>`.
 */
export function FormActions({
  submitLabel,
  pendingLabel = "Saving…",
  cancelHref,
  cancelLabel = "Cancel",
  className,
  children,
}: {
  submitLabel: string;
  pendingLabel?: string;
  cancelHref?: string;
  cancelLabel?: string;
  className?: string;
  /** Extra controls placed after the cancel link (for example a Delete button). */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 border-t border-line-soft bg-surface-1 px-4 py-3", className)}>
      <PendingButton variant="primary" size="sm" pendingLabel={pendingLabel}>
        {submitLabel}
      </PendingButton>
      {cancelHref && (
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8"
        >
          {cancelLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
