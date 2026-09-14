"use client";

import Link from "next/link";
import { Children, forwardRef, isValidElement } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", asChild = false, className, color: _color, children, ...props }, ref) => {
    const styles = clsx(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:pointer-events-none disabled:opacity-50",
      size === "sm" ? "min-h-7 px-2.5 text-xs" : "min-h-8 px-3 text-sm",
      variant === "primary" && "border-signal bg-signal text-canvas hover:bg-signal/85",
      variant === "secondary" && "border-line bg-surface-1 text-fg hover:border-signal hover:bg-surface-2",
      variant === "ghost" && "border-transparent text-fg-muted hover:bg-surface-1 hover:text-fg",
      variant === "danger" && "border-sev-critical/30 bg-sev-critical/10 text-sev-critical hover:bg-sev-critical/20",
      className,
    );

    if (asChild) {
      const child = Children.only(children);
      if (!isValidElement(child)) {
        throw new Error("Button asChild requires one link child.");
      }
      const { children: linkChildren, ...linkProps } = child.props as React.ComponentProps<typeof Link>;
      return <Link {...linkProps} className={styles}>{linkChildren}</Link>;
    }

    return (
      <button ref={ref} className={styles} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
