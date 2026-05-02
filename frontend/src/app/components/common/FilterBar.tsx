import { useState, useMemo, useEffect, useRef } from "react";
import { FiSearch, FiX, FiChevronDown, FiFilter, FiSettings, FiCheck } from "react-icons/fi";
import { MdArrowUpward, MdArrowDownward } from "react-icons/md";
import Button from "../Core/ui/Button";
import FormField from "./FormField";
import FormAutocomplete from "../Core/ui/FormAutocomplete";

// Generic Filter Configuration Interface
export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "date" | "autocomplete";
  options?: { value: string; label: string }[]; // For select type
  autocompleteType?: "departments" | "jobTitles" | "managers" | "employees"; // For autocomplete type
  visible?: boolean;
  placeholder?: string;
  className?: string; // container class
}

export interface FilterBarProps {
  filters: Record<string, any>;
  onFilterChange: (newFilters: Record<string, any>) => void;
  onApply?: () => void;
  onClear?: () => void;

  config: FilterConfig[];
  sortOptions?: { value: string; label: string }[];
  storageKey?: string; // Key for localStorage pinning

  className?: string; // container class

  // Visibility toggles
  showSearch?: boolean;
  showSort?: boolean;
}

const DEFAULT_SORT_OPTIONS = [
  { value: "__none__", label: "Sort By..." },
  { value: "created_at", label: "Date Created" },
];

