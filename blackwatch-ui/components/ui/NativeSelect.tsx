"use client";

import { ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { Children, forwardRef, isValidElement, useEffect, useState, type ChangeEvent, type SelectHTMLAttributes } from "react";

export interface NativeSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue" | "children"> {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
}

/**
 * Shared Radix Select with a stable API for server actions and forms.
 */
export const NativeSelect = forwardRef<HTMLButtonElement, NativeSelectProps>(
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
    const options = Children.toArray(children).filter(
      (child): child is React.ReactElement<{ value?: string; disabled?: boolean; children?: React.ReactNode }> =>
        isValidElement(child) && child.type === "option",
    );
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const selectedValue = value ?? internalValue;
    useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);
    const sentinel = "__bw_empty__";
    const radixValue = selectedValue || sentinel;
    const triggerProps = props as React.ComponentPropsWithoutRef<typeof Select.Trigger>;

    return (
      <Select.Root
        value={radixValue}
        onValueChange={(next) => {
          const actual = next === sentinel ? "" : next;
          if (value === undefined) setInternalValue(actual);
          onChange?.({ target: { name, value: actual } } as ChangeEvent<HTMLSelectElement>);
        }}
        disabled={disabled}
        required={required}
      >
        {name && <input type="hidden" name={name} value={selectedValue} />}
        <Select.Trigger
          ref={ref}
          id={id}
          {...triggerProps}
          className={`inline-flex min-h-11 min-w-0 w-full items-center justify-between gap-2 border border-line bg-surface px-3 py-1.5 text-left text-sm outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/70 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 ${className ?? ""}`}
        >
          <Select.Value placeholder={options.find((option) => option.props.value === "")?.props.children ?? "Select"} />
          <Select.Icon><ChevronDown size={14} aria-hidden="true" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden border border-line bg-surface-2 p-1 text-sm shadow-xl">
            <Select.Viewport>
              {options.map((option, index) => {
                const optionValue = option.props.value ?? "";
                return (
                  <Select.Item key={`${optionValue}-${index}`} value={optionValue || sentinel} disabled={option.props.disabled} className="flex min-h-9 cursor-pointer items-center px-3 py-2 text-fg outline-none data-[highlighted]:bg-surface-1 data-[highlighted]:text-signal data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    <Select.ItemText>{option.props.children}</Select.ItemText>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
