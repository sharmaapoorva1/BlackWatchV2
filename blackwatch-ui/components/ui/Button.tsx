"use client";

import Link from "next/link";
import { Children, forwardRef, isValidElement } from "react";
import MuiButton from "@mui/material/Button";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", asChild = false, className, color: _color, children, ...props }, ref) => {
    const buttonColor: "primary" | "error" | "inherit" = variant === "danger" ? "error" : variant === "primary" ? "primary" : "inherit";
    const muiProps = {
      variant: variant === "primary" ? "contained" as const : variant === "ghost" ? "text" as const : "outlined" as const,
      color: buttonColor,
      size: size === "sm" ? "small" as const : "medium" as const,
      className,
      sx: {
        minHeight: size === "sm" ? 28 : 32,
        px: size === "sm" ? 1.25 : 1.5,
        gap: 1,
        whiteSpace: "nowrap",
        fontSize: size === "sm" ? 12 : 14,
        borderColor: variant === "danger" ? "rgba(244,63,94,0.3)" : "divider",
        bgcolor: variant === "secondary" ? "background.paper" : variant === "danger" ? "rgba(244,63,94,0.1)" : undefined,
        color: variant === "ghost" ? "text.secondary" : undefined,
        "&:hover": { bgcolor: variant === "ghost" ? "background.paper" : undefined },
      },
    };

    if (asChild) {
      const child = Children.only(children);
      if (!isValidElement(child)) {
        throw new Error("Button asChild requires one link child.");
      }
      const { children: linkChildren, ...linkProps } = child.props as React.ComponentProps<typeof Link>;
      // MUI's polymorphic overload cannot infer Next's Url type here, but
      // this branch is intentionally a Next Link button (all asChild calls
      // pass one). Keep the component decision inside this client module.
      const LinkButton = MuiButton as React.ElementType;
      return (
        <LinkButton ref={ref} component={Link} {...linkProps} {...muiProps} {...props}>
          {linkChildren}
        </LinkButton>
      );
    }

    return (
      <MuiButton
        ref={ref}
        component="button"
        {...muiProps}
        {...props}
      >
        {children}
      </MuiButton>
    );
  },
);

Button.displayName = "Button";
