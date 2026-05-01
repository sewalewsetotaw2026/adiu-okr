import React from "react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
  error?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  icon,
  containerClassName = "",
  className = "",
  required,
  error,
  ...props
}) => {
  return (
    <div className={`mb-4 ${containerClassName}`}>
      {label && (
        <label className="block mb-1 font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div 
        className={`flex items-center border rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-[#FFCC00] ${
          error ? "border-red-500" : "border-gray-200"
        } ${className}`}
      >
        {icon && <span className="text-gray-500 mr-2">{icon}</span>}
        <input
          className="w-full bg-transparent outline-none"
          required={required}
          {...props}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
    </div>
  );
};

export default FormInput;
