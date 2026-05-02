import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FiX, FiDownload, FiCheck } from "react-icons/fi";
import { MdPictureAsPdf, MdTableChart, MdDescription } from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";
import { useEmployeesSlice } from "../slice";
import {
  selectEmployeesLoading,
  selectEmployeeFilters,
  selectExportSuccess,
} from "../slice/selectors";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: "SINGLE" | "BULK";
  employeeId?: string; // For single export
  selectedIds?: string[]; // For bulk selection
  totalCount?: number; // For bulk export context
}

const EXPORT_MODULES = {
  EMPLOYEE_MASTER: {
    label: "Personal Information",
    columns: [
      { key: "EMPLOYEE_ID", label: "Employee ID" },
      { key: "FULL_NAME", label: "Full Name" },
      { key: "GENDER", label: "Gender" },
      { key: "DATE_OF_BIRTH", label: "Date of Birth" },
      { key: "TIN_NUMBER", label: "TIN Number" },
      { key: "PENSION_NUMBER", label: "Pension Number" },
      { key: "PLACE_OF_WORK", label: "Place of Work" },
    ],
  },
  EMPLOYMENT_INFO: {
    label: "Employment Details",
    columns: [
      { key: "JOB_TITLE", label: "Job Title" },
      { key: "DEPARTMENT", label: "Department" },
      { key: "START_DATE", label: "Start Date" },
      { key: "END_DATE", label: "End Date" },
      { key: "EMPLOYMENT_TYPE", label: "Employment Type" },
      { key: "GROSS_SALARY", label: "Gross Salary" },
      { key: "BASIC_SALARY", label: "Basic Salary" },
      { key: "ALLOWANCES_LIST", label: "Allowances List" },
      { key: "STATUS", label: "Status" },
      { key: "MANAGER", label: "Manager" },
    ],
  },
  CONTACT_INFO: {
    label: "Contact Information",
    columns: [
      { key: "PHONE_NUMBERS", label: "Phone Numbers" },
      { key: "ADDRESSES", label: "Addresses" },
      { key: "EMERGENCY_CONTACTS", label: "Emergency Contacts" },
    ],
  },
  EDUCATION: {
    label: "Education",
    columns: [
      { key: "EDUCATION_HISTORY", label: "Education History" },
    ],
  },
  WORK_EXPERIENCE: {
    label: "PreviousWork Experience",
    columns: [
      { key: "EXPERIENCE_HISTORY", label: "Experience History" },
    ],
  },
  COST_SHARING: {
    label: "Cost Sharing",
    columns: [
      { key: "COST_SHARING_INFO", label: "Cost Sharing Info" },
    ],
  },
};

