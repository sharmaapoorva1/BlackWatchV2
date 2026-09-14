
export function FormSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</h2>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function FieldStack({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] leading-tight text-subtle">{hint}</span>}
    </label>
  );
}
