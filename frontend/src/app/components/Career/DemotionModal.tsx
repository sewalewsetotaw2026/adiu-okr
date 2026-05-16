import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FiTrendingDown, FiCalendar, FiDollarSign, FiAlertTriangle, FiPlus, FiTrash2 } from "react-icons/fi";
import Modal from "../common/Modal";
import Button from "../Core/ui/Button";
import FormField from "../common/FormField";
import careerService, { DemotionRequest } from "../../services/careerService";
import ToastService from "../../../utils/ToastService";
import { selectAllJobTitles } from "../../pages/Admin/Settings/JobTitles/slice/selectors";
import { useJobTitlesSlice } from "../../pages/Admin/Settings/JobTitles/slice";
import DynamicAutocomplete from "../Core/ui/FormAutocomplete";

import adminService, { AllowanceType } from "../../services/adminService";

interface DemotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  currentJobTitle?: string;
  currentSalary?: number;
  onSuccess?: () => void;
}

export default function DemotionModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentJobTitle = "N/A",
  currentSalary = 0,
  onSuccess,
}: DemotionModalProps) {
  const dispatch = useDispatch();
  const { actions: jobTitleActions } = useJobTitlesSlice();
  const jobTitles = useSelector(selectAllJobTitles) || [];

  const [loading, setLoading] = useState(false);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

  const [form, setForm] = useState({
    new_job_title_id: "",
    new_salary: "",
    effective_date: "",
    justification: "",
    allowances: [] as { name: string; amount: string }[],
  });

  useEffect(() => {
    if (isOpen) {
      dispatch(jobTitleActions.fetchAllJobTitlesRequest());
      adminService.getAllowanceTypes().then(setAllowanceTypes).catch(console.error);
    }
  }, [isOpen, dispatch, jobTitleActions]);

  const resolveAllowanceTypeId = (name: string): number | null => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const match = allowanceTypes.find(
      (a) => a.name?.toLowerCase() === trimmed.toLowerCase()
    );
    return match ? match.id : null;
  };

  const filterAllowanceTypes = async (query: string) => {
    return allowanceTypes
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .map((a) => a.name);
  };



  const handleFieldChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.new_job_title_id) {
      ToastService.error("Please select a new job title");
      return;
    }
    if (!form.new_salary) {
      ToastService.error("Please enter the new salary");
      return;
    }
    if (!form.effective_date) {
      ToastService.error("Please select an effective date");
      return;
    }
    if (!form.justification.trim()) {
      ToastService.error("Justification is required for demotions");
      return;
    }

    try {
      setLoading(true);
      const payload: DemotionRequest = {
        employee_id: employeeId,
        new_job_title_id: Number(form.new_job_title_id),
        new_salary: Number(form.new_salary),
        effective_date: form.effective_date,
        justification: form.justification,
        allowances: form.allowances
          .filter((a) => a.name && a.amount)
          .map((a) => {
            const typeId = resolveAllowanceTypeId(a.name);
            if (!typeId) throw new Error(`Allowance Type "${a.name}" not found.`);
            return {
              allowance_type_id: typeId,
              amount: Number(a.amount),
              currency: "ETB",
            };
          }),
      };

      await careerService.demoteEmployee(payload);
      ToastService.success(`Demotion for ${employeeName} has been processed.`);
      onClose();
      onSuccess?.();
    } catch (err: any) {
      ToastService.error(err?.message || "Failed to process demotion");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      new_job_title_id: "",
      new_salary: "",
      effective_date: "",
      justification: "",
      allowances: [],
    });
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Demote Employee" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800">Demotion Notice</h3>
              <p className="text-sm text-amber-700 mt-1">
                You are about to demote <strong>{employeeName}</strong>. This action will be
                recorded in the employee's career history. A detailed justification is required.
              </p>
            </div>
          </div>
        </div>

        {/* Current Position Info */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Current Position</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Job Title:</span>
              <p className="font-medium text-gray-800">{currentJobTitle}</p>
            </div>
            <div>
              <span className="text-gray-500">Salary:</span>
              <p className="font-medium text-gray-800">
                {currentSalary ? `ETB ${currentSalary.toLocaleString()}` : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="select"
            label="New Job Title"
            name="new_job_title_id"
            value={form.new_job_title_id}
            onChange={handleChange}
            required
            options={jobTitles.map((j: any) => ({
              label: `${j.title}${j.level ? ` - ${j.level}` : ""}`,
              value: String(j.id),
            }))}
          />

          <FormField
            type="number"
            label="New Salary (ETB)"
            name="new_salary"
            value={form.new_salary}
            onChange={handleChange}
            required
            icon={FiDollarSign}
            placeholder="Enter new salary"
          />

          <div className="md:col-span-2">
            <FormField
              type="date"
              label="Effective Date"
              name="effective_date"
              value={form.effective_date}
              onChange={handleChange}
              required
              icon={FiCalendar}
            />
          </div>
        </div>

        {/* Allowances Section */}
        <div className="border-t pt-4">
          <h3 className="text-md font-semibold text-gray-700 mb-4">Allowances</h3>
          <div className="space-y-4">
            {form.allowances.map((allowance, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <DynamicAutocomplete
                    label="Allowance Name"
                    type="allowanceTypes"
                    value={allowance.name}
                    onChange={(val) => {
                      const newAllowances = [...form.allowances];
                      newAllowances[index] = { ...newAllowances[index], name: val };
                      handleFieldChange("allowances", newAllowances);
                    }}
                    fetchSuggestionsFn={filterAllowanceTypes}
                    placeholder="e.g. Transport"
                    containerClassName="w-full"
                    required
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    label="Amount"
                    type="number"
                    name={`allowance_amount_${index}`}
                    value={allowance.amount}
                    onChange={(e) => {
                      const newAllowances = [...form.allowances];
                      newAllowances[index] = { ...newAllowances[index], amount: e.target.value };
                      handleFieldChange("allowances", newAllowances);
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newAllowances = form.allowances.filter((_, i) => i !== index);
                    handleFieldChange("allowances", newAllowances);
                  }}
                  className="mb-1 p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-[50px] flex items-center justify-center border border-red-200"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                handleFieldChange("allowances", [...form.allowances, { name: "", amount: "" }]);
              }}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:bg-primary-light px-4 py-2 rounded-lg transition-colors border border-dashed border-primary"
            >
              <FiPlus /> Add Allowance
            </button>
          </div>
        </div>

        <FormField
          type="textarea"
          label="Justification (Required)"
          name="justification"
          value={form.justification}
          onChange={handleChange}
          required
          placeholder="Provide a detailed explanation for this demotion. This is a required field for HR documentation..."
          rows={4}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button
            variant="secondary"
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            icon={FiTrendingDown}
            loading={loading}
            disabled={loading}
            className="!bg-amber-600 hover:!bg-amber-700"
          >
            Confirm Demotion
          </Button>
        </div>
      </form>

      {/* Dynamic Creation Modal */}
      {/* <CreateItemModal
        isOpen={createModalState.isOpen}
        onClose={() => setCreateModalState((prev) => ({ ...prev, isOpen: false, type: null }))}
        title="Create New Allowance Type"
        fields={[
          {
            name: "name",
            label: "Allowance Name",
            required: true,
            defaultValue: createModalState.initialValue,
            placeholder: "e.g. Transport",
          },
          {
            name: "description",
            label: "Description",
            required: true,
            type: "textarea",
            placeholder: "Describe this allowance",
          },
          {
            name: "is_taxable",
            label: "Is Taxable?",
            type: "checkbox",
          },
        ]}
        onSubmit={handleCreateSubmit}
        initialValues={{ name: createModalState.initialValue }}
      /> */}
    </Modal>
  );
}
