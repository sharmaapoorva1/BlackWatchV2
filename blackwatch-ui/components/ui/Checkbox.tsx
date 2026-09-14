import { forwardRef } from "react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, size: _size, color: _color, ...props }, ref) => {
    const input = <input ref={ref} type="checkbox" className={`h-4 w-4 accent-[var(--color-signal)] ${className ?? ""}`} {...props} />;

    if (!label) return input;

    return <label className="inline-flex items-center gap-2 text-sm text-muted">{input}<span>{label}</span></label>;
  },
);

Checkbox.displayName = "Checkbox";
