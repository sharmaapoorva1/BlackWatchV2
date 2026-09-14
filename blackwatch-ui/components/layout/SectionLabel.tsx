// Small uppercase label above tables / panels.
// Spec: 11px, uppercase, letter-spacing 0.08em, tertiary text color.
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={`text-[11px] uppercase tracking-[0.08em] text-muted ${className ?? ""}`}>{children}</h2>;
}
