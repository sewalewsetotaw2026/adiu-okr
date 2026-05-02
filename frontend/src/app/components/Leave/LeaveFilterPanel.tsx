import { useState, useMemo, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { FiSearch, FiX, FiChevronDown, FiFilter, FiSettings, FiCheck } from "react-icons/fi";
import { MdArrowUpward, MdArrowDownward } from "react-icons/md";
import Button from "../Core/ui/Button";
import FormField from "../common/FormField";
import FormAutocomplete from "../Core/ui/FormAutocomplete";
import { selectLeaveTypes } from "../../slice/leaveSlice/selectors";
import { LeaveType } from "../../slice/leaveSlice/types";

// Filter values interface for leave management
export interface LeaveFilterValues {
  search?: string;
  department_id?: string;
  job_title_id?: string;
  leave_type_id?: string;
  gender?: string;
  manager_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  sortBy?: string;
  order?: "asc" | "desc";
}

interface LeaveFilterPanelProps {
  filters: LeaveFilterValues;
  onFilterChange: (filters: LeaveFilterValues) => void;
  onApply?: () => void;
  // Visibility controls for different tabs
  showSearch?: boolean;
  showDepartment?: boolean;
  showJobTitle?: boolean;
  showLeaveType?: boolean;
  showGender?: boolean;
  showManager?: boolean;
  showStatus?: boolean;
  showDateRange?: boolean;
  showSort?: boolean;
  // Status options for specific tabs
  statusOptions?: Array<{ value: string; label: string }>;
  // Sort options for specific tabs
  sortOptions?: Array<{ value: string; label: string }>;
  className?: string;
}

const GENDER_OPTIONS = [
  { label: "All Genders", value: "__all__" },
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
];

const DEFAULT_SORT_OPTIONS = [
  { value: "__none__", label: "Sort By..." },
  { value: "full_name", label: "Employee Name" },
  { value: "created_at", label: "Date Created" },
  { value: "start_date", label: "Start Date" },
];

// Available filter keys for pinning
type FilterKey = "department_id" | "job_title_id" | "leave_type_id" | "gender" | "manager_id" | "status" | "start_date" | "end_date";

export default function LeaveFilterPanel({
  filters,
  onFilterChange,
  onApply,
  showSearch = true,
  showDepartment = true,
  showJobTitle = true,
  showLeaveType = true,
  showGender = true,
  showManager = false,
  showStatus = false,
  showDateRange = false,
  showSort = true,
  statusOptions = [],
  sortOptions = DEFAULT_SORT_OPTIONS,
  className = "",
}: LeaveFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Pinned filters state
  const [pinnedFilters, setPinnedFilters] = useState<FilterKey[]>(() => {
    const saved = localStorage.getItem("leave_filter_pinned_fields");
    return saved ? JSON.parse(saved) : [];
  });

  // Get leave types from Redux
  const leaveTypes = useSelector(selectLeaveTypes) as LeaveType[];

  // For autocomplete display values - sync with filter IDs
  const [departmentName, setDepartmentName] = useState("");
  const [jobTitleName, setJobTitleName] = useState("");
  const [managerName, setManagerName] = useState("");

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

  const handleChange = (key: keyof LeaveFilterValues, value: string) => {
    // Convert placeholder values back to empty string for actual filter state
    const cleanValue = value === "__all__" || value === "__none__" || value === "ALL" ? "" : value;
    onFilterChange({ ...filters, [key]: cleanValue });
  };

  const handleClear = () => {
    setDepartmentName("");
    setJobTitleName("");
    setManagerName("");
    onFilterChange({
      search: "",
      department_id: "",
      job_title_id: "",
      leave_type_id: "",
      gender: "",
      manager_id: "",
      status: "",
      start_date: "",
      end_date: "",
      sortBy: "",
      order: "asc",
    });
  };

  const togglePin = (key: FilterKey) => {
    setPinnedFilters(prev => {
      const newPinned = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      localStorage.setItem("leave_filter_pinned_fields", JSON.stringify(newPinned));
      return newPinned;
    });
  };

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(
      ([key, value]) =>
        value &&
        value !== "ALL" &&
        value !== "__all__" &&
        value !== "__none__" &&
        key !== "search" &&
        key !== "sortBy" &&
        key !== "order" &&
        key !== "page" &&
        key !== "limit"
    ).length;
  }, [filters]);

  const toggleSort = () => {
    handleChange("order", filters.order === "asc" ? "desc" : "asc");
  };

  // Build leave type options for FormField - use __all__ instead of empty string
  const leaveTypeOptions = useMemo(() => [
    { label: "All Leave Types", value: "__all__" },
    ...leaveTypes.map((type) => ({
      label: type.name,
      value: String(type.id),
    })),
  ], [leaveTypes]);

  // Build sort options with placeholder default
  const sortFieldOptions = useMemo(() => {
    const hasPlaceholder = sortOptions.some(opt => opt.value === "" || opt.value === "__none__");
    if (hasPlaceholder) {
      return sortOptions.map(opt => ({
        label: opt.label,
        value: opt.value === "" ? "__none__" : opt.value
      }));
    }
    return [{ label: "Sort By...", value: "__none__" }, ...sortOptions.map(opt => ({ label: opt.label, value: opt.value }))];
  }, [sortOptions]);

  // Render helpers
  const renderFilterInput = (key: FilterKey, isPinned: boolean = false) => {
    const pinnedWidth = "w-40"; // Fixed compact width for pinned items

    switch (key) {
      case "department_id":
        return showDepartment ? (
          <div className={isPinned ? pinnedWidth : "min-w-[200px]"}>
            {isExpanded && !isPinned && <label className="block text-sm font-medium text-k-dark-grey mb-2">Department</label>}
            <FormAutocomplete
              value={departmentName}
              onChange={(value) => {
                setDepartmentName(value);
                if (!value) handleChange("department_id", "");
              }}
              onIdChange={(id) => handleChange("department_id", id)}
              type="departments"
              placeholder={isExpanded && !isPinned ? "Select Department" : "Department"}
              containerClassName="w-full"
            />
          </div>
        ) : null;

      case "job_title_id":
        return showJobTitle ? (
          <div className={isPinned ? pinnedWidth : "min-w-[200px]"}>
            {isExpanded && !isPinned && <label className="block text-sm font-medium text-k-dark-grey mb-2">Job Title</label>}
            <FormAutocomplete
              value={jobTitleName}
              onChange={(value) => {
                setJobTitleName(value);
                if (!value) handleChange("job_title_id", "");
              }}
              onIdChange={(id) => handleChange("job_title_id", id)}
              type="jobTitles"
              placeholder={isExpanded && !isPinned ? "Select Job Title" : "Job Title"}
              containerClassName="w-full"
            />
          </div>
        ) : null;

      case "leave_type_id":
        return showLeaveType ? (
          <div className={isPinned ? pinnedWidth : "min-w-[180px]"}>
            <FormField
              label={isExpanded && !isPinned ? "Leave Type" : undefined}
              name="leave_type_id"
              type="select"
              value={filters.leave_type_id || ""}
              onChange={(e) => handleChange("leave_type_id", e.target.value)}
              options={leaveTypeOptions}
              placeholder={isExpanded && !isPinned ? undefined : "Leave Type"}
            />
          </div>
        ) : null;

      case "gender":
        return showGender ? (
          <div className={isPinned ? "w-32" : "min-w-[150px]"}>
            <FormField
              label={isExpanded && !isPinned ? "Gender" : undefined}
              name="gender"
              type="select"
              value={filters.gender || ""}
              onChange={(e) => handleChange("gender", e.target.value)}
              options={GENDER_OPTIONS}
              placeholder={isExpanded && !isPinned ? undefined : "Gender"}
            />
          </div>
        ) : null;

      case "manager_id":
        return showManager ? (
          <div className={isPinned ? pinnedWidth : "min-w-[200px]"}>
            {isExpanded && !isPinned && <label className="block text-sm font-medium text-k-dark-grey mb-2">Manager</label>}
            <FormAutocomplete
              value={managerName}
              onChange={(value) => {
                setManagerName(value);
                if (!value) handleChange("manager_id", "");
              }}
              onIdChange={(id) => handleChange("manager_id", id)}
              type="managers"
              placeholder={isExpanded && !isPinned ? "Select Manager" : "Manager"}
              containerClassName="w-full"
            />
          </div>
        ) : null;

      case "status":
        return showStatus && statusOptions.length > 0 ? (
          <div className={isPinned ? "w-36" : "min-w-[160px]"}>
            <FormField
              label={isExpanded && !isPinned ? "Status" : undefined}
              name="status"
              type="select"
              value={filters.status || ""}
              onChange={(e) => handleChange("status", e.target.value)}
              options={statusOptions}
              placeholder={isExpanded && !isPinned ? undefined : "Status"}
            />
          </div>
        ) : null;

      case "start_date":
        return showDateRange ? (
          <div className={isPinned ? "w-36" : "min-w-[160px]"}>
            <FormField
              label={isExpanded && !isPinned ? "Start Date From" : undefined}
              name="start_date"
              type="date"
              value={filters.start_date || ""}
              onChange={(e) => handleChange("start_date", e.target.value)}
            />
          </div>
        ) : null;

      case "end_date":
        return showDateRange ? (
          <div className={isPinned ? "w-36" : "min-w-[160px]"}>
            <FormField
              label={isExpanded && !isPinned ? "End Date To" : undefined}
              name="end_date"
              type="date"
              value={filters.end_date || ""}
              onChange={(e) => handleChange("end_date", e.target.value)}
            />
          </div>
        ) : null;

      default:
        return null;
    }
  };

  const availableFilters: { key: FilterKey; label: string; visible: boolean }[] = [
    { key: "department_id", label: "Department", visible: !!showDepartment },
    { key: "job_title_id", label: "Job Title", visible: !!showJobTitle },
    { key: "leave_type_id", label: "Leave Type", visible: !!showLeaveType },
    { key: "gender", label: "Gender", visible: !!showGender },
    { key: "manager_id", label: "Manager", visible: !!showManager },
    { key: "status", label: "Status", visible: !!showStatus && statusOptions.length > 0 },
    { key: "start_date", label: "Start Date", visible: !!showDateRange },
    { key: "end_date", label: "End Date", visible: !!showDateRange },
  ];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Top Row: Search, Pinned Filters, Sort, Actions */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        {showSearch && (
          <div className="min-w-[220px] max-w-xs relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search || ""}
              onChange={(e) => handleChange("search", e.target.value)}
              className="w-full pl-11 pr-4 h-12 rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-primary-light focus:border-primary text-base text-k-dark-grey placeholder:text-k-medium-grey transition-all"
            />
          </div>
        )}

        {/* Pinned Filters */}
        {pinnedFilters.map(key => (
          <div key={key} className="hidden lg:block">
            {renderFilterInput(key, true)}
          </div>
        ))}

        {showSort && (
          <div className="flex items-center gap-2">

            <div className="w-40">
              <FormField
                name="sortBy"
                type="select"
                value={filters.sortBy || "__none__"}
                onChange={(e) => handleChange("sortBy", e.target.value)}
                options={sortFieldOptions}
              />
            </div>
            <button
              onClick={toggleSort}
              className="h-12 w-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-all hover:border-k-orange group shrink-0"
              title={filters.order === "asc" ? "Ascending" : "Descending"}
            >
              {filters.order === "asc" ? (
                <MdArrowUpward className="w-5 h-5 text-gray-500 group-hover:text-k-orange transition-colors" />
              ) : (
                <MdArrowDownward className="w-5 h-5 text-gray-500 group-hover:text-k-orange transition-colors" />
              )}
            </button>
          </div>
        )}

        {/* Settings Button */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${showSettings
                ? "bg-primary-light border-primary text-primary"
                : "border-gray-200 bg-white text-gray-500 hover:text-k-orange hover:border-k-orange"
              }`}
            title="Pin Filters"
          >
            <FiSettings className="w-5 h-5" />
          </button>

          {/* Settings Popup */}
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-[slideDown_0.1s]">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                <span className="font-semibold text-gray-800">Pin Filters</span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Select filters to pin to the top bar for quick access.</p>
              <div className="space-y-1">
                {availableFilters.filter(f => f.visible).map(option => (
                  <button
                    key={option.key}
                    onClick={() => togglePin(option.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    <span className="text-gray-700">{option.label}</span>
                    {pinnedFilters.includes(option.key) && (
                      <FiCheck className="text-k-orange" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 h-12 px-5 rounded-xl border text-sm font-semibold transition-all ${isExpanded || activeFiltersCount > 0
              ? "bg-gradient-to-r from-primary to-primary-dark border-primary text-white shadow-md shadow-primary/20"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-k-orange"
            }`}
        >
          <FiFilter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isExpanded || activeFiltersCount > 0
                ? "bg-white/20 text-white"
                : "bg-k-orange text-white"
              }`}>
              {activeFiltersCount}
            </span>
          )}
          <FiChevronDown
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""
              }`}
          />
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 h-12 px-4 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Clear All Filters"
          >
            <FiX className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Expanded Filter Options (exclude pinned ones) */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-5 bg-gradient-to-b from-gray-50/50 to-white animate-[slideDown_0.2s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableFilters
              .filter(f => f.visible && !pinnedFilters.includes(f.key))
              .map(f => (
                <div key={f.key}>
                  {renderFilterInput(f.key)}
                </div>
              ))
            }
          </div>

          {onApply && (
            <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
              <Button onClick={onApply} variant="primary">
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
