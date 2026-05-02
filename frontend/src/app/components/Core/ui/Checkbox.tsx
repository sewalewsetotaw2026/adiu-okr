import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  containerClassName?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  containerClassName = "",
  className = "",
  ...props
}) => {
  return (
    <label className={`flex items-center gap-3 cursor-pointer text-gray-700 ${containerClassName}`}>
      <input
        type="checkbox"
        className={`w-5 h-5 rounded border-gray-300 cursor-pointer ${className}`}
        {...props}
      />
      {label && <span className="select-none">{label}</span>}
    </label>
  );
};

export default Checkbox;
