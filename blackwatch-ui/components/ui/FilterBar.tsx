import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/**
 * Shared filter toolbar for list pages. A plain GET form, so the URL stays the
 * source of truth: filters are shareable, survive reload, and work with the
 * back button. Put `Field compact` controls inside as children.
 *
 * - `role="search"` + `aria-label` make it a navigable landmark.
 * - Apply submits; Clear (shown when `clearHref` is given) resets to the bare
 *   page.
 */
export function FilterBar({
  action,
  label,
  clearHref,
  applyLabel = "Apply filters",
  className,
  children,
}: {
  action: string;
  label: string;
  clearHref?: string;
  applyLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      method="GET"
      role="search"
      aria-label={label}
      className={cn("flex min-w-0 flex-wrap items-end gap-3", className)}
    >
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm">
          {applyLabel}
        </Button>
        {clearHref && (
          <Button asChild variant="secondary" size="sm">
            <Link href={clearHref}>Clear</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
