import { Field } from "./Field";

/**
 * A labelled form row (label column on the left from `sm` up). Thin wrapper
 * over `Field`, kept so the existing forms get the accessible label, hint and
 * error wiring without changes at their call sites.
 */
export function FormRow({
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
    <Field label={label} hint={hint} error={error} layout="row">
      {children}
    </Field>
  );
}
