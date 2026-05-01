import React, { useEffect } from "react";
import FormAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import FormInput from "../../../../components/Core/ui/FormInput";
import FormSelect from "../../../../components/Core/ui/FormSelect";
import {
  FiDollarSign,
  FiBriefcase,
  FiCalendar,
  FiLayers,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";

interface Props {
  formData: any;
  handleChange: (field: string, value: any, id?: string) => void;
  errors?: any;
}

export default function EditEmploymentForm({
  formData,
  handleChange,
  errors = {},
}: Props) {
  // ✅ Auto-calculate Gross Salary
  useEffect(() => {
    const basic = parseFloat(formData.basic_salary) || 0;
    const totalAllowances = (formData.allowances || []).reduce(
      (sum: number, allowance: any) => {
        return sum + (parseFloat(allowance.amount) || 0);
      },
      0,
    );
    const gross = basic + totalAllowances;
    const formattedGross = gross > 0 ? gross.toFixed(2) : "";

    if (formData.gross_salary !== formattedGross) {
      handleChange("gross_salary", formattedGross);
    }
  }, [formData.basic_salary, formData.allowances]);

  return (
    <div className="space-y-8">
      {/* Job Details Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiBriefcase /> Job Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormAutocomplete
            label="Job Title"
            value={formData.title}
            onChange={(val) => handleChange("title", val)}
            onIdChange={(id) => handleChange("title", formData.title, id)}
            placeholder="e.g. Software Engineer"
            type="jobTitles"
            required
            icon={<FiBriefcase />}
          />
          <FormAutocomplete
            label="Job Level"
            value={formData.level}
            onChange={(val) => handleChange("level", val)}
            onIdChange={(id) => handleChange("level", formData.level, id)}
            placeholder="e.g. Senior"
            type="jobLevels"
            icon={<FiLayers />}
            required
          />
          <FormAutocomplete
            label="Department"
            value={formData.department}
            onChange={(val) => handleChange("department", val)}
            onIdChange={(id) =>
              handleChange("department", formData.department, id)
            }
            placeholder="e.g. Engineering"
            type="departments"
            required
          />
          <FormSelect
            label="Employment Type"
            value={formData.employment_type}
            onChange={(e) => handleChange("employment_type", e.target.value)}
            options={[
              { value: "Full Time", label: "Full Time" },
              { value: "Part-Time", label: "Part-Time" },
              { value: "Contract", label: "Contract" },
              { value: "Outsourced", label: "Outsourced" },
            ]}
            required
          />
          <FormInput
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleChange("start_date", e.target.value)}
            required
            icon={<FiCalendar />}
          />
        </div>
      </div>

      {/* Salary Details Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiDollarSign /> Salary Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gross Salary Display */}
          <div className="w-full">
            <label className="block mb-1.5 font-semibold text-gray-700">
              Gross Salary
            </label>
            <div className="flex items-center justify-center bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 h-[50px] shadow-sm">
              <span className="text-lg font-bold text-primary">
                {formData.gross_salary ? formData.gross_salary : "0.00"}
              </span>
            </div>
          </div>
          <FormInput
            label="Basic Salary"
            type="text"
            inputMode="decimal"
            value={formData.basic_salary}
            onChange={(e) => handleChange("basic_salary", e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      {/* Allowances Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiDollarSign /> Allowances
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Add or remove allowances as needed.
        </p>

        <div className="space-y-4">
          {(formData.allowances || []).map((allowance: any, index: number) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <FormInput
                  label="Allowance Name"
                  value={allowance.name}
                  onChange={(e) => {
                    const newAllowances = [...(formData.allowances || [])];
                    newAllowances[index] = {
                      ...newAllowances[index],
                      name: e.target.value,
                    };
                    handleChange("allowances", newAllowances);
                  }}
                  placeholder="e.g. Transportation Allowance"
                  required
                />
              </div>
              <div className="flex-1">
                <FormInput
                  label="Amount"
                  type="text"
                  inputMode="decimal"
                  value={allowance.amount}
                  onChange={(e) => {
                    const newAllowances = [...(formData.allowances || [])];
                    newAllowances[index] = {
                      ...newAllowances[index],
                      amount: e.target.value,
                    };
                    handleChange("allowances", newAllowances);
                  }}
                  placeholder="0.00"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const newAllowances = [...(formData.allowances || [])].filter(
                    (_, i) => i !== index,
                  );
                  handleChange("allowances", newAllowances);
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
              handleChange("allowances", [
                ...(formData.allowances || []),
                { name: "", amount: "" },
              ]);
            }}
            className="flex items-center gap-2 text-primary font-medium hover:bg-primary-light px-4 py-2 rounded-lg transition-colors border border-dashed border-primary"
          >
            <FiPlus /> Add Allowance
          </button>
        </div>
      </div>
    </div>
  );
}