export default function FilterBar({
  filters,
  onFilterChange,
  onApply,
  onClear,
  config,
  sortOptions = DEFAULT_SORT_OPTIONS,
  storageKey = "generic_filter_pinned_fields",
  className = "",
  showSearch = true,
  showSort = true,
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Pinned keys state
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Autocomplete label state management (to show names instead of IDs)
  // We use a generic state object: { [filterKey]: labelValue }
  const [autocompleteLabels, setAutocompleteLabels] = useState<Record<string, string>>({});

  // Close settings on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (key: string, value: any) => {
    // Standardize "all/none" values to empty string
    const cleanValue = value === "__all__" || value === "__none__" || value === "ALL" ? "" : value;
    onFilterChange({ ...filters, [key]: cleanValue });
  };

  const handleClearAll = () => {
    // Reset autocomplete labels
    setAutocompleteLabels({});

    if (onClear) {
      onClear();
    } else {
      // Default clear behavior if no handler provided: reset all known keys to empty
      const emptyFilters = config.reduce((acc, curr) => ({ ...acc, [curr.key]: "" }), {});
      onFilterChange({
        ...filters,
        ...emptyFilters,
        search: "",
        sortBy: "",
        order: "asc"
      });
    }
  };

  const togglePin = (key: string) => {
    setPinnedKeys(prev => {
      const newPinned = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      localStorage.setItem(storageKey, JSON.stringify(newPinned));
      return newPinned;
    });
  };

  const toggleSort = () => {
    handleChange("order", filters.order === "asc" ? "desc" : "asc");
  };

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (!value) return false;
      if (value === "ALL" || value === "__all__" || value === "__none__") return false;
      // Exclude structural keys
      if (["search", "sortBy", "order", "page", "limit"].includes(key)) return false;
      return true;
    }).length;
  }, [filters]);

  // Process Sort Options
  const processedSortOptions = useMemo(() => {
    const hasPlaceholder = sortOptions.some(opt => opt.value === "" || opt.value === "__none__");
    if (hasPlaceholder) {
      return sortOptions.map(opt => ({
        label: opt.label,
        value: opt.value === "" ? "__none__" : opt.value
      }));
    }
    return [{ label: "Sort By...", value: "__none__" }, ...sortOptions];
  }, [sortOptions]);

  // Render a single filter input
  const renderFilterInput = (conf: FilterConfig, isPinned: boolean = false) => {
    if (conf.visible === false) return null;

    const pinnedWidth = "w-40";
    const defaultWidth = conf.className || "min-w-[150px]";
    const containerClass = isPinned ? pinnedWidth : defaultWidth;

    const showLabel = isExpanded && !isPinned;

    if (conf.type === "select") {
      return (
        <div className={containerClass}>
          <FormField
            label={showLabel ? conf.label : undefined}
            name={conf.key}
            type="select"
            value={filters[conf.key] || ""}
            onChange={(e) => handleChange(conf.key, e.target.value)}
            options={conf.options || []}
            placeholder={!showLabel ? conf.label : undefined}
            className="mb-0"
            inputClassName="bg-white border-gray-200 py-2 text-xs h-10 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      );
    }

    if (conf.type === "autocomplete" && conf.autocompleteType) {
      return (
        <div className={containerClass}>
          {showLabel && <label className="block text-sm font-medium text-k-dark-grey mb-1">{conf.label}</label>}
          <FormAutocomplete
            value={autocompleteLabels[conf.key] || ""}
            onChange={(value) => {
              setAutocompleteLabels(prev => ({ ...prev, [conf.key]: value }));
              if (!value) handleChange(conf.key, "");
            }}
            onIdChange={(id) => handleChange(conf.key, id)}
            type={conf.autocompleteType}
            placeholder={!showLabel ? conf.label : `Select ${conf.label}`}
            containerClassName="w-full mb-0"
            inputClassName="bg-white border-gray-200 py-2 text-xs h-10 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary text-gray-700"
          />
        </div>
      );
    }

    if (conf.type === "date") {
      return (
        <div className={isPinned ? "w-36" : "min-w-[150px]"}>
          <FormField
            label={showLabel ? conf.label : undefined}
            name={conf.key}
            type="date"
            value={filters[conf.key] || ""}
            onChange={(e) => handleChange(conf.key, e.target.value)}
            className="mb-0"
            inputClassName="bg-white border-gray-200 py-2 text-xs h-10 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      );
    }

    if (conf.type === "text") {
      return (
        <div className={containerClass}>
          <FormField
            label={showLabel ? conf.label : undefined}
            name={conf.key}
            type="text"
            value={filters[conf.key] || ""}
            onChange={(e) => handleChange(conf.key, e.target.value)}
            placeholder={conf.placeholder || conf.label}
            className="mb-0"
            inputClassName="bg-white border-gray-200 py-2 text-xs h-10 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      );
    }

    return null;
  };

  const visibleConfigs = config.filter(c => c.visible !== false);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3">

        {/* 1. Search (Always Left) */}
        {showSearch && (
          <div className="flex-grow md:flex-grow-0 min-w-[200px] md:w-80 relative group">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors w-4 h-4 z-10" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search || ""}
              onChange={(e) => handleChange("search", e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary text-sm text-k-dark-grey placeholder:text-gray-400 transition-all"
            />
          </div>
        )}

        {/* 2. Pinned Filters (Left/Center) */}
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          {pinnedKeys.map(key => {
            const conf = config.find(c => c.key === key);
            return conf ? <div key={key}>{renderFilterInput(conf, true)}</div> : null;
          })}
        </div>

        {/* Spacer to push controls to right */}
        <div className="flex-grow" />

        {/* 3. Sort Controls (Right) */}
        {showSort && (
          <div className="flex items-center gap-2">
            <div className="w-36 hidden sm:block">
              <FormField
                name="sortBy"
                type="select"
                value={filters.sortBy || "__none__"}
                onChange={(e) => handleChange("sortBy", e.target.value)}
                options={processedSortOptions}
                className="mb-0"
                inputClassName="bg-white border-gray-200 py-2 text-xs h-10 rounded-lg focus:ring-1 focus:ring-k-orange focus:border-primary"
              />
            </div>
            <button
              onClick={toggleSort}
              className="h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-all hover:border-primary group shrink-0"
              title={filters.order === "asc" ? "Ascending" : "Descending"}
            >
              {filters.order === "asc" ? (
                <MdArrowUpward className="w-4 h-4 text-gray-500 group-hover:text-primary transition-colors" />
              ) : (
                <MdArrowDownward className="w-4 h-4 text-gray-500 group-hover:text-primary transition-colors" />
              )}
            </button>
          </div>
        )}

        {/* 4. Settings (Right) */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-all ${showSettings
              ? "bg-primary-light border-primary text-primary"
              : "border-gray-200 bg-white text-gray-500 hover:text-primary hover:border-primary"
              }`}
            title="Pin Filters settings"
          >
            <FiSettings className="w-4 h-4" />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-800 text-sm">Pin Filters to Bar</span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Select which filters to show directly on the bar.</p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {visibleConfigs.map(conf => (
                  <button
                    key={conf.key}
                    onClick={() => togglePin(conf.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-colors group"
                  >
                    <span className="text-gray-700 group-hover:text-gray-900">{conf.label}</span>
                    {pinnedKeys.includes(conf.key) && (
                      <FiCheck className="text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. Filters Toggle (Far Right) */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-semibold transition-all ${isExpanded || activeFiltersCount > 0
            ? "bg-gradient-to-r from-primary to-primary-dark border-primary text-white shadow-md shadow-primary/20"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-primary"
            }`}
        >
          <FiFilter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${isExpanded || activeFiltersCount > 0
              ? "bg-white/20 text-white"
              : "bg-primary text-white"
              }`}>
              {activeFiltersCount}
            </span>
          )}
          <FiChevronDown
            className={`w-4 h-4 transition-transform ml-1 ${isExpanded ? "rotate-180" : ""
              }`}
          />
        </button>

        {/* Clear Button (only if filters active) */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 h-10 px-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Clear All Filters"
          >
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-5 bg-gradient-to-b from-gray-50/50 to-white animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleConfigs
              .filter(c => !pinnedKeys.includes(c.key))
              .map(c => (
                <div key={c.key}>
                  {renderFilterInput(c)}
                </div>
              ))
            }
          </div>

          {onApply && (
            <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
              <Button onClick={() => { onApply(); setIsExpanded(false); }} variant="primary" className="px-6">
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
