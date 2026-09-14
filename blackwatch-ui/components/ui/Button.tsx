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
      "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0",
      size === "sm" ? "min-h-11 px-2.5 text-xs sm:min-h-8" : "min-h-11 px-3 text-sm sm:min-h-9",
      variant === "primary" && "border-signal bg-signal text-canvas hover:bg-signal/85 active:bg-signal/75",
      variant === "secondary" && "border-line bg-surface-1 text-fg hover:border-signal hover:bg-surface-2 active:bg-surface-2",
      variant === "ghost" && "border-transparent text-fg-muted hover:bg-surface-1 hover:text-fg active:bg-surface-2",
      variant === "danger" && "border-sev-critical/30 bg-sev-critical/10 text-sev-critical hover:bg-sev-critical/20 active:bg-sev-critical/25",
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
