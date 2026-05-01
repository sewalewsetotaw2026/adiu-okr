import React, { useState, useEffect, useRef, useCallback } from "react";
import employeeService from "../../../services/employeeService";
import LoadingScreen from "./LoadingScreen";
import { toast } from "react-hot-toast";

interface FormAutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type:
  | "departments"
  | "jobTitles"
  | "jobLevels"
  | "fieldsOfStudy"
  | "institutions"
  | "employees"
  | "managers"
  | "allowanceTypes";
  onIdChange?: (id: string) => void;
  icon?: React.ReactNode;
  required?: boolean;
  error?: string;
  onCreateNew?: (value: string) => void;
  creatable?: boolean;
  containerClassName?: string;
  inputClassName?: string;
  fetchSuggestionsFn?: (query: string) => Promise<any[]>;
}

const FormAutocomplete: React.FC<FormAutocompleteProps> = ({
  label,
  value,
  onChange,
  onIdChange,
  onCreateNew,
  creatable = true,
  placeholder,
  type,
  icon,
  required,
  error,
  containerClassName = "",
  inputClassName = "",
  fetchSuggestionsFn,
}) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef(false); // Track if we're in the middle of selecting

  // Get label from suggestion object based on type
  const getSuggestionLabel = useCallback((suggestion: any): string => {
    if (typeof suggestion === "string") return suggestion;
    if (!suggestion) return "";

    if (type === "employees" || type === "managers") {
      return suggestion.full_name || suggestion.name || "";
    }
    if (type === "departments") {
      return suggestion.name || "";
    }
    if (type === "jobTitles") {
      return suggestion.title || suggestion.name || "";
    }
    // Universal fallback for any object with name/title/label/value
    return (
      suggestion.name ||
      suggestion.title ||
      suggestion.label ||
      suggestion.value ||
      suggestion.full_name ||
      suggestion.level ||
      ""
    );
  }, [type]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if we're in the middle of selecting
      if (isSelectingRef.current) {
        return;
      }
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      let data: any;
      if (fetchSuggestionsFn) {
        data = await fetchSuggestionsFn(query);
      } else {
        data = await employeeService.getSuggestions(type as any, query);
      }

      let rawData: any[] = [];

      if (type === "employees" || type === "managers") {
        rawData = data?.employees || data?.managers || (Array.isArray(data) ? data : []);
      } else if (type === "allowanceTypes") {
        rawData = Array.isArray(data) ? data : (data?.data?.allowanceTypes || []);
      } else {
        // Standard suggestions wrapper handling
        if (Array.isArray(data)) {
          rawData = data;
        } else if (data && typeof data === "object") {
          // Extract from common keys
          rawData =
            data.data ||
            data.departments ||
            data.jobTitles ||
            data.jobLevels ||
            data.fieldsOfStudy ||
            data.institutions ||
            [];

          // If extracted data is STILL not an array, but we have a nested .data
          if (!Array.isArray(rawData) && (rawData as any)?.data && Array.isArray((rawData as any).data)) {
            rawData = (rawData as any).data;
          }
        }
      }

      // Final safety check: if we got {status: "success", data: [...]} which some endpoints might return
      if (!Array.isArray(rawData) && data?.status === "success" && Array.isArray(data?.data)) {
        rawData = data.data;
      }

      if (!Array.isArray(rawData)) rawData = [];

      // Handle nested data structure
      if (!Array.isArray(rawData) && (data as any)?.data) {
        if (Array.isArray((data as any).data)) rawData = (data as any).data;
      }

      // Sort: Prioritize items starting with query
      const lowerQuery = query.toLowerCase();
      const sorted = [...rawData].sort((a, b) => {
        const labelA = getSuggestionLabel(a).toLowerCase();
        const labelB = getSuggestionLabel(b).toLowerCase();
        const aStarts = labelA.startsWith(lowerQuery);
        const bStarts = labelB.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return labelA.localeCompare(labelB);
      });

      setSuggestions(sorted);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [type, getSuggestionLabel, fetchSuggestionsFn]);

  // Debounced fetch on value change
  useEffect(() => {
    if (!showSuggestions) return;
    const timer = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, showSuggestions, fetchSuggestions]);

  // Handle selecting a suggestion
  const handleSelect = useCallback((suggestion: any) => {
    console.log("FormAutocomplete selecting:", suggestion);
    const labelStr = getSuggestionLabel(suggestion);
    console.log("Label resolved to:", labelStr);

    // Update the value
    onChange(labelStr);

    // Update the ID if callback provided
    const id = typeof suggestion === "object" && suggestion != null
      ? suggestion.id || suggestion._id
      : undefined;
    if (onIdChange && id != null) {
      onIdChange(String(id));
    }

    // Close dropdown and reset state
    setShowSuggestions(false);
    setActiveIndex(-1);

    // Crucial: Keep isSelectingRef true for a bit longer to prevent 
    // the container's onClick from re-opening the dropdown immediately
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 200);
  }, [getSuggestionLabel, onChange, onIdChange]);

  // Handle creating a new item
  const handleCreate = async (query: string) => {
    const val = query.trim();
    if (!val) return;

    // Check if value already exists
    const existingMatch = suggestions.find(
      (s) => getSuggestionLabel(s).toLowerCase() === val.toLowerCase()
    );
    if (existingMatch) {
      handleSelect(existingMatch);
      return;
    }

    setIsCreating(true);
    try {
      let created: any = null;
      let id: string | null = null;

      if (type === "departments") {
        const res = await employeeService.createDepartment(val);
        created = res.data?.data?.department;
        id = created?.id;
        toast.success("Department created");
      } else if (type === "allowanceTypes") {
        const res = await employeeService.createAllowanceType(val);
        created = res.data?.data?.allowanceType;
        id = created?.id;
        toast.success("Allowance Type created");
      } else if (type === "fieldsOfStudy") {
        const res = await employeeService.createFieldOfStudy(val);
        created = res.data?.data?.fieldOfStudy;
        id = created?.id;
        toast.success("Field of Study created");
      } else if (type === "institutions") {
        const res = await employeeService.createInstitution(val);
        created = res.data?.data?.institution;
        id = created?.id;
        toast.success("Institution created");
      } else if (type === "jobTitles") {
        const res = await employeeService.createJobTitle(val);
        created = res.data?.data?.jobTitle;
        id = created?.id;
        toast.success("Job Title created");
      } else if (type === "jobLevels") {
        const res = await employeeService.createJobLevel(val);
        created = res.data?.data?.jobLevel;
        id = created?.id;
        toast.success("Job Level created");
      }

      onChange(val);
      if (onIdChange) {
        onIdChange(id ? String(id) : "");
      }
      if (onCreateNew) onCreateNew(val);
    } catch (err: any) {
      console.error("Creation failed", err);
      onChange(val);
      if (onIdChange) onIdChange("");
      if (onCreateNew) onCreateNew(val);
      toast.error(err.message || "Failed to create new entry");
    } finally {
      setIsCreating(false);
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else if (creatable && value.trim()) {
        const existingMatch = suggestions.find(
          (s) => getSuggestionLabel(s).toLowerCase() === value.trim().toLowerCase()
        );
        if (existingMatch) {
          handleSelect(existingMatch);
        } else {
          handleCreate(value);
        }
      } else {
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Tab") {
      // On Tab, if there's an exact match, select it
      const exactMatch = suggestions.find(
        (s) => getSuggestionLabel(s).toLowerCase() === value.toLowerCase()
      );
      if (exactMatch) {
        handleSelect(exactMatch);
      }
      setShowSuggestions(false);
    }
  };

  // Toggle dropdown
  const handleToggle = () => {
    // If we just selected something, don't toggle (prevent race condition)
    if (isSelectingRef.current) return;

    if (showSuggestions) {
      setShowSuggestions(false);
    } else {
      setShowSuggestions(true);
      fetchSuggestions(value);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (!showSuggestions) {
      setShowSuggestions(true);
      fetchSuggestions(value);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // Clear the ID when user types (since it's no longer a selected item)
    if (onIdChange) {
      onIdChange("");
    }
    if (!showSuggestions) {
      setShowSuggestions(true);
    }
  };

  // Handle suggestion mouse down - prevent blur and mark as selecting
  const handleSuggestionMouseDown = (e: React.MouseEvent, suggestion: any) => {
    e.preventDefault(); // Prevent input blur
    e.stopPropagation();
    isSelectingRef.current = true;
    handleSelect(suggestion);
  };

  // Handle create new mouse down
  const handleCreateMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isSelectingRef.current = true;
    handleCreate(value);
  };

  return (
    <div className={`relative ${containerClassName}`} ref={wrapperRef}>
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.98) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .autocomplete-dropdown::-webkit-scrollbar {
          width: 5px;
        }
        .autocomplete-dropdown::-webkit-scrollbar-track {
          background: transparent;
        }
        .autocomplete-dropdown::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .autocomplete-dropdown::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>

      {label && (
        <label className="text-sm font-medium text-k-dark-grey mb-1">
          {label} {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}

      <div
        className={`flex items-center w-full h-12 px-4 bg-white/70 backdrop-blur-sm border rounded-xl transition-all duration-200 focus-within:border-primary-light focus-within:ring-4 focus-within:ring-primary-light group cursor-pointer ${error ? "border-error" : "border-gray-200"
          } ${inputClassName}`}
        onClick={handleToggle}
      >
        {icon && (
          <span className="text-k-medium-grey mr-3 text-lg transition-colors duration-200 group-focus-within:text-primary">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          className="w-full h-full bg-transparent outline-none text-k-dark-grey placeholder:text-k-medium-grey placeholder:opacity-70 font-base text-base"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
        />
        <div className="text-k-medium-grey ml-2 transition-all duration-300 group-hover:text-primary cursor-pointer">
          {isCreating ? (
            <LoadingScreen size={16} showText={false} />
          ) : (
            <svg
              className={`w-5 h-5 transition-transform duration-500 ${showSuggestions ? "rotate-180 text-primary" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </div>

      {showSuggestions && (
        <div className="autocomplete-dropdown absolute gap-1 z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-[fadeInScale_0.2s_ease-out] ring-1 ring-gray-200">
          {isLoading ? (
            <div className="px-4 py-6">
              <LoadingScreen
                size={40}
                showText={true}
                className="flex items-center justify-center p-0"
              />
            </div>
          ) : (
            <div className="py-2 px-1">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => {
                  const labelStr = getSuggestionLabel(suggestion);
                  const isActive = index === activeIndex;
                  const isSelected = labelStr.toLowerCase() === value.toLowerCase();
                  const subLabel =
                    (type === "employees" || type === "managers") &&
                      typeof suggestion === "object"
                      ? `${suggestion.job_title || ""} • ${suggestion.department || ""}`
                      : null;

                  return (
                    <div
                      key={suggestion.id || index}
                      className={`px-4 py-2.5 cursor-pointer transition-all duration-150 flex items-center justify-between rounded-lg ${isActive || isSelected
                        ? "bg-primary-light text-primary"
                        : "text-gray-700 hover:bg-gray-50"
                        }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => handleSuggestionMouseDown(e, suggestion)}
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-medium text-sm truncate">
                          {labelStr}
                        </span>
                        {subLabel && (
                          <span className="text-[10px] text-gray-400 truncate opacity-80">
                            {subLabel}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="bg-primary-light p-1 rounded-full scale-90 ml-2 shrink-0">
                          <svg
                            className="w-3.5 h-3.5 text-primary"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No matches found
                </div>
              )}

              {value &&
                creatable &&
                !suggestions.some(
                  (s) =>
                    getSuggestionLabel(s).toLowerCase() === value.toLowerCase()
                ) && (
                  <div
                    className="cursor-pointer hover:bg-primary-light transition-colors px-4 py-3 border-t border-gray-100"
                    onMouseDown={handleCreateMouseDown}
                  >
                    <p className="font-medium text-gray-700 mb-0.5">
                      "{value}"
                      <span className="text-primary ml-1 font-semibold">
                        (Create New)
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Click to add this as a new{" "}
                      {type === "jobTitles"
                        ? "Job Title"
                        : type === "jobLevels"
                          ? "Job Level"
                          : type === "departments"
                            ? "Department"
                            : type === "allowanceTypes"
                              ? "Allowance Type"
                              : "entry"}
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FormAutocomplete;
