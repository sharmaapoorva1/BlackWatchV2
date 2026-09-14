import { forwardRef } from "react";
import MuiButton from "@mui/material/Button";
import { Slot } from "@radix-ui/react-slot";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", asChild = false, className, color: _color, ...props }, ref) => {
    const buttonColor: "primary" | "error" | "inherit" = variant === "danger" ? "error" : variant === "primary" ? "primary" : "inherit";
    return (
      <MuiButton
        ref={ref}
        component={asChild ? Slot : "button"}
        variant={variant === "primary" ? "contained" : variant === "ghost" ? "text" : "outlined"}
        color={buttonColor}
        size={size === "sm" ? "small" : "medium"}
        className={className}
        sx={{
          minHeight: size === "sm" ? 28 : 32,
          px: size === "sm" ? 1.25 : 1.5,
          gap: 1,
          whiteSpace: "nowrap",
          fontSize: size === "sm" ? 12 : 14,
          borderColor: variant === "danger" ? "rgba(244,63,94,0.3)" : "divider",
          bgcolor: variant === "secondary" ? "background.paper" : variant === "danger" ? "rgba(244,63,94,0.1)" : undefined,
          color: variant === "ghost" ? "text.secondary" : undefined,
          "&:hover": { bgcolor: variant === "ghost" ? "background.paper" : undefined },
        }}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
