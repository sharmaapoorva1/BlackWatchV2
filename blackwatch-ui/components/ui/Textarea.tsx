import { forwardRef } from "react";
import clsx from "clsx";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx("min-h-24 w-full resize-y border border-line bg-surface-1 px-2.5 py-2 text-sm text-fg placeholder:text-fg-disabled focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/70", className)} {...props} />
  ),
);

Textarea.displayName = "Textarea";
