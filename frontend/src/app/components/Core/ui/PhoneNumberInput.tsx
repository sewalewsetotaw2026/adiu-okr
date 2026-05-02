import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { countries } from "../../../utils/countries";
import { MdSearch } from "react-icons/md";

interface PhoneNumberInputProps {
  label: string;
  value: string; // Full number (e.g. +251911223344)
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

export default function PhoneNumberInput({
  label,
  value,
  onChange,
  required,
  error,
  placeholder = "Enter phone number",
}: PhoneNumberInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(countries.find(c => c.name === "Ethiopia") || countries[0]);
  const [localNumber, setLocalNumber] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      // Try to match existing value to a country
      const country = countries.find((c) => value.startsWith(c.dial_code));
      if (country) {
        setSelectedCountry(country);
        setLocalNumber(value.slice(country.dial_code.length));
      } else {
        setLocalNumber(value);
      }
    } else {
        setLocalNumber("");
    }
  }, [value]);

  // Update dropdown position when opening and on scroll/resize
  useEffect(() => {
    if (!isDropdownOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    };

    // Initial position
    updatePosition();

    // Update on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isDropdownOpen]);

  const handleCountrySelect = (country: typeof countries[0]) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    updateParent(country.dial_code, localNumber);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ""); // Allow only numbers
    
    // Limit to 9 digits
    if (val.length > 9) {
        val = val.slice(0, 9);
    }

    setLocalNumber(val);
    updateParent(selectedCountry.dial_code, val);
  };

  const updateParent = (dialCode: string, number: string) => {
    // Strip leading zero from number if present
    const cleanNumber = number.startsWith("0") ? number.substring(1) : number;
    if (!cleanNumber) {
        onChange(""); 
        return;
    }
    onChange(`${dialCode}${cleanNumber}`);
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.dial_code.includes(searchTerm)
  );

  // Dropdown rendered via Portal
  const dropdownContent = isDropdownOpen ? createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998]" 
        onClick={() => setIsDropdownOpen(false)} 
      />
      {/* Dropdown */}
      <div 
        className="fixed w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] max-h-60 flex flex-col"
        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
      >
        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <div className="flex items-center bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
            <MdSearch className="text-gray-400 mr-2" />
            <input
              type="text"
              className="bg-transparent outline-none w-full text-sm"
              placeholder="Search country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredCountries.map((c) => (
            <button
              key={c.code}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
              onClick={() => handleCountrySelect(c)}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{c.flag}</span>
                <span>{c.name}</span>
              </span>
              <span className="text-gray-500 text-xs">{c.dial_code}</span>
            </button>
          ))}
          {filteredCountries.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">No countries found</div>
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        className={`flex items-center w-full h-12 bg-white/70 backdrop-blur-sm border rounded-xl transition-all duration-200 focus-within:outline-none ${
          error
            ? "border-error focus-within:border-error focus-within:ring-4 focus-within:ring-red-200"
            : "border-gray-200 focus-within:border-orange-200 focus-within:ring-4 focus-within:ring-orange-200"
        }`}
      >
        {/* Country Selector */}
        <div className="border-r border-gray-200 h-full">
          <button
            ref={buttonRef}
            type="button"
            className="flex items-center gap-2 px-3 h-full hover:bg-gray-50/50 rounded-l-xl transition-colors min-w-[80px]"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm font-medium text-k-dark-grey">{selectedCountry.code}</span>
            <span className="text-xs text-k-medium-grey">{selectedCountry.dial_code}</span>
          </button>
        </div>

        {/* Number Input */}
        <input
          type="text"
          className="w-full h-full px-4 bg-transparent outline-none font-base text-base text-k-dark-grey placeholder:text-k-medium-grey placeholder:opacity-70 rounded-r-xl"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          required={required}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
      
      {dropdownContent}
    </div>
  );
}
