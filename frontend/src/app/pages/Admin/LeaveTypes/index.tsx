import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdRefresh,
  MdAutorenew,
  MdCalendarToday,
  MdEventNote,
  MdSettings,
  MdInfoOutline,
} from "react-icons/md";
import toast from "react-hot-toast";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/Core/ui/Button";
import BackButton from "../../../components/common/BackButton";
import FormField from "../../../components/common/FormField";
import StatusModal from "../../../components/common/StatusModal";
import DataTable, { TableColumn } from "../../../components/common/DataTable";
import InfoBanner from "../../../components/common/InfoBanner";
import {
  ActionMenu,
  ActionOption,
} from "../../../components/common/ActionMenu";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectLeaveTypes,
  selectLeaveTypesLoading,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
} from "../../../slice/leaveSlice/selectors";
import { LeaveType, ApplicableGender } from "../../../slice/leaveSlice/types";

// Gender options matching backend
const genderOptions = [
  { value: "All", label: "All Genders" },
  { value: "Male", label: "Male Only" },
  { value: "Female", label: "Female Only" },
];

// Initial form state
const initialFormState = {
  name: "",
  code: "",
  default_allowance_days: "",
  incremental_days_per_year: "0",
  incremental_period_years: "1",
  max_accrual_limit: "",
  is_carry_over_allowed: false,
  carry_over_expiry_months: "",
  is_paid: true,
  requires_attachment: false,
  is_calendar_days: false,
  applicable_gender: "All" as ApplicableGender,
  // Accrual configuration
  is_accrual_based: false,
  accrual_frequency: "DAILY",
  accrual_divisor: "365",
};

