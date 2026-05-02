import React, { useState, useRef, useEffect } from "react";
import { MdMoreVert } from "react-icons/md";

interface Action {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}

interface CardMenuProps {
  actions?: Action[];
}

export default function CardMenu({ actions = [] }: CardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-k-dark-grey p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <MdMoreVert size={24} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 p-1 z-20 animate-in fade-in zoom-in-95 duration-100">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer ${
                action.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"
              }`}
            >
              {action.icon && <action.icon size={16} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
