import React from "react";
import FormInput from "../../../Core/ui/FormInput";
import FormSelect from "../../../Core/ui/FormSelect";

interface StepProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  errors: any;
}

export default function StepPersonalInfo({
  formData,
  handleChange,
  errors,
}: StepProps) {
  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <FormInput
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="e.g. Abebe Kebede"
            required
          />
        </div>
        <FormSelect
          label="Gender"
          value={formData.gender}
          onChange={(e) => handleChange("gender", e.target.value)}
          options={["Male", "Female"]}
          required
          placeholder="Select Gender"
        />
        import SmartDateInput from "../../../Core/ui/SmartDateInput"; // ... //
        ...
        <SmartDateInput
          label="Date of Birth (Gregorian)"
          value={formData.dateOfBirth}
          onChange={(val) => handleChange("dateOfBirth", val)}
          required
          error={errors.dateOfBirth}
        />
        <FormInput
          label="TIN Number"
          value={formData.tinNumber}
          onChange={(e) => handleChange("tinNumber", e.target.value)}
          // placeholder="Optional"
          required
        />
        <FormInput
          label="Pension Number"
          value={formData.pensionNumber}
          onChange={(e) => handleChange("pensionNumber", e.target.value)}
          placeholder="Optional"
        />
        <FormInput
          label="Place of Work"
          value={formData.placeOfWork}
          onChange={(e) => handleChange("placeOfWork", e.target.value)}
          placeholder="e.g. Head Office"
        />
      </div>
    </div>
  );
}
