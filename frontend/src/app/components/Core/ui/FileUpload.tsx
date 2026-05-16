import React from "react";
import { MdCloudUpload, MdDelete, MdFilePresent, MdRemoveRedEye, MdError } from "react-icons/md";

interface FileUploadProps {
  label?: string;
  required?: boolean;
  file?: File | null;
  currentUrl?: string | null; // For existing files (URL)
  onFileChange?: (file: File | null) => void;
  onRemove?: () => void;
  error?: string;
  accept?: string;
  uploading?: boolean; // New: External uploading state
  readOnly?: boolean; // New: Read-only mode (for Review step)
  fileName?: string; // Optional override for filename display
}

export default function FileUpload({
  label,
  required = false,
  file,
  currentUrl,
  onFileChange,
  onRemove,
  error,
  accept,
  uploading = false,
  readOnly = false,
  fileName
}: FileUploadProps) {

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly || uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0] && onFileChange) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const displayFileName = file?.name || fileName || (currentUrl ? (currentUrl.split('/').pop() || "Document") : "Document");
  const displaySize = file?.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "";

  return (
    <div className="mb-4">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="font-medium text-gray-700 text-sm">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        </div>
      )}

      {/* States: 
          1. Uploading
          2. File Selected / Existing URL Present
          3. Empty (Dropzone)
      */}

      {uploading ? (
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500 animate-pulse">
              <MdCloudUpload size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Uploading...</p>
              {file && <p className="text-xs text-gray-500">{file.name}</p>}
            </div>
          </div>
        </div>
      ) : (file || currentUrl) ? (
        <div className={`bg-white p-3 rounded-xl border ${error ? "border-red-500" : "border-gray-300"} flex items-center justify-between shadow-sm group hover:border-[#FFCC00] transition-colors`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary-light transition-colors">
              <MdFilePresent size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate" title={displayFileName}>
                {displayFileName}
              </p>
              {displaySize && <p className="text-xs text-gray-500">{displaySize}</p>}
              {!displaySize && currentUrl && <span className="text-xs text-primary font-medium">Uploaded</span>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentUrl && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light rounded-full transition-colors"
                title="View Document"
              >
                <MdRemoveRedEye size={20} />
              </a>
            )}

            {!readOnly && onRemove && (
              <button
                onClick={onRemove}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Remove file"
                type="button"
              >
                <MdDelete size={20} />
              </button>
            )}
          </div>
        </div>
      ) : !readOnly ? (
        /* Dropzone View - Only if not readOnly */
        <div
          className={`border-2 border-dashed ${error ? "border-red-300 bg-red-50" : "border-gray-300"} rounded-xl p-4 text-center hover:bg-gray-50 transition-colors relative cursor-pointer group`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            accept={accept}
            onChange={(e) => {
              if (e.target.files && e.target.files[0] && onFileChange) {
                onFileChange(e.target.files[0]);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={uploading}
          />
          <div className="flex flex-col items-center justify-center gap-1 group-hover:scale-105 transition-transform duration-200">
            <div className={`w-10 h-10 rounded-full ${error ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500"} flex items-center justify-center mb-1`}>
              {error ? <MdError size={20} /> : <MdCloudUpload size={20} />}
            </div>
            <p className="text-sm font-medium text-gray-600">{error ? "Upload Failed" : "Click or Drag to Upload"}</p>
            <p className="text-[10px] text-gray-400">{accept ? accept.replace(/,/g, ", ") : "PDF, JPG, PNG"} (Max 5MB)</p>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic p-3 border border-gray-100 rounded-xl bg-gray-50">
          No document provided
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>
      )}
    </div>
  );
}
