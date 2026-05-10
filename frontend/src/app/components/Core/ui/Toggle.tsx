import React from "react";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
        checked
          ? "bg-primary/5 border-primary/20 shadow-sm"
          : "bg-slate-50 border-slate-100 hover:bg-slate-100/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="flex-1 mr-4">
        <p className={`text-xs font-bold transition-colors ${checked ? "text-primary" : "text-slate-700"}`}>
          {label}
        </p>
        {description && (
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
            {description}
          </p>
        )}
      </div>
      <div
        className={`w-9 h-5 rounded-full relative transition-all duration-300 ease-in-out ${
          checked ? "bg-primary shadow-inner" : "bg-slate-300"
        }`}
      >
        <div
          className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out ${
            checked ? "left-[22px]" : "left-1"
          }`}
        />
      </div>
    </div>
  );
};

export default Toggle;
