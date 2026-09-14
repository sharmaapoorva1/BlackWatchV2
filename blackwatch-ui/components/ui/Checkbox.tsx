import { forwardRef } from "react";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, size: _size, color: _color, ...props }, ref) => {
    const input = (
      <MuiCheckbox
        slotProps={{ input: { ref } }}
        size="small"
        className={className}
        sx={{ color: "text.secondary", p: 0.25, "&.Mui-checked": { color: "signal.main" } }}
        {...(props as unknown as Record<string, unknown>)}
      />
    );

    if (!label) return input;

    return <FormControlLabel control={input} label={label} sx={{ m: 0, gap: 0.5, color: "text.secondary", fontSize: 14 }} />;
  },
);

Checkbox.displayName = "Checkbox";
