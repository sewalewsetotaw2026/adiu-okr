import React, { useRef, useEffect } from "react";
import { MdFileDownload, MdKeyboardArrowDown, MdPictureAsPdf, MdTableChart, MdDescription } from "react-icons/md";

export default function ExportDropdown({ isOpen, onToggle, onExport }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <MdFileDownload size={18} />
        Export
        <MdKeyboardArrowDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-lg shadow-lg py-2 min-w-[140px] z-10 animate-[fadeIn_0.15s_ease-out]">
          <button
            onClick={() => {
              onExport("pdf");
              onToggle(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <MdPictureAsPdf className="text-red-500" />
            PDF
          </button>
          <button
            onClick={() => {
              onExport("csv");
              onToggle(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <MdTableChart className="text-green-600" />
            CSV
          </button>
          <button
            onClick={() => {
              onExport("excel");
              onToggle(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <MdDescription className="text-green-700" />
            Excel
          </button>
        </div>
      )}
    </div>
  );
}
