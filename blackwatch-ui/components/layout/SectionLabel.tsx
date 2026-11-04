// Small heading above tables / panels. Sentence case (first letter is
// capitalised even when the call site passes lowercase), 12px, muted.
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-xs font-medium text-fg-muted first-letter:uppercase ${className ?? ""}`}>
      {children}
    </h2>
  );
}
