import React, { useState, useEffect, useRef } from "react";
import { MdCalendarToday } from "react-icons/md";

interface SmartDateInputProps {
  label: string;
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
}

export default function SmartDateInput({
  label,
  value,
  onChange,
  required,
  error,
}: SmartDateInputProps) {
  // Format YYYY-MM-DD to MM/DD/YYYY for display
  const formatDateToDisplay = (isoDate: string) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    if (!y || !m || !d) return isoDate;
    return `${m}/${d}/${y}`;
  };

  const [displayValue, setDisplayValue] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Track if we are currently editing to prevent Effect from overwriting while typing
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
        if (value) {
            setDisplayValue(formatDateToDisplay(value));
        } else {
            setDisplayValue("");
        }
    }
  }, [value, isEditing]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDisplayValue(text);
    
    // Parse attempts
    // 1. MM/DD/YYYY or MM/DD/YY
    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
       let [_, m, d, y] = slashMatch;
       processDateParts(m, d, y);
       return;
    }

    // 2. MMDDYYYY (8 digits)
    const plainMatch = text.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (plainMatch) {
        let [_, m, d, y] = plainMatch;
        processDateParts(m, d, y);
        return;
    }

    // If text cleared
    if (text === "") {
        onChange("");
    }
  };

  const processDateParts = (m: string, d: string, y: string) => {
      // Handle 2 digit year
      if (y.length === 2) {
          const yNum = parseInt(y, 10);
          const currentYear = new Date().getFullYear() % 100;
          if (yNum <= currentYear + 10) { 
              y = `20${y}`;
          } else {
              y = `19${y}`;
          }
      }

      m = m.padStart(2, "0");
      d = d.padStart(2, "0");

      const isoDate = `${y}-${m}-${d}`;
      const testDate = new Date(isoDate);
      // Check if valid date and components match (to avoid 2023-02-31 becoming march)
      if (!isNaN(testDate.getTime())) {
          // Additional validity check
          // testDate.getMonth() is 0-indexed
          const validM = testDate.getMonth() + 1 === parseInt(m, 10);
          const validD = testDate.getDate() === parseInt(d, 10);
          if (validM && validD) {
              onChange(isoDate);
          }
      }
  };

  const handleBlur = () => {
      setIsEditing(false);
      // On blur, force display to match current prop value (standardize format)
      if (value) {
          setDisplayValue(formatDateToDisplay(value));
      } else {
          // If invalid text remains, strictly it should probably be cleared or keep error?
          // For now, if no valid value was produced, we can leave text as gives user feedback (or clear it).
          // Let's leave it, but maybe parent validation handles it.
      }
  };

  const handleFocus = () => {
      setIsEditing(true);
  };

  const triggerDatePicker = () => {
    const inputEl = dateInputRef.current as HTMLInputElement | null;
    if (inputEl) {
        if ('showPicker' in inputEl) {
            try {
               (inputEl as any).showPicker();
            } catch (e) {
                (inputEl as any).focus();
            }
        } else {
             (inputEl as any).focus();
             (inputEl as any).click(); 
        }
    }
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setDisplayValue(formatDateToDisplay(e.target.value)); // Sync display immediately
      setIsEditing(false); // Stop editing mode
  };

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        className={`flex items-center border rounded-xl bg-white focus-within:ring-2 focus-within:ring-[#FFCC00] relative ${
          error ? "border-red-500" : "border-gray-200"
        }`}
      >
        <input
          type="text"
          className="w-full px-3 py-2 bg-transparent outline-none z-10"
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="MM/DD/YYYY"
        />
        
        <button 
           type="button" 
           onClick={triggerDatePicker}
           className="px-3 text-gray-400 hover:text-k-orange focus:outline-none z-20"
        >
            <MdCalendarToday size={20} />
        </button>

        {/* Hidden Date Input for Picker */}
        <input
            ref={dateInputRef}
            type="date"
            className="absolute opacity-0 bottom-0 left-0 w-full h-full"
            style={{ visibility: 'hidden', position: 'absolute' }}
            value={value}
            onChange={handleDatePick}
            tabIndex={-1}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
    </div>
  );
}
