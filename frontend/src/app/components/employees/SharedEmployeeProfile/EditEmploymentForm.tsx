import { useEffect } from "react";
import FormAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import FormField from "../../common/FormField";
// import FormInput from "../../../components/Core/ui/FormInput"; // Removed
// import FormSelect from "../../../components/Core/ui/FormSelect"; // Removed
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
  handleChange: (field: string, value: any) => void;
  errors?: any;
}

export default function EditEmploymentForm({
  formData,
  handleChange,
}: Props) {
  // ✅ Auto-calculate Gross Salary
  useEffect(() => {
    const basic = parseFloat(formData.basic_salary) || 0;
    const totalAllowances = (formData.allowances || []).reduce(
      (sum: number, allowance: any) => {
        return sum + (parseFloat(allowance.amount) || 0);
      },
      0
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
            onCreateNew={(val) => handleChange("title", val)}
            placeholder="e.g. Software Engineer"
            type="jobTitles"
            required
            icon={<FiBriefcase />}
          />
          <FormAutocomplete
            label="Job Level"
            value={formData.level}
            onChange={(val) => handleChange("level", val)}
            onCreateNew={(val) => handleChange("level", val)}
            placeholder="e.g. Senior"
            type="jobLevels"
            icon={<FiLayers />}
            required
          />
          <FormAutocomplete
            label="Department"
            value={formData.department}
            onChange={(val) => handleChange("department", val)}
            onCreateNew={(val) => handleChange("department", val)}
            placeholder="e.g. Engineering"
            type="departments"
            required
          />
          <FormField
            label="Employment Type"
            type="select"
            name="employment_type"
            value={formData.employment_type}
            onChange={(e) => handleChange("employment_type", e.target.value)}
            options={[
              { value: "Full Time", label: "Full Time" },
              { value: "Part-Time", label: "Part-Time" },
              { value: "Contract", label: "Contract" },
              { value: "Outsourced", label: "Outsourced" },
            ]}
            required
            className="w-full"
          />
          <FormField
            label="Start Date"
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={(e) => handleChange("start_date", e.target.value)}
            required
            icon={FiCalendar}
            className="w-full"
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
          <FormField
            label="Gross Salary"
            name="gross_salary"
            value={formData.gross_salary || "0.00"}
            readOnly
            className="text-center"
            inputClassName="!bg-primary-light/30 !border-primary-light text-primary font-bold text-lg text-center shadow-sm"
          />
          <FormField
            label="Basic Salary"
            type="text"
            name="basic_salary"
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
                <FormAutocomplete
                  label="Allowance Name"
                  value={allowance.name}
                  onChange={(val) => {
                    const newAllowances = [...(formData.allowances || [])];
                    newAllowances[index] = {
                      ...newAllowances[index],
                      name: val,
                    };
                    handleChange("allowances", newAllowances);
                  }}
                  placeholder="e.g. Transportation Allowance"
                  type="allowanceTypes"
                  onCreateNew={(val) => {
                    const newAllowances = [...(formData.allowances || [])];
                    newAllowances[index] = {
                      ...newAllowances[index],
                      name: val,
                    };
                    handleChange("allowances", newAllowances);
                  }}
                  required
                />
              </div>
              <div className="flex-1">
                <FormField
                  label="Amount"
                  type="text"
                  name={`allowance_amount_${index}`}
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
                    (_, i) => i !== index
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
