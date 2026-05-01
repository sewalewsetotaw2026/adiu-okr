"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { FiCheck, FiChevronDown } from "react-icons/fi";

export interface FilterOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface FilterProps {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Filter({
  value,
  onChange,
  options,
  placeholder = "Filter",
  className,
  disabled,
}: FilterProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(val) => onChange(val === "__ALL__" ? "" : val)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={[
          "flex items-center justify-between gap-2 h-12 px-4 rounded-xl border shadow-sm bg-white/70 backdrop-blur-sm text-base",
          "border-gray-200 hover:bg-gray-50 transition-all w-full",
          "focus:outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/20",
          "text-k-dark-grey placeholder:text-k-medium-grey",
          className || "",
        ].join(" ")}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <FiChevronDown size={20} className="text-k-medium-grey" />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          align="center"
          position="popper"
          sideOffset={5}
          className="z-1100 rounded-xl bg-white border border-gray-100 shadow-lg min-w-(--radix-select-trigger-width) overflow-hidden max-h-60 overflow-y-auto"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                // radiz-ui select does not allow empty string values
                value={o.value === "" ? "__ALL__" : o.value}
                key={o.value}
                className={
                  "flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer outline-none text-k-dark-grey hover:bg-primary-light focus:bg-primary-light transition-colors"
                }
              >
                {o.icon && <span>{o.icon}</span>}

                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>

                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <FiCheck size={16} className="text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
