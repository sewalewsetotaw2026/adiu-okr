import { useState, useRef, ChangeEvent, DragEvent } from "react";
import {
  MdCloudUpload,
  MdEdit,
  MdClose,
  MdCheckCircle,
  MdError,
  MdArrowForward,
  MdArrowBack,
} from "react-icons/md";
// HrisSpinner replaced by generic spinner
import { extractResumeData } from "../../services/geminiService";
import toast from "react-hot-toast";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAutoFill: (data: any) => void;
  onManualStart: () => void;
}

export default function RegistrationModal({
  isOpen,
  onClose,
  onAutoFill,
  onManualStart,
}: RegistrationModalProps) {
  const [selectedOption, setSelectedOption] = useState<"autofill" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setError("Please upload a PDF, DOC, DOCX, or TXT file");
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleAutoFillSubmit = async () => {
    if (!file) {
      toast.error("Please select a file first");
      setError("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Show loading toast
    const loadingToastId = toast.loading("Processing your resume with AI...");

    try {
      const extractedData = await extractResumeData(file);

      // Dismiss loading toast
      toast.dismiss(loadingToastId);

      // Show success toast
      toast.success("Resume processed successfully! Auto-filling form...");

      setSuccess(true);

      // Wait a moment to show success state
      setTimeout(() => {
        onAutoFill(extractedData);
        onClose();
      }, 800);
    } catch (err: any) {
      console.error("Error processing resume:", err);

      // Dismiss loading toast
      toast.dismiss(loadingToastId);

      // Show error toast
      toast.error(err.message || "Failed to process resume. Please try again.");

      setError(err.message || "Failed to process resume. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleManualOption = () => {
    onManualStart();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[slideUp_0.3s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-primary text-white p-6 rounded-t-2xl z-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold font-heading">
                Employee Registration
              </h2>
              <p className="text-primary-light mt-1 text-opacity-80">
                Choose how you'd like to get started
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <MdClose size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedOption ? (
            /* Option Selection */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Auto-fill Option */}
              <button
                onClick={() => setSelectedOption("autofill")}
                className="group relative bg-primary-light/10 hover:bg-primary-light/20 border-2 border-primary/30 hover:border-primary rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-primary/10 group-hover:bg-primary rounded-full transition-colors duration-300">
                    <MdCloudUpload className="w-12 h-12 text-primary group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-k-dark-grey font-heading">
                      Auto-fill with AI
                    </h3>
                    <p className="text-sm text-k-medium-grey mt-2">
                      Upload your CV/Resume and let AI extract your information
                      automatically
                    </p>
                  </div>
                  <div className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                    Get Started <MdArrowForward className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Manual Option */}
              <button
                onClick={handleManualOption}
                className="group relative bg-linear-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-2 border-gray-300 hover:border-gray-400 rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-gray-200 group-hover:bg-k-dark-grey rounded-full transition-colors duration-300">
                    <MdEdit className="w-12 h-12 text-k-dark-grey group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-k-dark-grey font-heading">
                      Manual Entry
                    </h3>
                    <p className="text-sm text-k-medium-grey mt-2">
                      Fill in your information manually step by step
                    </p>
                  </div>
                  <div className="mt-4 px-4 py-2 bg-k-dark-grey text-white rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                    Start Filling <MdArrowForward className="w-4 h-4" />
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Auto-fill File Upload */
            <div className="space-y-6">
              <button
                onClick={() => {
                  setSelectedOption(null);
                  setFile(null);
                  setError(null);
                }}
                className="text-k-medium-grey hover:text-k-dark-grey flex items-center gap-2 text-sm cursor-pointer"
              >
                <MdArrowBack className="w-4 h-4" /> Back to options
              </button>

              {/* File Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${isDragging
                  ? "border-primary bg-primary-light/50 scale-105"
                  : file
                    ? "border-success bg-green-50"
                    : "border-gray-300 hover:border-primary hover:bg-gray-50"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center space-y-3">
                    <MdCheckCircle className="w-16 h-16 text-success" />
                    <div>
                      <p className="font-medium text-k-dark-grey">
                        {file.name}
                      </p>
                      <p className="text-sm text-k-medium-grey">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setError(null);
                      }}
                      className="text-sm text-error hover:underline cursor-pointer"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    <MdCloudUpload className="w-16 h-16 text-primary" />
                    <div>
                      <p className="text-lg font-medium text-k-dark-grey">
                        Drop your CV/Resume here
                      </p>
                      <p className="text-sm text-k-medium-grey mt-1">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-k-medium-grey">
                      Supported formats: PDF, DOC, DOCX, TXT (Max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-error rounded-xl">
                  <MdError className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-success rounded-xl">
                  <MdCheckCircle className="w-5 h-5 text-success" />
                  <p className="text-sm text-success font-medium">
                    Resume processed successfully! Loading form...
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  onClick={handleAutoFillSubmit}
                  disabled={!file || isProcessing || success}
                  className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 ${!file || isProcessing || success
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary-dark hover:shadow-lg cursor-pointer"
                    }`}
                >
                  {isProcessing ? (
                    <span className="absolute inset-0 w-full h-full shimmer-bg opacity-30" />
                  ) : success ? (
                    "Success"
                  ) : (
                    "Auto-fill Form with AI"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
