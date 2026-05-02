import { useState, useEffect } from "react";
import { FiCheck, FiDownload, FiFileText } from "react-icons/fi";
import { MdPictureAsPdf, MdTableChart, MdDescription } from "react-icons/md";
import Modal from "./Modal";
import Button from "../Core/ui/Button";
import exportService, {
  ExportField,
  ExportFormat,
} from "../../services/exportService";

interface FieldSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, fields: string[]) => void;
  type: "employee" | "employment";
  title?: string;
  loading?: boolean;
}

const FORMAT_OPTIONS = [
  {
    value: "pdf" as ExportFormat,
    label: "PDF",
    icon: MdPictureAsPdf,
    color: "text-red-500",
    description: "Best for printing and sharing",
  },
  {
    value: "csv" as ExportFormat,
    label: "CSV",
    icon: MdTableChart,
    color: "text-green-600",
    description: "For spreadsheet applications",
  },
  {
    value: "xlsx" as ExportFormat,
    label: "Excel",
    icon: MdDescription,
    color: "text-green-700",
    description: "Microsoft Excel format",
  },
];

export default function FieldSelectorModal({
  isOpen,
  onClose,
  onExport,
  type,
  title = "Export Data",
  loading = false,
}: FieldSelectorModalProps) {
  const [fields, setFields] = useState<ExportField[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("xlsx");
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Fetch available fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingFields(true);
      exportService
        .getExportFields(type)
        .then((data) => {
          setFields(data);
          // Pre-select all fields by default
          setSelectedFields(data.map((f) => f.key));
        })
        .catch((err) => {
          console.error("Failed to fetch export fields:", err);
          setFields([]);
        })
        .finally(() => {
          setIsLoadingFields(false);
        });
    }
  }, [isOpen, type]);

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleSelectAll = () => {
    setSelectedFields(fields.map((f) => f.key));
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleExport = () => {
    if (selectedFields.length === 0) return;
    onExport(selectedFormat, selectedFields);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Select Format
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map((format) => {
              const Icon = format.icon;
              const isSelected = selectedFormat === format.value;
              return (
                <button
                  key={format.value}
                  onClick={() => setSelectedFormat(format.value)}
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                    ? "border-k-orange bg-k-orange/5"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                >
                  <Icon className={`w-8 h-8 mb-2 ${format.color}`} />
                  <span className="font-medium text-sm text-gray-800">
                    {format.label}
                  </span>
                  <span className="text-xs text-gray-500 text-center mt-1">
                    {format.description}
                  </span>
                  {isSelected && (
                    <div className="mt-2 w-5 h-5 bg-k-orange rounded-full flex items-center justify-center">
                      <FiCheck className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Field Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Select Fields to Export
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-k-orange hover:underline font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-gray-500 hover:underline font-medium"
              >
                Deselect All
              </button>
            </div>
          </div>

          {isLoadingFields ? (
            <div className="space-y-3 py-6 px-4">
              <div className="h-10 w-full shimmer-bg rounded-xl" />
              <div className="h-10 w-full shimmer-bg rounded-xl" />
              <div className="h-10 w-full shimmer-bg rounded-xl" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiFileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              No fields available
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-3 space-y-1">
              {fields.map((field) => {
                const isSelected = selectedFields.includes(field.key);
                return (
                  <label
                    key={field.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-k-orange/5" : "hover:bg-gray-50"
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                        ? "bg-k-orange border-k-orange"
                        : "border-gray-300"
                        }`}
                    >
                      {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleField(field.key)}
                      className="sr-only"
                    />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            {selectedFields.length} of {fields.length} fields selected
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button
            variant="secondary"
            onClick={onClose}
            loading={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={FiDownload}
            onClick={handleExport}
            loading={loading}
            disabled={selectedFields.length === 0 || loading}
          >
            Export {selectedFormat.toUpperCase()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
