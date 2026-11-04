import { Field } from "./Field";

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
        <h2 className="text-sm font-semibold text-fg">{label}</h2>
        {hint && <p className="mt-0.5 text-xs leading-snug text-fg-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Stacked (label above the control) field. Thin wrapper over `Field`. */
export function FieldStack({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Field label={label} hint={hint} error={error} layout="stack">
      {children}
    </Field>
  );
}