export default function LeaveTypesPage() {
  useLeaveSlice();
  const dispatch = useDispatch();

  // Redux state
  const rawLeaveTypes = useSelector(selectLeaveTypes);
  const leaveTypesLoading = useSelector(selectLeaveTypesLoading);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  // Ensure array safety
  const leaveTypes = Array.isArray(rawLeaveTypes) ? rawLeaveTypes : [];

  // Local state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(
    null
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch leave types on mount
  useEffect(() => {
    dispatch(leaveActions.getLeaveTypesRequest());
  }, [dispatch]);

  // Handle success/error
  useEffect(() => {
    if (success && message) {
      toast.success(message);
      dispatch(leaveActions.resetState());
      setShowFormModal(false);
      setShowDeleteModal(false);
      setShowSeedModal(false);
      resetForm();
      dispatch(leaveActions.getLeaveTypesRequest());
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleRefresh = () => {
    dispatch(leaveActions.getLeaveTypesRequest());
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedLeaveType(null);
    setIsEditMode(false);
  };

  const handleAdd = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleEdit = (leaveType: LeaveType) => {
    setSelectedLeaveType(leaveType);
    setIsEditMode(true);
    setFormData({
      name: leaveType.name,
      code: leaveType.code,
      default_allowance_days: leaveType.default_allowance_days.toString(),
      incremental_days_per_year: (
        leaveType.incremental_days_per_year || 0
      ).toString(),
      incremental_period_years: (
        leaveType.incremental_period_years || 1
      ).toString(),
      max_accrual_limit: leaveType.max_accrual_limit?.toString() || "",
      is_carry_over_allowed: leaveType.is_carry_over_allowed || false,
      carry_over_expiry_months:
        leaveType.carry_over_expiry_months?.toString() || "",
      is_paid: leaveType.is_paid,
      requires_attachment: leaveType.requires_attachment,
      is_calendar_days: leaveType.is_calendar_days || false,
      applicable_gender: leaveType.applicable_gender || "All",
      // Accrual configuration
      is_accrual_based: leaveType.is_accrual_based || false,
      accrual_frequency: leaveType.accrual_frequency || "DAILY",
      accrual_divisor: (leaveType.accrual_divisor || 365).toString(),
    });
    setShowFormModal(true);
  };

  const handleDelete = (leaveType: LeaveType) => {
    setSelectedLeaveType(leaveType);
    setShowDeleteModal(true);
  };

  const onFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = e.target;
    const name = target.name;
    const value = target.value;
    
    // Explicitly check input type for checkboxes
    const isCheckbox = target.type === "checkbox";
    const checked = isCheckbox ? (target as HTMLInputElement).checked : false;

    setFormData((prev) => {
      const updates: any = { [name]: isCheckbox ? checked : value };
      
      // Auto-update divisor when frequency changes
      if (name === "accrual_frequency") {
        if (value === "MONTHLY") {
          updates.accrual_divisor = "12";
        } else if (value === "DAILY") {
          updates.accrual_divisor = "365";
        }
      }

      return {
        ...prev,
        ...updates,
      };
    });

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.code.trim()) {
      errors.code = "Code is required";
    } else if (!/^[A-Z_]+$/.test(formData.code.toUpperCase())) {
      errors.code = "Code must be uppercase letters and underscores only";
    }

    if (!formData.default_allowance_days) {
      errors.default_allowance_days = "Required";
    } else if (parseInt(formData.default_allowance_days) <= 0) {
      errors.default_allowance_days = "Must be > 0";
    }

    if (
      formData.is_carry_over_allowed &&
      formData.carry_over_expiry_months &&
      parseInt(formData.carry_over_expiry_months) <= 0
    ) {
      errors.carry_over_expiry_months = "Must be > 0";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      default_allowance_days: parseInt(formData.default_allowance_days),
      incremental_days_per_year:
        parseInt(formData.incremental_days_per_year) || 0,
      incremental_period_years:
        formData.incremental_period_years === "" ? 1 : parseInt(formData.incremental_period_years),
      max_accrual_limit: formData.max_accrual_limit
        ? parseInt(formData.max_accrual_limit)
        : null,
      is_carry_over_allowed: formData.is_carry_over_allowed,
      carry_over_expiry_months: formData.carry_over_expiry_months
        ? parseInt(formData.carry_over_expiry_months)
        : null,
      is_paid: formData.is_paid,
      requires_attachment: formData.requires_attachment,
      is_calendar_days: formData.is_calendar_days,
      applicable_gender: formData.applicable_gender as ApplicableGender,
      // Accrual configuration
      is_accrual_based: formData.is_accrual_based,
      accrual_frequency: formData.accrual_frequency,
      accrual_divisor: parseInt(formData.accrual_divisor) || 365,
    };

    console.log("DEBUG: LeaveType Payload", payload);

    if (isEditMode && selectedLeaveType) {
      dispatch(
        leaveActions.updateLeaveTypeRequest({
          id: selectedLeaveType.id,
          ...payload,
        })
      );
    } else {
      dispatch(leaveActions.createLeaveTypeRequest(payload));
    }
  };

  const confirmDelete = () => {
    if (selectedLeaveType) {
      dispatch(leaveActions.deleteLeaveTypeRequest(selectedLeaveType.id));
    }
  };

  const handleSeedDefaults = () => {
    setShowSeedModal(true);
  };

  const confirmSeedDefaults = () => {
    dispatch(leaveActions.seedDefaultLeaveTypesRequest());
  };

  // Table columns
  const columns: TableColumn<LeaveType>[] = [
    {
      key: "name",
      header: "Name",
      render: (lt) => (
        <div>
          <p className="font-medium text-k-dark-grey">{lt.name}</p>
          <p className="text-xs text-gray-400">{lt.code}</p>
        </div>
      ),
    },
    {
      key: "allowance",
      header: "Allowance",
      render: (lt) => (
        <div>
          <p className="font-medium">{lt.default_allowance_days} days</p>
          {(lt.incremental_days_per_year || 0) > 0 && (
            <p className="text-xs text-green-600 font-medium">
              +{lt.incremental_days_per_year}d / {lt.incremental_period_years}yr
            </p>
          )}
        </div>
      ),
    },
    {
      key: "properties",
      header: "Properties",
      render: (lt) => (
        <div className="flex flex-wrap gap-1">
          <span
            className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md ${
              lt.is_paid
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "bg-orange-50 text-orange-600 border border-orange-100"
            }`}
          >
            {lt.is_paid ? "Paid" : "Unpaid"}
          </span>
          {lt.is_accrual_based && (
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-teal-50 text-teal-600 border border-teal-100">
              Accrual
            </span>
          )}
          {lt.is_carry_over_allowed && (
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-green-50 text-green-600 border border-green-100">
              Carry Over
            </span>
          )}
          {lt.is_calendar_days && (
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-purple-50 text-purple-600 border border-purple-100">
              Calendar Days
            </span>
          )}
        </div>
      ),
    },
    {
      key: "gender",
      header: "Gender",
      render: (lt) => (
        <span className="text-sm text-gray-600">
          {lt.applicable_gender || "All"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      render: (lt) => {
        const actions: ActionOption[] = [
          {
            label: "Edit",
            value: "edit",
            icon: <MdEdit className="text-gray-500" />,
            onClick: () => handleEdit(lt),
          },
          {
            label: "Delete",
            value: "delete",
            icon: <MdDelete className="text-red-500" />,
            onClick: () => handleDelete(lt),
            variant: "danger",
          },
        ];
        return <ActionMenu actions={actions} />;
      },
    },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-4">
        <BackButton 
          to="/admin/leaves" 
          label="Back to Leave Management"
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
               <MdCalendarToday className="text-k-orange" />
               Leave Types
             </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Configure leave policies and allowance rules
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            variant="secondary"
            icon={MdRefresh}
            loading={leaveTypesLoading}
          >
            Refresh
          </Button>
          <Button onClick={handleAdd} variant="primary" icon={MdAdd}>
            Add Leave Type
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={leaveTypes}
        columns={columns}
        loading={leaveTypesLoading}
        keyExtractor={(lt) => lt.id}
        emptyState={{
          icon: MdCalendarToday,
          title: "No leave types configured",
          description:
            "Add leave types manually or seed defaults to get started.",
          action: (
            <div className="flex gap-3 justify-center">
              <Button onClick={handleAdd} variant="primary" icon={MdAdd}>
                Add Leave Type
              </Button>
            </div>
          ),
        }}
        className="p-6"
        itemLabel="leave type"
      />

      {/* Add/Edit Modal - Using larger size 3xl */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          resetForm();
        }}
        title={isEditMode ? "Edit Leave Type" : "Create New Leave Type"}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Information */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
             <div className="flex items-center gap-2 mb-4 text-k-dark-grey font-bold pb-2 border-b border-gray-200">
               <MdEventNote className="text-blue-500 text-lg" />
               <h3>Basic Information</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Leave Name"
                  name="name"
                  value={formData.name}
                  onChange={onFormChange}
                  placeholder="e.g., Annual Leave"
                  error={formErrors.name}
                  required
                />
                <FormField
                  label="Leave Code"
                  name="code"
                  value={formData.code}
                  onChange={onFormChange}
                  placeholder="e.g., ANNUAL"
                  error={formErrors.code}
                  helperText="Unique identifier (uppercase)"
                  required
                />
                <FormField
                  label="Applicable Gender"
                  name="applicable_gender"
                  type="select"
                  value={formData.applicable_gender}
                  onChange={onFormChange}
                  options={genderOptions}
                />
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="is_paid"
                      checked={formData.is_paid}
                      onChange={onFormChange}
                      className="w-5 h-5 text-k-orange rounded border-gray-300 focus:ring-k-orange"
                    />
                    <div>
                      <span className="font-medium text-k-dark-grey block">Paid Leave</span>
                      <span className="text-xs text-gray-500">Employee receives salary during leave</span>
                    </div>
                  </label>
                </div>
             </div>
          </div>

          {/* Section 2: Allowance & Accrual Rules */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
             <div className="flex items-center gap-2 mb-4 text-k-dark-grey font-bold pb-2 border-b border-gray-200">
               <MdSettings className="text-k-orange text-lg" />
               <h3>Allowance & Accrual Rules</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  label="Balance Limit"
                  name="max_accrual_limit"
                  type="number"
                  value={formData.max_accrual_limit}
                  onChange={onFormChange}
                  placeholder="Unlimited"
                  helperText="Max accrual (leave empty for unlimited)"
                />
                 <FormField
                  label="Base Allowance"
                  name="default_allowance_days"
                  type="number"
                  value={formData.default_allowance_days}
                  onChange={onFormChange}
                  placeholder="e.g., 16"
                  error={formErrors.default_allowance_days}
                  helperText="Initial days/year"
                  required
                />
                <div className="md:col-span-1 bg-white p-3 rounded-lg border border-gray-200">
                   <p className="text-sm font-medium text-gray-700 mb-2">Counting Method</p>
                   <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="is_calendar_days"
                      checked={!!formData.is_calendar_days}
                      onChange={onFormChange}
                      className="w-5 h-5 text-k-orange rounded border-gray-300 focus:ring-k-orange cursor-pointer"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Count Calendar Days</span>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                        Includes weekends/holidays (e.g., Maternity)
                      </p>
                    </div>
                  </label>
                </div>
             </div>
             
             {/* Tenure Increment Sub-section */}
             <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-3">Tenure-Based Increment</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    label="Increment Amount (Days)"
                    name="incremental_days_per_year"
                    type="number"
                    value={formData.incremental_days_per_year}
                    onChange={onFormChange}
                    placeholder="0"
                    helperText="Days added per period"
                  />
                  <FormField
                    label="Increment Period (Years)"
                    name="incremental_period_years"
                    type="number"
                    value={formData.incremental_period_years}
                    onChange={onFormChange}
                    placeholder="1"
                    helperText="Years of service required for increment"
                  />
                </div>
             </div>

             {/* Gradual Accrual Sub-section */}
             <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                   <input
                     type="checkbox"
                     name="is_accrual_based"
                     checked={!!formData.is_accrual_based}
                     onChange={onFormChange}
                     className="w-5 h-5 mt-0.5 text-k-orange rounded border-gray-300 focus:ring-k-orange cursor-pointer"
                   />
                   <div>
                     <p className="text-sm font-bold text-gray-700">Enable Gradual Accrual</p>
                     <p className="text-xs text-gray-500 mt-0.5">
                       Balance accumulates gradually over the year instead of being assigned upfront
                     </p>
                   </div>
                </div>
                {formData.is_accrual_based && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-lg border border-gray-200">
                    <FormField
                      label="Accrual Frequency"
                      name="accrual_frequency"
                      type="select"
                      value={formData.accrual_frequency}
                      onChange={onFormChange}
                      options={[
                        { value: "DAILY", label: "Daily" },
                        { value: "MONTHLY", label: "Monthly" },
                      ]}
                      helperText="How often balance is credited"
                    />
                    <FormField
                      label="Accrual Divisor"
                      name="accrual_divisor"
                      type="number"
                      value={formData.accrual_divisor}
                      onChange={onFormChange}
                      placeholder="365"
                      helperText="Days in accrual period (365 = daily over year)"
                    />
                  </div>
                )}
             </div>
          </div>

          {/* Section 3: Policies & Restrictions */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
             <div className="flex items-center gap-2 mb-4 text-k-dark-grey font-bold pb-2 border-b border-gray-200">
               <MdInfoOutline className="text-purple-500 text-lg" />
               <h3>Policies & Restrictions</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="flex items-center gap-3 cursor-pointer mb-2 select-none">
                    <input
                      type="checkbox"
                      name="requires_attachment"
                      checked={formData.requires_attachment}
                      onChange={onFormChange}
                      className="w-5 h-5 text-k-orange rounded border-gray-300 focus:ring-k-orange"
                    />
                    <span className="font-medium text-k-dark-grey">Require Attachment</span>
                  </label>
                  <p className="text-xs text-gray-500 ml-8">Force users to upload documents (e.g., Medical Certificate)</p>
                </div>

                <div>
                   <label className="flex items-center gap-3 cursor-pointer mb-2 select-none">
                    <input
                      type="checkbox"
                      name="is_carry_over_allowed"
                      checked={formData.is_carry_over_allowed}
                      onChange={onFormChange}
                      className="w-5 h-5 text-k-orange rounded border-gray-300 focus:ring-k-orange"
                    />
                    <span className="font-medium text-k-dark-grey">Allow Carry-Over</span>
                  </label>
                  {formData.is_carry_over_allowed && (
                    <div className="ml-8 mt-3">
                      <FormField
                        label="Expiry (Months)"
                        name="carry_over_expiry_months"
                        type="number"
                        value={formData.carry_over_expiry_months}
                        onChange={onFormChange}
                        placeholder="e.g., 24"
                        error={formErrors.carry_over_expiry_months}
                        helperText="Months before expiry"
                        className="!mb-0"
                      />
                    </div>
                  )}
                </div>
             </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-100 sticky bottom-0 bg-white z-10">
            <Button
              onClick={() => {
                setShowFormModal(false);
                resetForm();
              }}
              variant="secondary"
              type="button"
              className="flex-1 md:flex-none"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              loading={loading}
              className="flex-1 md:flex-none md:min-w-[200px]"
            >
              {isEditMode ? "Update Leave Type" : "Create Leave Type"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <StatusModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="warning"
        title="Delete Leave Type"
        message={`Are you sure you want to delete "${selectedLeaveType?.name}"?`}
        primaryButtonText={loading ? "Deleting..." : "Delete"}
        onPrimaryAction={confirmDelete}
        secondaryButtonText="Cancel"
        onSecondaryAction={() => setShowDeleteModal(false)}
      />

      {/* Seed Defaults Modal - Unchanged */}
      <Modal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        title="Seed Default Leave Types"
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner variant="info">
            This will create Ethiopian labor law compliant leave types:
          </InfoBanner>

          <ul className="text-sm text-gray-600 space-y-2 pl-4">
            <li>• Annual Leave (16 days first year, +1 day per 2 years)</li>
            <li>• Family Events - Marriage Leave (3 days)</li>
            <li>• Family Events - Maternity Leave (30 days pre, 90 days post)</li>
            <li>• Family Events - Paternity Leave (3 days)</li>
            <li>• Family Events - Bereavement Leave (3 days)</li>
            <li>• Sick Leave (180 days total reserve)</li>
            <li>• Unpaid Leave (up to 5 days)</li>
          </ul>

          <InfoBanner variant="warning">
            Existing leave types will not be affected. Duplicates (by code) will
            be skipped.
          </InfoBanner>

          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <Button onClick={() => setShowSeedModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={confirmSeedDefaults}
              variant="primary"
              icon={MdAutorenew}
              loading={loading}
            >
              Create Default Types
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
