import React from "react";

interface Option {
  label: string;
  value: string | number;
}

interface FormSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[] | string[];
  containerClassName?: string;
  placeholder?: string;
}

const FormSelect: React.FC<FormSelectProps> = ({
  label,
  options,
  containerClassName = "",
  className = "",
  required,
  placeholder,
  ...props
}) => {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block mb-1 font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className={`relative border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus-within:border-orange-200 focus-within:ring-4 focus-within:ring-orange-200 ${className}`}
      >
        <select
          className="w-full h-12 px-4 pr-10 bg-transparent outline-none appearance-none text-k-dark-grey"
          required={required}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option, index) => {
            if (typeof option === "string") {
              return (
                <option key={index} value={option}>
                  {option}
                </option>
              );
            }
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-k-medium-grey pointer-events-none">
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
    </div>
  );
};

export default FormSelect;
