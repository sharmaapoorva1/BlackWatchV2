"use client";

import MuiNativeSelect from "@mui/material/NativeSelect";
import { forwardRef, type ChangeEvent, type SelectHTMLAttributes } from "react";

export interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue" | "children"> {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
}

/**
 * Custom select with the old NativeSelect API, so forms can migrate without
 * changing their option definitions. It keeps a hidden input for server
 * actions while Radix provides reliable keyboard and pointer behavior.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      name,
      id,
      disabled,
      required,
      size: _size,
      color: _color,
      ...props
    },
    ref,
  ) => {
    return (
      <MuiNativeSelect
        inputRef={ref}
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        inputProps={{ "aria-label": props["aria-label"], "aria-labelledby": props["aria-labelledby"] }}
        sx={{ minWidth: 0, width: "100%", minHeight: 32, bgcolor: "background.paper", "& .MuiNativeSelect-select": { py: 0.75, px: 1.25, fontSize: 14 } }}
        className={className}
        {...(props as unknown as Record<string, unknown>)}
      >
        {children}
      </MuiNativeSelect>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
