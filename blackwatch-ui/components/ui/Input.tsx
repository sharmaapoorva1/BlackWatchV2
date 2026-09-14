import { forwardRef } from "react";
import InputBase from "@mui/material/InputBase";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono = false, color: _color, size: _size, ...props }, ref) => {
    return (
      <InputBase
        ref={ref}
        fullWidth
        className={className}
        sx={{
          minHeight: 32,
          px: 1.25,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.primary",
          fontFamily: mono ? "monospace" : undefined,
          "&:hover": { borderColor: "signal.main" },
          "&.Mui-focused": { borderColor: "signal.main" },
          "& input::placeholder": { color: "text.disabled", opacity: 1 },
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
