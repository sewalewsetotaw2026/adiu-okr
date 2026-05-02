import { useRef, useState, useEffect } from "react";
import { MdArrowDropDown } from "react-icons/md";

interface ScopeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const scopes = [
  { value: "N/A", label: "N/A" },
  { value: "own", label: "Own" },
  { value: "team", label: "Team" },
  { value: "any", label: "Any" },
];

export const ScopeSelect = ({
  value,
  onChange,
  disabled = false,
}: ScopeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<"down" | "up">("down");
  const ref = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (disabled) return;

    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 200px below, open upwards
      setDirection(spaceBelow < 200 ? "up" : "down");
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  const getLabel = (v: string) =>
    scopes.find((s) => s.value.toLowerCase() === v.toLowerCase())?.label ||
    "N/A";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-sm border rounded bg-white transition-colors ${disabled
          ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200"
          : "border-gray-300 hover:border-primary text-gray-700"
          }`}
        type="button"
      >
        <span>{getLabel(value)}</span>
        <MdArrowDropDown className={`text-gray-500 transition-transform ${isOpen && direction === "up" ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className={`absolute left-0 w-full bg-white border border-gray-200 rounded shadow-lg z-50 py-1 ${direction === "up" ? "bottom-full mb-1" : "top-full mt-1"
          }`}>
          {scopes.map((scope) => (
            <button
              key={scope.value}
              onClick={() => handleSelect(scope.value)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${scope.value === value ? "text-primary font-medium" : "text-gray-700"
                }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
