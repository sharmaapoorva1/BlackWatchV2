import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-y rounded-md border border-line bg-surface-1 px-2.5 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-sev-critical aria-invalid:focus:ring-sev-critical/50",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
