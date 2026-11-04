import Link from "next/link";
import { useId } from "react";

// Standard page section: one heading style, one "see all" affordance, one
// vertical rhythm (24px between sections). Pages compose these instead of
// hand-rolling heading rows, so every list page reads the same way.
export function PageSection({
  title,
  description,
  action,
  children,
  flush = false,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  children: React.ReactNode;
  /** No top margin: use when the parent already spaces its children. */
  flush?: boolean;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`${flush ? "" : "mt-6"} space-y-3 ${className ?? ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-base font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex min-h-8 items-center text-sm text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
