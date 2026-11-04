import { cn } from "@/lib/utils";

/**
 * Layout primitives for long detail pages. Three levels, always in this order,
 * so a reader can tell where they are at a glance:
 *
 *   h1  page title            24px bold       <PageHeader>
 *   h2  <Section>             18px semibold   one per topic, anchored by `id`
 *   h3  <Subsection>          14px semibold   collapsible block inside a section
 *   --  labels / captions     12px muted      never headings
 *
 * Spacing is owned here, not by the content: sections are 40px apart, blocks
 * inside a section are 16px apart (`Stack`), and panels never add their own
 * top margin. That is what removes the uneven gaps.
 */
export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-[calc(var(--sticky-header-h,0px)+1rem)]", className)}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <div className="min-w-0 max-w-3xl">
          <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <Stack>{children}</Stack>
    </section>
  );
}

/** Vertical rhythm: children are separated by a consistent gap, no margins needed. */
export function Stack({
  children,
  gap = "md",
  className,
}: {
  children: React.ReactNode;
  gap?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", gap === "sm" ? "gap-2" : gap === "lg" ? "gap-6" : "gap-4", className)}>
      {children}
    </div>
  );
}

/**
 * A responsive grid that arranges itself: it fits as many columns of at least
 * `min` width as the container allows and lets them share the leftover space,
 * so there are no fixed breakpoints and no half-empty rows. One column on a
 * phone, two or three on a wide screen, automatically.
 */
export function AutoGrid({
  children,
  min = "18rem",
  gap = "md",
  className,
}: {
  children: React.ReactNode;
  /** Minimum column width, any CSS length (default 18rem). */
  min?: string;
  gap?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn("grid min-w-0", gap === "sm" ? "gap-2" : gap === "lg" ? "gap-6" : "gap-4", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))` }}
    >
      {children}
    </div>
  );
}
