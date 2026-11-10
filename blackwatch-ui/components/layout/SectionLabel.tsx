// Title for a panel or table. Sentence case (the first letter is capitalised
// even when the call site passes lowercase), 14px semibold. Renders an h2 by
// default; pass `as="h3"` when it sits under a larger section heading so the
// outline stays h1 > h2 > h3 without skipped levels.
export function SectionLabel({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag className={`text-sm font-semibold text-fg first-letter:${className ?? ""}`}>
      {children}
    </Tag>
  );
}
