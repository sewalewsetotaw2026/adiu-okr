import React from "react";
import {
  MdCloudUpload,
  MdDelete,
  MdFilePresent,
  MdRemoveRedEye,
  MdError,
  MdAdd,
  MdCheckCircle,
  MdCancel,
} from "react-icons/md";

export interface FileItem {
  id?: string;
  file?: File;
  url?: string;
  name?: string;
  uploading?: boolean;
  error?: string;
  progress?: number;
}

interface UniversalFileUploadProps {
  label?: string;
  required?: boolean;
  files: (FileItem | string)[];
  multiple?: boolean;
  onFileChange: (files: File[]) => void;
  onRemove: (index: number) => void;
  onCancel?: (index: number) => void;
  error?: string;
  accept?: string;
  readOnly?: boolean;
  lockExisting?: boolean;
  maxFiles?: number;
}

export default function UniversalFileUpload({
  label,
  required = false,
  files = [],
  multiple = false,
  onFileChange,
  onRemove,
  onCancel,
  error,
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  readOnly = false,
  lockExisting = false,
  maxFiles,
}: UniversalFileUploadProps) {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      if (!multiple) {
        onFileChange([newFiles[0]]);
      } else {
        onFileChange(newFiles);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (!multiple) {
        onFileChange([newFiles[0]]);
      } else {
        onFileChange(newFiles);
      }
    }
    // Reset input value to allow the same file to be selected again if needed
    e.target.value = "";
  };

  const normalizedFiles = files
    .filter(Boolean)
    .map((f, idx) => {
      if (typeof f === "string") {
        return {
          url: f,
          name: f.split("/").pop() || `Document ${idx + 1}`,
          uploading: false,
        } as FileItem;
      }
      return f as FileItem;
    });

  const showDropzone = !readOnly && (multiple || normalizedFiles.length === 0);
  const canAddMore =
    multiple || normalizedFiles.length < (maxFiles || 1);

  return (
    <div className="space-y-2.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-800">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Unified Files Container */}
      <div className={`rounded-xl border-2 ${error ? "border-red-300 bg-red-50/30" : "border-gray-200 bg-gray-50/30"
        } p-4 space-y-3`}>

        {/* File List */}
        {normalizedFiles.map((file, index) => (
          <div
            key={file.id || index}
            className={`group flex items-center justify-between p-3.5 bg-white rounded-lg border transition-all duration-200 hover:shadow-md ${file.error
              ? "border-red-200 bg-red-50/50 hover:border-red-300"
              : file.uploading
                ? "border-primary-light bg-primary-light/30 hover:border-primary"
                : "border-gray-200 hover:border-primary"
              }`}
          >
            <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
              <div
                className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${file.error
                  ? "bg-red-100 text-red-600"
                  : file.uploading
                    ? "bg-primary-light text-primary animate-pulse"
                    : "bg-primary-light text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-105"
                  }`}
              >
                {file.uploading ? (
                  <MdCloudUpload size={22} />
                ) : file.error ? (
                  <MdError size={22} />
                ) : (
                  <MdFilePresent size={22} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                  {file.name}
                </p>
                {file.uploading ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className="h-full bg-gradient-to-r from-primary-light to-primary transition-all duration-300 rounded-full"
                        style={{ width: `${file.progress || 30}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-primary font-semibold">
                      {file.progress ? `${file.progress}%` : "Uploading"}
                    </span>
                  </div>
                ) : file.error ? (
                  <p className="text-xs text-red-600 truncate mt-0.5">{file.error}</p>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MdCheckCircle className="text-green-500" size={14} />
                    <span className="text-xs text-gray-500 font-medium">Ready</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 ml-2">
              {file.uploading && onCancel && (
                <button
                  onClick={() => onCancel(index)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Cancel upload"
                  type="button"
                >
                  <MdCancel size={20} />
                </button>
              )}
              {file.url && (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light rounded-lg transition-all duration-150"
                  title="View Document"
                >
                  <MdRemoveRedEye size={20} />
                </a>
              )}
              {(!lockExisting || (!file.url || file.uploading)) && !readOnly && (
                <button
                  onClick={() => onRemove(index)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-150 cursor-pointer"
                  title="Remove file"
                  type="button"
                >
                  <MdDelete size={20} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add More Files Button - Inside the same container */}
        {showDropzone && canAddMore && (
          <div
            className={`relative border-2 border-dashed rounded-lg transition-all duration-200 bg-white ${normalizedFiles.length > 0
                ? "p-4 min-h-[56px] border-gray-200 hover:border-primary hover:bg-primary-light"
                : "p-8 border-gray-300 hover:border-primary hover:bg-primary-light"
              } group cursor-pointer`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              multiple={multiple}
              accept={accept}
              onChange={handleInputChange}
            />
            <div
              className={`flex items-center justify-center gap-3 ${normalizedFiles.length > 0 ? "flex-row" : "flex-col"
                }`}
            >
              <div
                className={`rounded-full flex items-center justify-center transition-all duration-200 ${normalizedFiles.length > 0
                  ? "w-8 h-8 bg-primary-light text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-105"
                  : "w-12 h-12 bg-primary-light text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-110"
                  }`}
              >
                {normalizedFiles.length > 0 ? (
                  <MdAdd size={20} className="group-hover:rotate-90 transition-transform duration-200" />
                ) : (
                  <MdCloudUpload size={26} className="group-hover:scale-110 transition-transform duration-200" />
                )}
              </div>
              <div className={normalizedFiles.length > 0 ? "text-left" : "text-center"}>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors duration-150">
                  {normalizedFiles.length > 0 ? "Add more files" : "Upload Documents"}
                </p>
                {normalizedFiles.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Click or drag and drop files here
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-xs mt-1.5 ml-1 font-medium">{error}</p>}
    </div>
  );
}
