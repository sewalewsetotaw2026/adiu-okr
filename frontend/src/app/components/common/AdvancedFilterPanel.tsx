import { useEffect, useState } from "react";
import { FiSearch, FiX, FiChevronDown, FiFilter } from "react-icons/fi";
import Button from "../Core/ui/Button";
import adminService from "../../services/adminService";

export interface FilterValues {
  search?: string;
  department_id?: string;
  job_title_id?: string;
  employment_type?: string;
  status?: string;
  gender?: string;
  hire_date_from?: string;
  hire_date_to?: string;
}

interface AdvancedFilterPanelProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  onApply?: () => void;
  showSearch?: boolean;
  showDepartment?: boolean;
  showJobTitle?: boolean;
  showEmploymentType?: boolean;
  showStatus?: boolean;
  showGender?: boolean;
  showDateRange?: boolean;
  className?: string;
}

const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Outsourced"];
const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Probation", value: "probation" },
];
const GENDER_OPTIONS = [
  { label: "All Genders", value: "" },
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
];

export default function AdvancedFilterPanel({
  filters,
  onFilterChange,
  onApply,
  showSearch = true,
  showDepartment = true,
  showJobTitle = true,
  showEmploymentType = true,
  showStatus = true,
  showGender = true,
  showDateRange = true,
  className = "",
}: AdvancedFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobTitles, setJobTitles] = useState<any[]>([]);

  // Fetch departments and job titles on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedDepartments, fetchedJobTitles] = await Promise.all([
          adminService.getDepartments(),
          adminService.getJobTitles(),
        ]);
        setDepartments(fetchedDepartments);
        setJobTitles(fetchedJobTitles);
      } catch (error) {
        console.error("Failed to fetch filter options", error);
      }
    };
    fetchData();
  }, []);

  const handleChange = (key: keyof FilterValues, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onFilterChange({
      search: "",
      department_id: "",
      job_title_id: "",
      employment_type: "",
      status: "",
      gender: "",
      hire_date_from: "",
      hire_date_to: "",
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== "search"
  ).length;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Search and Toggle Row */}
      <div className="flex items-center gap-3 p-4">
        {showSearch && (
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, ID, or TIN..."
              value={filters.search || ""}
              onChange={(e) => handleChange("search", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary text-sm"
            />
          </div>
        )}

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${isExpanded || activeFiltersCount > 0
            ? "bg-k-orange/10 border-k-orange text-k-orange"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
        >
          <FiFilter className="w-4 h-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
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
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FiX className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Expanded Filter Options */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 animate-[slideDown_0.2s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {showDepartment && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Department
                </label>
                <select
                  value={filters.department_id || ""}
                  onChange={(e) => handleChange("department_id", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange bg-white cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showJobTitle && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Job Title
                </label>
                <select
                  value={filters.job_title_id || ""}
                  onChange={(e) => handleChange("job_title_id", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange bg-white cursor-pointer"
                >
                  <option value="">All Job Titles</option>
                  {jobTitles.map((job: any) => (
                    <option key={job.id} value={job.id}>
                      {job.title} {job.level && `- ${job.level}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showEmploymentType && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Employment Type
                </label>
                <select
                  value={filters.employment_type || ""}
                  onChange={(e) => handleChange("employment_type", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange bg-white cursor-pointer"
                >
                  <option value="">All Types</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showStatus && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Status
                </label>
                <select
                  value={filters.status || ""}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange bg-white cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showGender && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Gender
                </label>
                <select
                  value={filters.gender || ""}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange bg-white cursor-pointer"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showDateRange && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Hire Date From
                  </label>
                  <input
                    type="date"
                    value={filters.hire_date_from || ""}
                    onChange={(e) => handleChange("hire_date_from", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Hire Date To
                  </label>
                  <input
                    type="date"
                    value={filters.hire_date_to || ""}
                    onChange={(e) => handleChange("hire_date_to", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange"
                  />
                </div>
              </>
            )}
          </div>

          {onApply && (
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
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
