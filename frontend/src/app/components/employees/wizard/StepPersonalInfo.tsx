import FormField from "../../common/FormField";
import { formatIsoDate } from "../../../utils/dayjs-format";

interface StepPersonalInfoProps {
  formData: {
    fullName: string;
    gender: string;
    dateOfBirth: string;
    tinNumber: string;
    pensionNumber: string;
    placeOfWork: string;
  };
  handleChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

export default function StepPersonalInfo({
  formData,
  handleChange,
  errors = {},
}: StepPersonalInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Full Name */}
      <div className="md:col-span-2">
        <FormField
          label="Full Name"
          name="fullName"
          value={formData.fullName}
          onChange={(e) => handleChange("fullName", e.target.value)}
          placeholder="Enter your full name"
          required
          error={errors.fullName}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender */}
        <FormField
          label="Gender"
          type="select"
          name="gender"
          value={formData.gender}
          onChange={(e) => handleChange("gender", e.target.value)}
          required
          error={errors.gender}
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </FormField>

        {/* Date of Birth */}
        <FormField
          label="Date of Birth (Gregorian)"
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={(e) => handleChange("dateOfBirth", e.target.value)}
          required
          error={errors.dateOfBirth}
          max={formatIsoDate(new Date())}
        />
      </div>

      {/* TIN Number */}
      <div>
        <FormField
          label="TIN Number"
          name="tinNumber"
          value={formData.tinNumber}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            handleChange("tinNumber", val);
          }}
          placeholder="Numeric only"
          required
          error={errors.tinNumber}
        />
      </div>

      {/* Pension Number */}
      <div>
        <FormField
          label="Pension Number"
          name="pensionNumber"
          value={formData.pensionNumber}
          onChange={(e) => {
            handleChange("pensionNumber", e.target.value);
          }}
          placeholder="Optional"
          error={errors.pensionNumber}
        />
      </div>

      {/* Read-Only Fields (HR Filled) */}
      <div className="md:col-span-2 border-t border-gray-200 pt-6 mt-2">
        <h3 className="text-lg font-semibold text-k-dark-grey mb-4">
          Employment Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            name="placeOfWork"
            label="Place of Work"
            value={formData.placeOfWork}
            onChange={(e) => handleChange("placeOfWork", e.target.value)}
            placeholder="Enter place of work"
            className="bg-white"
          />
          {/* Placeholder for Company ID / Employee Code if available in context */}
        </div>
      </div>
    </div>
  );
}
