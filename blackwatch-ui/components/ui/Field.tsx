import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ControlProps = {
  id?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

// Only these DOM tags are real form controls we may label directly. Wrapper
// elements (div, span, fragments) around a control are labelled as a group.
const CONTROL_TAGS = new Set(["input", "select", "textarea"]);

function isControl(element: ReactElement): boolean {
  return typeof element.type !== "string" || CONTROL_TAGS.has(element.type);
}

/**
 * The one way to put a label, hint and error around a form control.
 *
 * - Label is programmatically tied to the control (`htmlFor`/`id`). If the
 *   child is a wrapper (for example an Input plus extra help text) the label
 *   names the wrapper as a `role="group"` instead of pointing at a div.
 * - The hint and the error are linked with `aria-describedby`, so a screen
 *   reader announces them with the field. `error` also sets `aria-invalid`,
 *   which the shared Input, Textarea and Select turn red.
 * - A control that is already `required` gets a visible asterisk and a
 *   screen-reader "required" automatically; pass `required` to override.
 *
 * `layout="row"` puts the label in a left column (settings-style forms);
 * `layout="stack"` puts it above the control (compact and mobile forms).
 */
export function Field({
  label,
  hint,
  error,
  required,
  layout = "stack",
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  layout?: "row" | "stack";
  className?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<ControlProps>) : undefined;
  const control = only && isControl(only) ? only : undefined;

  const controlId = control?.props.id ?? generatedId;
  const labelId = `${controlId}-label`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [control?.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  const isRequired = required ?? control?.props.required ?? false;

  const body = control
    ? cloneElement(control, {
        id: controlId,
        "aria-invalid": error ? true : control.props["aria-invalid"],
        "aria-describedby": describedBy,
      })
    : (
        <div role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
          {children}
        </div>
      );

  const labelContent = (
    <>
      {label}
      {isRequired && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-sev-critical">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "min-w-0",
        layout === "row"
          ? "grid grid-cols-1 items-start gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(140px,200px)_minmax(0,1fr)]"
          : "flex flex-col gap-1.5",
        className,
      )}
    >
      {control ? (
        <label htmlFor={controlId} className="pt-0.5 text-sm font-medium text-fg">
          {labelContent}
        </label>
      ) : (
        <span id={labelId} className="pt-0.5 text-sm font-medium text-fg">
          {labelContent}
        </span>
      )}
      <div className="min-w-0">
        {body}
        {hint && (
          <p id={hintId} className="mt-1 text-xs leading-snug text-fg-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-sev-critical">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
