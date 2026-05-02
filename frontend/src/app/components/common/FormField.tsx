import React, { ChangeEvent, ReactNode, ComponentType } from "react";
import { IconType } from "react-icons";
import { Filter } from "./Filter";

interface Option {
  label: string;
  value: string | number;
}

interface FormFieldProps {
  label?: string;
  type?: string;
  name: string;
  value?: string | number;
  onChange?: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  icon?: IconType | ComponentType;
  options?: Option[];
  children?: ReactNode;
  className?: string;
  inputClassName?: string;
  suffix?: ReactNode;
  [key: string]: any;
}

export default function FormField({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  icon: Icon,
  options = [], // For select type
  children, // For select options if passed as children
  className = "",
  inputClassName = "",
  suffix,
  containerClassName, // Destructure to prevent passing to DOM
  ...props
}: FormFieldProps) {
  const isControlled = value !== undefined;
  const shouldForceReadOnly =
    isControlled && !onChange && props.readOnly !== false;

  const baseInputClasses = `w-full h-12 px-4 font-base text-base text-k-dark-grey bg-white/70 backdrop-blur-sm border rounded-xl transition-all duration-200 placeholder:text-k-medium-grey placeholder:opacity-70 focus:outline-none ${error
    ? "border-error focus:border-error focus:ring-4 focus:ring-red-200"
    : "border-gray-200 focus:border-primary-light focus:ring-4 focus:ring-primary-light"
    }`;

  const renderInput = () => {
    if (type === "select") {
      // Use the new Filter component if options are provided
      if (options.length > 0) {
        const handleFilterChange = (newValue: string) => {
          if (onChange) {
            const syntheticEvent = {
              target: {
                name: name,
                value: newValue,
              },
            } as ChangeEvent<HTMLSelectElement>;
            onChange(syntheticEvent);
          }
        };

        const filterOptions = options.map((opt) => ({
          label: opt.label,
          value: String(opt.value),
        }));

        return (
          <Filter
            value={value !== undefined ? String(value) : ""}
            onChange={handleFilterChange}
            options={filterOptions}
            placeholder={placeholder || "Select option"}
            disabled={props.disabled || (isControlled && !onChange)}
            className={`${error
              ? "border-error focus:ring-red-200"
              : "border-gray-200 focus:ring-primary-light"
              } ${inputClassName}`}
          />
        );
      }

      // Fallback to native select if children are used
      return (
        <div className="relative">
          <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            disabled={props.disabled || (isControlled && !onChange)}
            className={`${baseInputClasses} ${inputClassName} appearance-none cursor-pointer pr-10 ${Icon ? "pl-11" : ""
              }`}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={helperText ? `${name}-helper` : undefined}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-k-medium-grey pointer-events-none">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          readOnly={props.readOnly || shouldForceReadOnly}
          placeholder={placeholder}
          className={`${baseInputClasses} ${inputClassName} py-3 h-auto min-h-25 resize-y`}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={helperText ? `${name}-helper` : undefined}
          {...props}
        />
      );
    }

    // Special handling for date type - hybrid text/picker
    if (type === "date") {
      const dateInputRef = React.useRef<HTMLInputElement>(null);

      return (
        <div className="relative flex items-center">
          {/* Text input for manual entry */}
          <input
            id={name}
            name={name}
            type="text"
            value={value}
            onChange={(e) => {
              let val = e.target.value;
              const oldVal = String(value || "");

              // Allow typing in various formats and normalize
              // Remove non-numeric except dashes and slashes
              val = val.replace(/[^0-9\-\/]/g, '');

              // Only auto-format if we are NOT deleting
              if (val.length > oldVal.length) {
                // Limit total length to 10 chars (YYYY-MM-DD)
                if (val.length > 10) {
                  val = val.substring(0, 10);
                }

                // Auto-format as user types (YYYY-MM-DD)
                if (val.length === 4 && !val.includes('-')) {
                  val = val + '-';
                } else if (val.length === 7 && val.split('-').length === 2) {
                  val = val + '-';
                }
              }

              // Call parent onChange with synthetic event
              if (onChange) {
                const syntheticEvent = {
                  target: { name, value: val },
                } as ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }
            }}
            onBlur={(e) => {
              // Try to parse and format on blur
              let val = e.target.value;

              // Basic structure validation regex: YYYY-MM-DD
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

              if (dateRegex.test(val)) {
                // Parse parts to ensure month/day validity
                const [year, month, day] = val.split('-').map(Number);

                // Logic validation
                const isValidDate =
                  month >= 1 && month <= 12 &&
                  day >= 1 && day <= 31 &&
                  // Check simple days in month validity (approximate or precise)
                  // For better UX, we can use Date object but re-check if components match
                  (new Date(year, month - 1, day).getDate() === day);

                if (isValidDate) {
                  // Check Max constraint if provided
                  let finalDate = val;
                  if (props.max) {
                    const maxDate = new Date(props.max);
                    const selectedDate = new Date(val);
                    if (selectedDate > maxDate) {
                      // Reset to max or just keep as is? User asked for validation.
                      // Usually we might clear it or revert. Let's clear it to force valid input
                      // or better, just leave it and let form validation handle the error state if we can't show error here directly.
                      // But FormField receives error prop.
                      // Correction: we cannot easily set error state from within here without parent handler.
                      // We will simply enforce the max date by resetting to max or clearing.
                      // Let's reset to max to be helpful, or clear if user prefers strictness.
                      // "inform ... should be before current day" implies rejection.
                      finalDate = props.max as string;
                    }
                  }

                  if (onChange) {
                    const syntheticEvent = {
                      target: { name, value: finalDate },
                    } as ChangeEvent<HTMLInputElement>;
                    onChange(syntheticEvent);
                  }
                } else {
                  // Invalid logical date (e.g. 2023-02-30) -> Clear or let parent validate?
                  // If we want "validation like..." immediately:
                  // We'll clear invalid dates on blur to enforce format.
                  if (onChange) {
                    const syntheticEvent = {
                      target: { name, value: '' }, // Clear invalid
                    } as ChangeEvent<HTMLInputElement>;
                    onChange(syntheticEvent);
                  }
                }
              } else {
                // Try loose parsing if it's not strictly YYYY-MM-DD but parsable?
                // User asked for "inform the format year month and date", creating strict structure is better.
                // If doesn't match format, clear it.
                if (val && onChange) {
                  const syntheticEvent = {
                    target: { name, value: '' },
                  } as ChangeEvent<HTMLInputElement>;
                  onChange(syntheticEvent);
                }
              }
            }}
            readOnly={props.readOnly || shouldForceReadOnly}
            placeholder={placeholder || "YYYY-MM-DD"}
            className={`${baseInputClasses} ${inputClassName} ${Icon ? "pl-11" : ""} pr-12`}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={helperText ? `${name}-helper` : undefined}
            {...props}
          />
          {/* Hidden date input for native picker */}
          <input
            ref={dateInputRef}
            type="date"
            className="sr-only"
            value={value || ""}
            onChange={(e) => {
              if (onChange) {
                const syntheticEvent = {
                  target: { name, value: e.target.value },
                } as ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }
            }}
            tabIndex={-1}
            max={props.max}
            min={props.min}
          />
          {/* Calendar icon button */}
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => dateInputRef.current?.showPicker?.()}
            tabIndex={-1}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        readOnly={props.readOnly || shouldForceReadOnly}
        placeholder={placeholder}
        className={`${baseInputClasses} ${inputClassName} ${Icon ? "pl-11" : ""
          }`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={helperText ? `${name}-helper` : undefined}
        {...props}
      />
    );
  };

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="text-sm font-medium text-k-dark-grey mb-1"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center text-k-medium-grey pointer-events-none z-10">
            <Icon />
          </div>
        )}
        {renderInput()}
        {suffix && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10">
            {suffix}
          </div>
        )}
      </div>
      {(error || helperText) && (
        <span
          id={`${name}-helper`}
          className={`text-sm ${error ? "text-error" : "text-k-medium-grey"}`}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
}
