"use client";

import Link from "next/link";
import { Children, forwardRef, isValidElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn-style button: variants are declared once with cva and exported as
// `buttonVariants` so anything that must look like a button (a link, a menu
// trigger) can reuse the exact classes. The public API (variant, size,
// asChild-with-a-Next-Link) is unchanged from the previous Button, so the 30+
// call sites did not need to change.
export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-signal bg-signal text-canvas hover:bg-signal/85 active:bg-signal/75",
        secondary: "border-line bg-surface-1 text-fg hover:border-signal hover:bg-surface-2 active:bg-surface-2",
        ghost: "border-transparent text-fg-muted hover:bg-surface-1 hover:text-fg active:bg-surface-2",
        danger: "border-sev-critical/30 bg-sev-critical/10 text-sev-critical hover:bg-sev-critical/20 active:bg-sev-critical/25",
      },
      size: {
        sm: "min-h-11 px-2.5 text-xs sm:min-h-8",
        md: "min-h-11 px-3 text-sm sm:min-h-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child `<Link>` with button styling instead of a <button>. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, asChild = false, className, color: _color, children, ...props }, ref) => {
    const styles = cn(buttonVariants({ variant, size }), className);

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
