"use client";

import { forwardRef, type ChangeEvent, type SelectHTMLAttributes } from "react";

export interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue" | "children"> {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
}

/**
 * Shared native select with a stable API for server actions and forms.
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
      <select
        ref={ref}
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`min-h-8 min-w-0 w-full border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        {...props}
      >
        {children}
      </select>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
