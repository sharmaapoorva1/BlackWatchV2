import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, size: _size, color: _color, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );

    if (!label) return input;

    // The whole label is the click target (44px tall on touch screens).
    return (
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-muted sm:min-h-8">
        {input}
        <span>{label}</span>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
