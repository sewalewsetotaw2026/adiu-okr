import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FiRepeat, FiCalendar } from "react-icons/fi";
import Modal from "../common/Modal";
import Button from "../Core/ui/Button";
import FormField from "../common/FormField";
import careerService, { TransferRequest } from "../../services/careerService";
import ToastService from "../../../utils/ToastService";
import { selectDepartments } from "../../pages/Admin/Departments/slice/selectors";
import { selectAllJobTitles } from "../../pages/Admin/Settings/JobTitles/slice/selectors";
import { useDepartments } from "../../pages/Admin/Departments/slice";
import { useJobTitlesSlice } from "../../pages/Admin/Settings/JobTitles/slice";
import DynamicAutocomplete from "../Core/ui/FormAutocomplete";

import adminService, { AllowanceType } from "../../services/adminService";
import { FiPlus, FiTrash2 } from "react-icons/fi";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  currentJobTitle?: string;
  currentDepartment?: string;
  onSuccess?: () => void;
}

export default function TransferModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentJobTitle = "N/A",
  currentDepartment = "N/A",
  onSuccess,
}: TransferModalProps) {
  const dispatch = useDispatch();
  const { actions: departmentActions } = useDepartments();
  const { actions: jobTitleActions } = useJobTitlesSlice();

  const departments = useSelector(selectDepartments) || [];
  const jobTitles = useSelector(selectAllJobTitles) || [];

  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    new_department_id: "",
    new_job_title_id: "",
    effective_date: "",
    justification: "",
    allowances: [] as { name: string; amount: string }[],
  });

  useEffect(() => {
    if (isOpen) {
      dispatch(departmentActions.fetchDepartmentsStart());
      dispatch(jobTitleActions.fetchAllJobTitlesRequest());
      adminService.getAllowanceTypes().then(setAllowanceTypes).catch(console.error);
    }
  }, [isOpen, dispatch, departmentActions, jobTitleActions]);

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

    if (!form.new_department_id) {
      ToastService.error("Please select a new department");
      return;
    }
    if (!form.effective_date) {
      ToastService.error("Please select an effective date");
      return;
    }
    if (!form.justification.trim()) {
      ToastService.error("Please provide a justification for the transfer");
      return;
    }

    try {
      setLoading(true);
      const payload: TransferRequest = {
        employee_id: employeeId,
        new_department_id: Number(form.new_department_id),
        new_job_title_id: (form.new_job_title_id && form.new_job_title_id !== "KEEP_CURRENT")
          ? Number(form.new_job_title_id)
          : undefined,
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

      await careerService.transferEmployee(payload);
      ToastService.success(`${employeeName} has been transferred successfully!`);
      onClose();
      onSuccess?.();
    } catch (err: any) {
      ToastService.error(err?.message || "Failed to transfer employee");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      new_department_id: "",
      new_job_title_id: "",
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Transfer Employee" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Position Info */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <FiRepeat className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">Transfer {employeeName}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Current Department:</span>
              <p className="font-medium text-gray-800">{currentDepartment}</p>
            </div>
            <div>
              <span className="text-gray-500">Current Position:</span>
              <p className="font-medium text-gray-800">{currentJobTitle}</p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="select"
            label="New Department"
            name="new_department_id"
            value={form.new_department_id}
            onChange={handleChange}
            required
            options={departments.map((d: any) => ({
              label: d.name,
              value: String(d.id),
            }))}
          />

          <FormField
            type="select"
            label="New Job Title (Optional)"
            name="new_job_title_id"
            value={form.new_job_title_id}
            onChange={handleChange}
            options={[
              { label: "Keep Current Position", value: "KEEP_CURRENT" },
              ...jobTitles.map((j: any) => ({
                label: `${j.title}${j.level ? ` - ${j.level}` : ""}`,
                value: String(j.id),
              })),
            ]}
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
          label="Justification"
          name="justification"
          value={form.justification}
          onChange={handleChange}
          required
          placeholder="Explain the reason for this transfer (e.g., business restructuring, employee request, etc.)..."
          rows={3}
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
            variant="primary"
            type="submit"
            icon={FiRepeat}
            loading={loading}
            disabled={loading}
          >
            Confirm Transfer
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
