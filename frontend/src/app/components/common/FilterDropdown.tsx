import React, { useRef, useEffect } from "react";
import { MdFilterList, MdKeyboardArrowDown } from "react-icons/md";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  key: string;
  label: string;
  options: FilterOption[] | string[];
}

interface FilterDropdownProps {
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  config: FilterField[];
}

export default function FilterDropdown({
  isOpen,
  onToggle,
  filters,
  onFilterChange,
  config,
}: FilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onToggle(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => onToggle(!isOpen)}
        className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 h-10 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shrink-0"
      >
        <MdFilterList size={18} />
        Filter
        <MdKeyboardArrowDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-lg shadow-lg p-4 min-w-[200px] z-10 animate-[fadeIn_0.15s_ease-out]">
          {config.map((field) => (
            <div key={field.key} className="mb-4 last:mb-0">
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                {field.label}
              </label>
              <select
                value={filters[field.key] || ""}
                onChange={(e) => onFilterChange(field.key, e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-k-orange focus:border-transparent bg-gray-50 cursor-pointer"
              >
                {field.options.map((opt) => {
                  const label = typeof opt === "string" ? opt : opt.label;
                  const value = typeof opt === "string" ? opt : opt.value;
                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