export default function ExportModal({
  isOpen,
  onClose,
  scope,
  employeeId,
  selectedIds,
  totalCount,
}: ExportModalProps) {
  const dispatch = useDispatch();
  const { actions } = useEmployeesSlice();
  const loading = useSelector(selectEmployeesLoading);
  const filters = useSelector(selectEmployeeFilters);
  const exportSuccess = useSelector(selectExportSuccess);

  const [format, setFormat] = useState<"excel" | "csv" | "pdf">("excel");

  // Initialize all selected
  const initialSelection: Record<string, string[]> = {};
  Object.keys(EXPORT_MODULES).forEach((moduleKey) => {
    const key = moduleKey as keyof typeof EXPORT_MODULES;
    initialSelection[key] = EXPORT_MODULES[key].columns.map((c) => c.key);
  });

  const [selectedModules, setSelectedModules] =
    useState<Record<string, string[]>>(initialSelection);

  useEffect(() => {
    if (isOpen) {
      // Reset state on open if needed
      dispatch(actions.resetSuccessStates());
    }
  }, [isOpen, dispatch, actions]);

  // Auto-close modal on successful export
  useEffect(() => {
    if (exportSuccess && isOpen) {
      // Small delay to show success before closing
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [exportSuccess, isOpen, onClose]);

  const toggleColumn = (moduleKey: string, colKey: string) => {
    setSelectedModules((prev) => {
      const currentCols = prev[moduleKey] || [];
      if (currentCols.includes(colKey)) {
        return {
          ...prev,
          [moduleKey]: currentCols.filter((k) => k !== colKey),
        };
      } else {
        return {
          ...prev,
          [moduleKey]: [...currentCols, colKey],
        };
      }
    });
  };

  const toggleModule = (moduleKey: string) => {
    const key = moduleKey as keyof typeof EXPORT_MODULES;
    const allCols = EXPORT_MODULES[key].columns.map((c) => c.key);
    const currentCols = selectedModules[key] || [];

    if (currentCols.length === allCols.length) {
      // Deselect all
      setSelectedModules((prev) => ({ ...prev, [key]: [] }));
    } else {
      // Select all
      setSelectedModules((prev) => ({ ...prev, [key]: allCols }));
    }
  };

  const handleExport = () => {
    dispatch(
      actions.exportEmployeesRequest({
        scope: {
          type: scope,
          employee_id: employeeId,
          employee_ids: selectedIds,
          export_all:
            scope === "BULK" && (!selectedIds || selectedIds.length === 0),
        },
        modules: selectedModules,
        format: format,
        filters: filters,
      })
    );
    // Don't close immediately - let the user see the loading state
    // The modal will stay open while processing
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Export Employees
            </h3>
            <p className="text-sm text-gray-500">
              {scope === "SINGLE"
                ? "Exporting details for selected employee"
                : selectedIds && selectedIds.length > 0
                  ? `Exporting ${selectedIds.length} selected employees`
                  : `Exporting ${totalCount || "all"} employees`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 1. Format Selection */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              1. Select Format
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  id: "excel",
                  label: "Excel (.xlsx)",
                  icon: MdDescription,
                  iconClassName: "text-green-700",
                  desc: "Best for analysis & editing",
                },
                {
                  id: "csv",
                  label: "CSV (.csv)",
                  icon: MdTableChart,
                  iconClassName: "text-green-600",
                  desc: "Plain text data export",
                },
                {
                  id: "pdf",
                  label: "PDF (.pdf)",
                  icon: MdPictureAsPdf,
                  iconClassName: "text-red-500",
                  desc: "Print-ready details",
                },
              ].map((fmt) => (
                <div
                  key={fmt.id}
                  onClick={() => setFormat(fmt.id as any)}
                  className={`cursor-pointer border-2 rounded-xl p-4 flex items-start gap-3 transition-all ${format === fmt.id
                    ? "border-primary bg-primary-light/50 scale-[1.02] shadow-sm"
                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <div className={`text-2xl ${fmt.iconClassName}`}>
                    <fmt.icon />
                  </div>
                  <div className="text-left">
                    <div
                      className={`font-bold ${format === fmt.id ? "text-primary" : "text-gray-700"
                        }`}
                    >
                      {fmt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{fmt.desc}</div>
                  </div>
                  {format === fmt.id && (
                    <div className="absolute top-3 right-3 text-primary">
                      <FiCheck size={18} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Data Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                2. Select Data Columns
              </h4>
              <div className="space-x-4">
                <button
                  onClick={() => setSelectedModules(initialSelection)}
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const emptySelection: Record<string, string[]> = {};
                    Object.keys(EXPORT_MODULES).forEach(
                      (k) => (emptySelection[k] = [])
                    );
                    setSelectedModules(emptySelection);
                  }}
                  className="text-sm font-medium text-gray-400 hover:text-gray-600"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(EXPORT_MODULES).map(([moduleKey, config]) => {
                const allSelected =
                  (selectedModules[moduleKey]?.length || 0) ===
                  config.columns.length;
                const someSelected =
                  (selectedModules[moduleKey]?.length || 0) > 0;

                return (
                  <div
                    key={moduleKey}
                    className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors bg-gray-50/30"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                      <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => {
                            if (input)
                              input.indeterminate =
                                someSelected && !allSelected;
                          }}
                          onChange={() => toggleModule(moduleKey)}
                          className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                        />
                        {config.label}
                      </label>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {selectedModules[moduleKey]?.length || 0}/
                        {config.columns.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {config.columns.map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none hover:text-gray-900"
                        >
                          <input
                            type="checkbox"
                            checked={
                              !!selectedModules[moduleKey]?.includes(col.key)
                            }
                            onChange={() => toggleColumn(moduleKey, col.key)}
                            className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
          <Button
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-white px-6"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary hover:bg-primary-dark text-white px-8 shadow-lg shadow-primary/10 border-transparent"
            onClick={handleExport}
            loading={loading}
            icon={FiDownload}
          >
            Export Data
          </Button>
        </div>
      </div>
    </div>
  );
}
