import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  MdSave,
  MdRefresh,
  MdArrowBack,
  MdInfo,
  MdCheck,
  MdError,
  MdClose,
  MdInsertDriveFile,
  MdCloudUpload,
} from "react-icons/md";
import toast from "react-hot-toast";
import FormField from "../../../components/common/FormField";
import Button from "../../../components/Core/ui/Button";
import StatusModal from "../../../components/common/StatusModal";
import LeaveDatePicker from "../../../components/common/LeaveDatePicker";
import { leaveActions } from "../../../slice/leaveSlice";
import {
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
} from "../../../slice/leaveSlice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { LeaveType } from "../../../slice/leaveSlice/types";
import { uploadFile } from "../../../services/fileUploadService";
import { useManagerSlice } from "../../../slice/managerSlice";
import { selectIsManager } from "../../../slice/managerSlice/selectors";
import {
  getPublicHolidays,
  PublicHoliday,
} from "../../../services/holidayService";
import { formatIsoDate, formatWithPattern } from "../../../utils/dayjs-format";

interface LeaveFormProps {
  leaveType: LeaveType;
  onBack: () => void;
}

// Calculate estimated working days between two dates (5.5-day week)
// Skips Sundays and public holidays if isCalendarDays is false
const calculateEstimatedDays = (
  startDate: string,
  endDate: string,
  isCalendarDays = false,
  holidays: PublicHoliday[] = [],
): number => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) return 0;

  if (isCalendarDays) {
    // Calendar days: count every day including weekends and holidays
    const diffMs = end.getTime() - start.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  // Build a set of holiday date strings for fast lookup
  const holidaySet = new Set(
    holidays.map((h) => {
      const d = new Date(h.holiday_date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );

  let days = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const isHoliday = holidaySet.has(dateStr);

    if (dayOfWeek === 0 || isHoliday) {
      // Sunday or holiday - 0 days
    } else if (dayOfWeek === 6) {
      // Saturday - 0.5 days
      days += 0.5;
    } else {
      // Mon-Fri - 1 day
      days += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
};

// Calculate estimated return date (next working day after end date)
// Skips Sundays and any known public holidays
const calculateEstimatedReturnDate = (
  endDate: string,
  holidays: PublicHoliday[] = [],
): string => {
  if (!endDate) return "";

  const holidaySet = new Set(
    holidays.map((h) => {
      const d = new Date(h.holiday_date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );

  const returnDate = new Date(endDate);
  returnDate.setDate(returnDate.getDate() + 1);

  // Advance past Sundays and public holidays
  const getDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  while (returnDate.getDay() === 0 || holidaySet.has(getDateStr(returnDate))) {
    returnDate.setDate(returnDate.getDate() + 1);
  }

  return getDateStr(returnDate);
};

export default function LeaveForm({ leaveType, onBack }: LeaveFormProps) {
  const dispatch = useDispatch();
  const { actions: managerActions } = useManagerSlice();
  const isManager = useSelector(selectIsManager);

  useEffect(() => {
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  const user = useSelector(selectAuthUser);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [isStartHalfDay, setIsStartHalfDay] = useState(false);
  const [isEndHalfDay, setIsEndHalfDay] = useState(false);

  // Reset leave state on mount to prevent stale success/error messages
  useEffect(() => {
    dispatch(leaveActions.resetState());
  }, [dispatch]);

  // Fetch holidays for the current year
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    getPublicHolidays(currentYear).then(setHolidays);
  }, []);

  const [formData, setFormData] = useState({
    leaveTypeName: leaveType.name,
    startDate: "",
    endDate: "",
    estimatedDays: "",
    estimatedReturnDate: "",
    reason: "",
    attachmentUrl: "",
  });
  const [fileItem, setFileItem] = useState<{
    file?: File;
    url: string;
    name: string;
    uploading?: boolean;
    error?: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const leaveCode = (leaveType.code || "").toUpperCase();
  const isAnnualLeave = leaveCode === "ANNUAL";
  const isUnpaidLeave = leaveCode === "UNPAID";

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayIso = formatIsoDate(todayDate);

  const annualMinDateObj = new Date(todayDate);
  annualMinDateObj.setDate(annualMinDateObj.getDate() - 4);
  const annualMaxDateObj = new Date(todayDate);
  annualMaxDateObj.setDate(annualMaxDateObj.getDate() + 2);

  const annualMinDateIso = formatIsoDate(annualMinDateObj);
  const annualMaxDateIso = formatIsoDate(annualMaxDateObj);

  const startDateMinForPicker = isUnpaidLeave
    ? todayIso
    : isAnnualLeave
      ? annualMinDateIso
      : undefined;
  const startDateMaxForPicker = isAnnualLeave ? annualMaxDateIso : undefined;

  // Auto-calculate estimated days and return date when dates change
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      // Calculate raw estimation first
      let estimatedDays = calculateEstimatedDays(
        formData.startDate,
        formData.endDate,
        leaveType.is_calendar_days,
        holidays,
      );

      // Apply specific explicit half-day toggles requested by the user
      // Assuming calculateEstimatedDays originally returns full day (1) for these.
      // E.g. subtracting 0.5 for each applied rule. Max subtract 1 (if both checked).
      if (isStartHalfDay && formData.startDate) {
        estimatedDays -= 0.5;
      }
      // If end half day is checked, AND it's a multi-day (so it's a separate day than start), subtract another 0.5
      // Or if it's the exact same day, it was already handled by startHalfDay (or they toggled both... either way we subtract).
      // If it's the same day, we make sure we don't drop below 0.5 total.
      if (
        isEndHalfDay &&
        formData.endDate &&
        formData.startDate !== formData.endDate
      ) {
        estimatedDays -= 0.5;
      }

      // Ensure minimum 0.5
      estimatedDays = Math.max(0.5, estimatedDays);

      const estimatedReturnDate = calculateEstimatedReturnDate(
        formData.endDate,
        holidays,
      );

      setFormData((prev) => ({
        ...prev,
        estimatedDays: estimatedDays.toString(),
        estimatedReturnDate,
      }));
    }
  }, [
    formData.startDate,
    formData.endDate,
    holidays,
    leaveType.is_calendar_days,
    isStartHalfDay,
    isEndHalfDay,
  ]);

  // Handle success/error from Redux
  useEffect(() => {
    if (success && message === "Leave application submitted successfully") {
      setShowSuccessModal(true);
      dispatch(leaveActions.resetState());
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for the field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      e.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!allowedTypes.includes(fileExtension)) {
      toast.error(
        "Invalid file type. Please upload PDF, DOC, DOCX, JPG, or PNG files.",
      );
      e.target.value = "";
      return;
    }

    // Cancel any existing upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this upload
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set uploading state
    setFileItem({
      file,
      url: "",
      name: file.name,
      uploading: true,
    });

    try {
      const url = await uploadFile(file, {
        signal: abortController.signal,
        timeout: 5 * 60 * 1000, // 5 minutes timeout
      });

      // Check if upload was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Update state with uploaded URL
      setFileItem({
        file,
        url,
        name: file.name,
        uploading: false,
      });

      setFormData((prev) => ({ ...prev, attachmentUrl: url }));
      toast.success(`"${file.name}" uploaded successfully`);
    } catch (err: any) {
      // Don't show error if upload was cancelled
      if (err?.message === "Upload cancelled") {
        setFileItem(null);
        return;
      }

      const errorMessage = err?.message || "Upload failed";
      toast.error(`Failed to upload "${file.name}": ${errorMessage}`);

      setFileItem({
        file,
        url: "",
        name: file.name,
        uploading: false,
        error: errorMessage,
      });
    } finally {
      abortControllerRef.current = null;
      e.target.value = "";
    }
  };

  const removeFile = () => {
    // Cancel upload if in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFileItem(null);
    setFormData((prev) => ({ ...prev, attachmentUrl: "" }));
  };

  const retryUpload = async () => {
    if (!fileItem?.file) {
      toast.error("Original file not available for retry");
      return;
    }

    const file = fileItem.file;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setFileItem({
      ...fileItem,
      uploading: true,
      error: undefined,
    });

    try {
      const url = await uploadFile(file, {
        signal: abortController.signal,
        timeout: 5 * 60 * 1000,
      });

      if (abortController.signal.aborted) {
        return;
      }

      setFileItem({
        file,
        url,
        name: file.name,
        uploading: false,
      });

      setFormData((prev) => ({ ...prev, attachmentUrl: url }));
      toast.success(`"${file.name}" uploaded successfully`);
    } catch (err: any) {
      if (err?.message === "Upload cancelled") {
        return;
      }

      const errorMessage = err?.message || "Upload failed";
      toast.error(`Failed to upload "${file.name}": ${errorMessage}`);

      setFileItem({
        ...fileItem,
        uploading: false,
        error: errorMessage,
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }

    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (isUnpaidLeave && start < todayDate) {
        newErrors.startDate =
          "Unpaid leave must start from today or a future date";
      }

      if (isAnnualLeave) {
        if (start < annualMinDateObj || start > annualMaxDateObj) {
          newErrors.startDate =
            "Annual leave start date must be between 4 days before today and 2 days after today";
        }
      }

      if (end < start) {
        newErrors.endDate = "End date must be after start date";
      }
    }

    if (
      leaveType.requires_attachment &&
      !fileItem?.url &&
      !formData.attachmentUrl
    ) {
      newErrors.attachment = "Document is required for this leave type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    dispatch(
      leaveActions.createLeaveApplicationRequest({
        leave_type_id: leaveType.id,
        start_date: formData.startDate,
        end_date: formData.endDate,
        reason: formData.reason || undefined,
        attachment_url: formData.attachmentUrl || undefined,
        is_start_half_day: isStartHalfDay,
        is_end_half_day: isEndHalfDay,
      }),
    );
  };

  const handleReset = () => {
    setFormData({
      leaveTypeName: leaveType.name,
      startDate: "",
      endDate: "",
      estimatedDays: "",
      estimatedReturnDate: "",
      reason: "",
      attachmentUrl: "",
    });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFileItem(null);
    setErrors({});
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onBack();
  };

  const isCalendarDays = leaveType.is_calendar_days ?? false;

  return (
    <div className="bg-white rounded-2xl shadow-card p-8 max-w-7xl mx-auto relative animate-[slideUp_0.3s_ease-out]">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
      >
        <MdArrowBack size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="text-center mb-8 pt-4">
        <h2 className="text-2xl font-bold text-k-dark-grey flex items-center justify-center gap-2">
          Leave Application
        </h2>
        <p className="text-k-medium-grey mt-2">
          Fill the required fields below to apply for{" "}
          {leaveType.name.toLowerCase()}.
        </p>
      </div>

      {/* Leave Type Info */}
      <div className="bg-primary-light border border-primary-light rounded-xl p-4 mb-6 flex gap-3">
        <MdInfo className="text-primary text-xl shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700">
          <p>
            <strong>Leave Type:</strong> {leaveType.name}
          </p>
          {leaveType.requires_attachment && (
            <p className="mt-1 text-primary">
              <strong>Note:</strong> Supporting document is required
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              label="Leave Type"
              name="leaveTypeName"
              value={formData.leaveTypeName}
              disabled
              className="bg-gray-50"
            />

            <div>
              <label className="block text-sm font-medium text-k-dark-grey mb-3">
                Select Leave Dates
                {!isCalendarDays && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (Holidays & non-working days are highlighted and excluded)
                  </span>
                )}
                {isCalendarDays && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (Calendar days — all days count including weekends &
                    holidays)
                  </span>
                )}
              </label>
              <LeaveDatePicker
                startDate={formData.startDate}
                endDate={formData.endDate}
                onStartDateChange={(date) => {
                  setFormData((prev) => ({ ...prev, startDate: date }));
                  setIsStartHalfDay(false);
                  // If we change start date and end date is same, reset its halfday too just in case
                  if (formData.endDate && date === formData.endDate) {
                    setIsEndHalfDay(false);
                  }
                  if (errors.startDate)
                    setErrors((prev) => ({ ...prev, startDate: "" }));
                }}
                onEndDateChange={(date) => {
                  setFormData((prev) => ({ ...prev, endDate: date }));
                  setIsEndHalfDay(false);
                  if (errors.endDate)
                    setErrors((prev) => ({ ...prev, endDate: "" }));
                }}
                onStartHalfDayToggle={setIsStartHalfDay}
                onEndHalfDayToggle={setIsEndHalfDay}
                isStartHalfDay={isStartHalfDay}
                isEndHalfDay={isEndHalfDay}
                startMinDate={startDateMinForPicker}
                startMaxDate={startDateMaxForPicker}
                isCalendarDays={isCalendarDays}
                error={{ start: errors.startDate, end: errors.endDate }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormField
                  label="Estimated Working Days"
                  type="text"
                  name="estimatedDays"
                  value={
                    formData.estimatedDays
                      ? `${formData.estimatedDays} days`
                      : ""
                  }
                  placeholder="Auto-calculated"
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Based on 5.5-day work week (Mon-Fri full, Sat half)
                </p>
              </div>
              <div>
                <FormField
                  label="Estimated Return Date"
                  type="date"
                  name="estimatedReturnDate"
                  value={formData.estimatedReturnDate}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Actual dates calculated by system
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-k-dark-grey mb-2">
                Reason for leave
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={4}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none outline-none"
                placeholder="Please describe the reason for your leave (optional)..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-k-dark-grey mb-2">
                Attach supporting document (pdf, jpg, docx)
                {leaveType.requires_attachment && (
                  <span className="text-red-500"> *</span>
                )}
              </label>
              <label
                htmlFor="attachment-upload"
                className={`block border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                  errors.attachment
                    ? "border-red-500 bg-red-50"
                    : fileItem?.url
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 hover:border-primary hover:bg-gray-50 cursor-pointer"
                }`}
              >
                {fileItem ? (
                  <div className="space-y-3">
                    <div
                      className={`flex items-center justify-between bg-white p-3 rounded-lg shadow-sm gap-3 border ${
                        fileItem.error
                          ? "border-red-500"
                          : fileItem.url
                            ? "border-green-500"
                            : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            fileItem.error
                              ? "bg-red-50 text-red-600"
                              : fileItem.url
                                ? "bg-green-50 text-green-600"
                                : "bg-primary-light text-primary"
                          }`}
                        >
                          {fileItem.error ? (
                            <MdError size={20} />
                          ) : fileItem.url ? (
                            <MdCheck size={20} />
                          ) : (
                            <MdInsertDriveFile size={20} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-k-dark-grey truncate"
                            title={fileItem.name}
                          >
                            {fileItem.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {fileItem.uploading ? (
                              <span className="text-xs text-primary">
                                Uploading...
                              </span>
                            ) : fileItem.error ? (
                              <>
                                <span className="text-xs text-red-600">
                                  {fileItem.error}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    retryUpload();
                                  }}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Retry
                                </button>
                              </>
                            ) : fileItem.url ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-green-600">
                                  Uploaded
                                </span>
                                <a
                                  href={fileItem.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-primary hover:underline whitespace-nowrap"
                                >
                                  View
                                </a>
                              </div>
                            ) : (
                              fileItem.file && (
                                <span className="text-xs text-k-medium-grey">
                                  {(fileItem.file.size / 1024 / 1024).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFile();
                        }}
                        className="text-sm text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded shrink-0"
                        title="Remove file"
                      >
                        <MdClose size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center cursor-pointer">
                    <MdCloudUpload className="mx-auto h-10 w-10 text-primary mb-2" />
                    <div className="flex justify-center text-sm text-gray-600">
                      <span className="relative rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none">
                        <span>Upload a file</span>
                      </span>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOC, DOCX, JPG, PNG up to 10MB
                    </p>
                  </div>
                )}
                <input
                  id="attachment-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </label>
              {errors.attachment && (
                <p className="text-red-500 text-xs mt-1">{errors.attachment}</p>
              )}
            </div>

            <div>
              <FormField
                label="Manager"
                name="managerName"
                value={
                  user?.employee?.employments?.[0]?.manager?.full_name ||
                  "Direct Manager"
                }
                disabled
                className="bg-gray-50"
              />
              <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="font-medium text-blue-800 mb-1">
                  Approval Process:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  {isManager ? (
                    <>
                      <li>HR will approve.</li>
                      <li>CEO will approve (if required).</li>
                    </>
                  ) : (
                    <>
                      <li>Your manager will review and approve.</li>
                      <li>HR will approve.</li>
                    </>
                  )}
                </ol>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                variant="primary"
                icon={MdSave}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                icon={MdRefresh}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </form>
        </div>

        {/* Right Sidebar for Holidays */}
        <div className="lg:col-span-1 border-l border-gray-100 pl-8 hidden lg:block">
          <div className="sticky top-6">
            <div className="mb-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-2 shadow-inner">
                <MdInfo size={18} className="opacity-90" />
              </div>
              <h3 className="text-base font-bold text-gray-800">
                Public Holidays
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Upcoming recognized holidays that will be skipped during
                calculations.
              </p>
            </div>

            <div className="space-y-2 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {holidays
                .filter((h) => new Date(h.holiday_date) >= new Date())
                .slice(0, 8)
                .map((h) => {
                  const hDate = new Date(h.holiday_date);
                  return (
                    <div
                      key={h.id}
                      className="flex gap-3 p-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors group"
                    >
                      <div className="flex flex-col items-center justify-center min-w-10 border-r border-gray-100 pr-2">
                        <span className="text-[10px] font-bold text-red-500 uppercase">
                          {formatWithPattern(hDate, "MMM")}
                        </span>
                        <span className="text-lg font-black text-gray-900 leading-none">
                          {hDate.getDate()}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-xs font-semibold text-gray-800 group-hover:text-primary transition-colors">
                          {h.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatWithPattern(hDate, "dddd")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {holidays.filter((h) => new Date(h.holiday_date) >= new Date())
                .length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  No upcoming holidays scheduled for this year.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal using StatusModal */}
      <StatusModal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        type="success"
        title="Application Submitted!"
        message="Your leave application has been submitted and is pending supervisor approval. You will be notified of any updates."
        primaryButtonText="Close"
        onPrimaryAction={handleSuccessClose}
        secondaryButtonText={undefined}
        onSecondaryAction={undefined}
      />
    </div>
  );
}
