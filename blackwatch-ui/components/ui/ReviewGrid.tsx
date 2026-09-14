
export function ReviewGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl className={`grid min-w-0 grid-cols-1 gap-y-2 text-sm sm:grid-cols-[minmax(140px,1fr)_minmax(0,2fr)] sm:gap-y-3 ${className ?? ""}`}>
      {children}
    </dl>
  );
}

export function ReviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{children}</dt>
  );
}

export function ReviewValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dd className={`min-w-0 overflow-wrap-anywhere ${className ?? ""}`}>{children}</dd>;
}
