// The bordered/tinted section every table sits inside. Overflow belongs on
// the panel itself so layout classes such as `grid`, `flex`, and `p-*` apply
// to the actual content instead of an invisible wrapper.
export function DataPanel({
  children,
  className,
  scrollX = false,
}: {
  children: React.ReactNode;
  className?: string;
  scrollX?: boolean;
}) {
  return (
    <section className={`min-w-0 max-w-full border border-line bg-surface-1 ${scrollX ? "overflow-x-auto" : "overflow-x-visible"} ${className ?? ""}`}>
      {children}
    </section>
  );
}
