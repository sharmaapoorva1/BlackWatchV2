import { forwardRef } from "react";
import clsx from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono = false, color: _color, size: _size, ...props }, ref) => {
    return <input ref={ref} className={clsx("min-h-11 w-full border border-line bg-surface-1 px-2.5 text-sm text-fg placeholder:text-fg-disabled focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/70 sm:min-h-8", mono && "font-mono", className)} {...props} />;
  },
);

Input.displayName = "Input";
