"use client";

import { ConfirmSubmitButton } from "./ConfirmSubmitButton";
import { PendingButton } from "./PendingButton";
import type { ButtonProps } from "./Button";

/** A Next.js server action usable as a form action. */
export type ServerFormAction = (formData: FormData) => void | Promise<void>;

/**
 * One-button server-action form for table rows (Test, Turn off, Delete…).
 *
 * THE PATTERN FOR TABLES WITH ACTIONS
 * - Row actions live in a *client* table file (a DataTable's column cells are
 *   functions, so they cannot be defined in a server page anyway).
 * - That client file imports the server actions directly from their
 *   `"use server"` module and hands them to this component. Next.js turns the
 *   import into a reference; nothing is serialized by hand and no wrapper
 *   components sit between the page and the action.
 * - Do NOT pass server actions as props from a server page through a client
 *   wrapper (the old `<RequireAdmin>` problem): import them where they are used.
 * - Pass only the ids/values the action needs as `fields`, never whole records.
 *
 * With `confirmMessage` the button asks `window.confirm` first (destructive
 * actions); otherwise it is a PendingButton, which shows a spinner while the
 * action runs and locks itself for read-only users (the API enforces the real
 * gate).
 */
export function ActionForm({
  action,
  fields,
  children,
  pendingLabel = "…",
  variant = "secondary",
  size = "sm",
  confirmMessage,
  disabled,
  title,
  className = "inline",
}: {
  action: ServerFormAction;
  /** Hidden form fields posted to the action. */
  fields: Record<string, string>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirmMessage?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <form action={action} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirmMessage ? (
        <ConfirmSubmitButton
          size={size}
          variant={variant}
          pendingLabel={pendingLabel}
          confirmMessage={confirmMessage}
          disabled={disabled}
          title={title}
        >
          {children}
        </ConfirmSubmitButton>
      ) : (
        <PendingButton size={size} variant={variant} pendingLabel={pendingLabel} disabled={disabled} title={title}>
          {children}
        </PendingButton>
      )}
    </form>
  );
}
