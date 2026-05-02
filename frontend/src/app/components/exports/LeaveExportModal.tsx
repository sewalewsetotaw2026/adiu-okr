import { useEffect, useMemo, useState } from "react";
import { FiX, FiDownload, FiCheck } from "react-icons/fi";
import { MdPictureAsPdf, MdTableChart, MdDescription } from "react-icons/md";
import Button from "../Core/ui/Button";
import { toast } from "react-hot-toast";
import exportService, {
  ExportField,
  ExportFormat,
  LeaveExportFilters,
} from "../../services/exportService";

interface LeaveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: "SINGLE" | "BULK" | "SELECTION";
  filters?: LeaveExportFilters;
  title?: string;
  ids?: string[] | number[];
  activeTab?: string;
}

const MODULE_ORDER = [
  "EMPLOYEE_INFO",
  "ORGANIZATION_INFO",
  "LEAVE_DETAILS",
  "LEAVE_BALANCE_DETAILS",
  "ADDITIONAL_INFO",
] as const;

const CANONICAL_MODULES: Record<
  (typeof MODULE_ORDER)[number],
  { label: string; columns: { key: string; label: string }[] }
> = {
  EMPLOYEE_INFO: {
    label: "Employee Information",
    columns: [
      { key: "employee.id", label: "Employee ID" },
      { key: "employee.full_name", label: "Full Name" },
      { key: "employee.gender", label: "Gender" },
      { key: "employee_email", label: "Email" },
      { key: "employee_phone", label: "Phone Number" },
      // Flat keys for On-Leave export
      { key: "employee_id", label: "Employee ID" },
      { key: "full_name", label: "Full Name" },
      { key: "gender", label: "Gender" },
      { key: "email", label: "Email" },
      { key: "phone_number", label: "Phone Number" },
    ],
  },
  ORGANIZATION_INFO: {
    label: "Organization",
    columns: [
      {
        key: "employee.employments[0].department.name",
        label: "Department",
      },
      {
        key: "employee.employments[0].jobTitle.title",
        label: "Job Title",
      },
      // Flat keys
      { key: "department", label: "Department" },
      { key: "department_name", label: "Department" }, // For balance
      { key: "job_title", label: "Job Title" },
      { key: "manager_name", label: "Line Manager" },
    ],
  },
  LEAVE_DETAILS: {
    label: "Leave Details",
    columns: [
      { key: "leaveType.name", label: "Leave Type" },
      { key: "leave_type", label: "Leave Type" }, // Flat
      { key: "start_date", label: "Start Date" },
      { key: "end_date", label: "End Date" },
      { key: "return_date", label: "Return Date" },
      { key: "requested_days", label: "Days" },
      { key: "current_status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "created_at", label: "Applied On" },
      { key: "id", label: "Application ID" },
      { key: "is_paid", label: "Paid Leave" },
    ],
  },
  LEAVE_BALANCE_DETAILS: {
    label: "Balance Details",
    columns: [
      { key: "total_entitlement", label: "Total Entitlement" },
      { key: "used_days", label: "Used Days" },
      { key: "remaining_days", label: "Remaining Days" },
      { key: "carried_over", label: "Carried Over" },
      { key: "expiry_date", label: "Expiry Date" },
      { key: "fiscal_year", label: "Year" },
    ],
  },
  ADDITIONAL_INFO: {
    label: "Additional Details",
    columns: [
      { key: "rejection_reason", label: "Rejection Reason" },
      { key: "reliefOfficer.full_name", label: "Relief Officer" },
      { key: "relief_officer", label: "Relief Officer" }, // Flat
    ],
  },
};

// Default HR-detailed set recommended by backend docs
const DEFAULT_FIELD_ORDER: string[] = [
  "employee.id",
  "employee.full_name",
  "employee.gender",
  "employee_email",
  "employee_phone",
  "start_date",
  "end_date",
  "requested_days",
  "employee.employments[0].department.name",
  "employee.employments[0].jobTitle.title",
  "leaveType.name",
  "return_date",
  "current_status",
  "created_at",
  "reason",
  "rejection_reason",
];

const BALANCE_FIELD_ORDER: string[] = [
  "employee.id",
  "employee.full_name",
  "department_name",
  "job_title",
  "leaveType.name",
  "total_entitlement",
  "used_days",
  "remaining_days",
  "expiry_date",
];

const ON_LEAVE_FIELD_ORDER: string[] = [
  "employee_id",
  "full_name",
  "gender",
  "email",
  "phone_number",
  "department",
  "job_title",
  "manager_name",
  "leave_type",
  "start_date",
  "end_date",
  "return_date",
  "requested_days",
  "is_paid",
  "current_status",
  "reason",
  "id",
];

// Employee Personal Leave History - Simplified fields
const PERSONAL_HISTORY_FIELD_ORDER: string[] = [
  "leaveType.name",
  "requested_days", // "Days"
  "start_date",
  "end_date",
  "return_date",
  "reason",
  "current_status",
];

export default function LeaveExportModal({
  isOpen,
  onClose,
  scope,
  filters,
  title = "Export Leave Data",
  ids,
  activeTab,
}: LeaveExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [availableFields, setAvailableFields] = useState<ExportField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [selectedModules, setSelectedModules] = useState<
    Record<string, string[]>
  >({});

  // Determine export type based on active tab
  const exportType = useMemo(() => {
    if (activeTab === "balances") return "leave_balance";
    if (activeTab === "on_leave") return "on_leave";
    return "leave";
  }, [activeTab]);

  const filteredModules = useMemo(() => {
    const labelMap = new Map(availableFields.map((f) => [f.key, f.label]));
    const availableSet = new Set(availableFields.map((f) => f.key));

    return MODULE_ORDER.reduce(
      (acc, key) => {
        const config = CANONICAL_MODULES[key];
        const columns = config.columns
          .map((col) => ({
            key: col.key,
            label: labelMap.get(col.key) || col.label,
          }))
          .filter((col) => availableSet.has(col.key));

        if (columns.length > 0) {
          acc[key] = { ...config, columns };
        }
        return acc;
      },
      {} as Record<
        string,
        { label: string; columns: { key: string; label: string }[] }
      >,
    );
  }, [availableFields]);

  const buildInitialSelection = (fields: ExportField[]) => {
    const availableSet = new Set(fields.map((f) => f.key));

    let defaultFields = DEFAULT_FIELD_ORDER;
    // Personal Employee Leave History (scope=SINGLE)
    if (scope === "SINGLE" && exportType === "leave") {
      defaultFields = PERSONAL_HISTORY_FIELD_ORDER;
    } else if (activeTab === "balances") {
      defaultFields = BALANCE_FIELD_ORDER;
    } else if (activeTab === "on_leave") {
      defaultFields = ON_LEAVE_FIELD_ORDER;
    }

    // Create a Set of fields that should be selected by default
    const fieldsToSelect = new Set(defaultFields.filter((key) => availableSet.has(key)));
    const nextSelection: Record<string, string[]> = {};

    MODULE_ORDER.forEach((moduleKey) => {
      const moduleCols = CANONICAL_MODULES[moduleKey].columns
        .map((c) => c.key)
        .filter((key) => availableSet.has(key)); // Only consider available fields

      // Filter the module columns to only those in fieldsToSelect
      const selectedInModule = moduleCols.filter(key => fieldsToSelect.has(key));

      // If we are in "All Leaves" or generic mode and no defaults match, you might want a fallback.
      // But for PERSONAL scope, strict filtering is what we want.

      // If no specific defaults matched for this module, leave it empty (unchecked)
      nextSelection[moduleKey] = selectedInModule;
    });

    return nextSelection;
  };

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingFields(true);

    exportService
      .getExportFields(exportType as any)
      .then((data) => {
        if (!active) return;
        const safeData = Array.isArray(data) ? data : [];
        setAvailableFields(safeData);
        setSelectedModules(buildInitialSelection(safeData));
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to fetch export fields:", err);
        setAvailableFields([]);
        setSelectedModules({});
        toast.error("Could not load export fields");
      })
      .finally(() => {
        if (active) setIsLoadingFields(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, exportType, activeTab]);

  const toggleColumn = (moduleKey: string, colKey: string) => {
    if (!filteredModules[moduleKey]) return;

    setSelectedModules((prev) => {
      const currentCols = prev[moduleKey] || [];
      if (currentCols.includes(colKey)) {
        return {
          ...prev,
          [moduleKey]: currentCols.filter((k) => k !== colKey),
        };
      }
      return {
        ...prev,
        [moduleKey]: [...currentCols, colKey],
      };
    });
  };

  const toggleModule = (moduleKey: string) => {
    const moduleConfig = filteredModules[moduleKey];
    if (!moduleConfig) return;

    const allCols = moduleConfig.columns.map((c) => c.key);
    const currentCols = selectedModules[moduleKey] || [];

    if (currentCols.length === allCols.length) {
      setSelectedModules((prev) => ({ ...prev, [moduleKey]: [] }));
    } else {
      setSelectedModules((prev) => ({ ...prev, [moduleKey]: allCols }));
    }
  };

  const handleExport = async () => {
    const rawFields = MODULE_ORDER.flatMap((key) => {
      const moduleConfig = filteredModules[key];
      if (!moduleConfig) return [] as string[];

      return moduleConfig.columns
        .filter((col) => (selectedModules[key] || []).includes(col.key))
        .map((col) => col.key);
    });

    const uniqueFields = rawFields.filter(
      (value, index, self) => self.indexOf(value) === index,
    );

    if (uniqueFields.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    const normalizedStatus = filters?.status?.toUpperCase();
    const isAllStatus = !normalizedStatus || normalizedStatus === "ALL" || normalizedStatus === "__ALL__";

    const cleanedFilters: LeaveExportFilters = {
      ...(!isAllStatus ? { status: normalizedStatus } : {}),
      ...(filters?.leave_type_id && filters.leave_type_id !== "__all__"
        ? { leave_type_id: filters.leave_type_id }
        : {}),
      ...(filters?.start_date ? { start_date: filters.start_date } : {}),
      ...(filters?.end_date ? { end_date: filters.end_date } : {}),
      ...(filters?.search ? { search: filters.search } : {}),
      ...(filters?.employee_id ? { employee_id: filters.employee_id } : {}),
      activeTab: activeTab,
    };

    try {
      setLoading(true);

      let blob;

      if (activeTab === "balances") {
        blob = await exportService.exportLeaveBalances({
          format,
          fields: uniqueFields,
          filters: cleanedFilters,
          scope,
          ids: scope === "SELECTION" ? ids : [],
        });
      } else if (activeTab === "on_leave") {
        blob = await exportService.exportOnLeaveEmployees({
          format,
          fields: uniqueFields,
          filters: cleanedFilters,
          scope,
          ids: scope === "SELECTION" ? ids : [],
        });
      } else {
        blob = await exportService.exportLeaves({
          format,
          fields: uniqueFields,
          filters: cleanedFilters,
          scope,
          ids: scope === "SELECTION" ? ids : [],
        });
      }

      const extension = exportService.getFileExtension(format);
      const filename = `leave_${activeTab || "export"}_${new Date()
        .toISOString()
        .slice(0, 10)}.${extension}`;

      exportService.downloadFile(blob, filename);

      toast.success("Export generated successfully");
      setTimeout(onClose, 500);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to generate export");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">
              Select format and columns to export
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
                  value: "xlsx" as ExportFormat,
                  label: "Excel (.xlsx)",
                  icon: MdDescription,
                  iconClassName: "text-green-700",
                  desc: "Best for analysis & editing",
                },
                {
                  value: "csv" as ExportFormat,
                  label: "CSV (.csv)",
                  icon: MdTableChart,
                  iconClassName: "text-green-600",
                  desc: "Plain text data export",
                },
                {
                  value: "pdf" as ExportFormat,
                  label: "PDF (.pdf)",
                  icon: MdPictureAsPdf,
                  iconClassName: "text-red-500",
                  desc: "Print-ready document",
                },
              ].map((fmt) => (
                <div
                  key={fmt.value}
                  onClick={() => setFormat(fmt.value)}
                  className={`cursor-pointer border-2 rounded-xl p-4 flex items-start gap-3 transition-all ${format === fmt.value
                    ? "border-primary bg-primary-light/50 scale-[1.02] shadow-sm"
                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <div className={`text-2xl ${fmt.iconClassName}`}>
                    <fmt.icon />
                  </div>
                  <div className="text-left">
                    <div
                      className={`font-bold ${format === fmt.value
                        ? "text-primary"
                        : "text-gray-700"
                        }`}
                    >
                      {fmt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{fmt.desc}</div>
                  </div>
                  {format === fmt.value && (
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
                  onClick={() => {
                    const allSelected: Record<string, string[]> = {};
                    Object.entries(filteredModules).forEach(([key, config]) => {
                      allSelected[key] = config.columns.map((c) => c.key);
                    });
                    setSelectedModules(allSelected);
                  }}
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                  disabled={isLoadingFields}
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const emptySelection: Record<string, string[]> = {};
                    Object.keys(filteredModules).forEach(
                      (k) => (emptySelection[k] = []),
                    );
                    setSelectedModules(emptySelection);
                  }}
                  className="text-sm font-medium text-gray-400 hover:text-gray-600"
                  disabled={isLoadingFields}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {isLoadingFields ? (
              <div className="text-sm text-gray-500">
                Loading available fields...
              </div>
            ) : Object.keys(filteredModules).length === 0 ? (
              <div className="text-sm text-gray-500">
                No export fields available.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(filteredModules).map(([moduleKey, config]) => {
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
            )}
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
            className="bg-primary-dark hover:bg-primary text-white px-8 shadow-lg shadow-primary/20 border-transparent"
            onClick={handleExport}
            disabled={loading}
            icon={loading ? undefined : FiDownload}
          >
            {loading ? "Processing..." : "Export Data"}
          </Button>
        </div>
      </div>
    </div>
  );
}
