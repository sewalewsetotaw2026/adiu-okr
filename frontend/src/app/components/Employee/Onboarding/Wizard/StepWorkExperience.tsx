import FormInput from "../../../Core/ui/FormInput";
import FormAutocomplete from "../../../Core/ui/FormAutocomplete";
import FormSelect from "../../../Core/ui/FormSelect";
import Button from "../../../Core/ui/Button";
import FileUpload from "../../../Core/ui/FileUpload";
import { MdAdd, MdDelete, MdWork } from "react-icons/md";

interface StepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  errors: any;
}

export default function StepWorkExperience({
  formData,
  updateFormData,
}: StepProps) {
  const handleExperienceChange = (index: number, field: string, value: any) => {
    const newExperience = formData.workExperience.map((exp: any, i: number) =>
      i === index ? { ...exp, [field]: value } : exp,
    );
    updateFormData("workExperience", newExperience);
  };

  const addExperience = () => {
    updateFormData("workExperience", [
      ...formData.workExperience,
      {
        companyName: "",
        jobTitle: "",
        previousJobTitle: "",
        level: "",
        department: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
      },
    ]);
  };

  const removeExperience = (index: number) => {
    const newExperience = formData.workExperience.filter(
      (_: any, i: number) => i !== index,
    );
    updateFormData("workExperience", newExperience);
  };

  return (
    <div className="space-y-8 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={addExperience}
          className="text-sm flex items-center"
        >
          <MdAdd className="mr-1" /> Add Experience
        </Button>
      </div>

      {formData.workExperience.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdWork className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500">No work experience added yet.</p>
          <Button
            variant="subtle"
            onClick={addExperience}
            className="mt-2 text-[#db602c]"
          >
            Add your first work experience
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {formData.workExperience.map((exp: any, index: number) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6 relative animate-[fadeIn_0.3s_ease-out]"
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-medium text-gray-800 flex items-center">
                <MdWork className="mr-2 text-gray-500" /> Experience #
                {index + 1}
              </h4>
              {formData.workExperience.length > 0 && (
                <Button
                  variant="subtle"
                  onClick={() => removeExperience(index)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 h-auto"
                >
                  <MdDelete size={18} />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div className="md:col-span-2">
                <FormInput
                  label="Company Name"
                  value={exp.companyName}
                  onChange={(e) =>
                    handleExperienceChange(index, "companyName", e.target.value)
                  }
                  required
                />
              </div>

              {/* Job Title */}
              <div className="md:col-span-2">
                <FormAutocomplete
                  label="Job Title"
                  value={exp.jobTitle}
                  onChange={(val) =>
                    handleExperienceChange(index, "jobTitle", val)
                  }
                  onCreateNew={(val) =>
                    handleExperienceChange(index, "jobTitle", val)
                  }
                  type="jobTitles"
                  placeholder="Search or type to add new job title..."
                  required
                />
              </div>

              {/* Employment Type */}
              <FormSelect
                label="Employment Type"
                value={exp.employmentType}
                onChange={(e) =>
                  handleExperienceChange(
                    index,
                    "employmentType",
                    e.target.value,
                  )
                }
                options={[
                  { value: "Full Time", label: "Full Time" },
                  { value: "Part Time", label: "Part Time" },
                  { value: "Contract", label: "Contract" },
                  { value: "Internship", label: "Internship" },
                ]}
                placeholder="Select Type"
              />

              <FormAutocomplete
                label="Level"
                value={exp.level}
                onChange={(val) => handleExperienceChange(index, "level", val)}
                onCreateNew={(val) =>
                  handleExperienceChange(index, "level", val)
                }
                type="jobLevels"
                placeholder="Select or type Level"
              />

              <FormAutocomplete
                label="Department"
                value={exp.department}
                onChange={(val) =>
                  handleExperienceChange(index, "department", val)
                }
                placeholder="Optional"
                type="departments"
              />

              {/* Dates */}
              <FormInput
                label="Start Date"
                type="date"
                value={exp.startDate}
                onChange={(e) =>
                  handleExperienceChange(index, "startDate", e.target.value)
                }
                required
              />

              <FormInput
                label="End Date"
                type="date"
                value={exp.endDate}
                onChange={(e) =>
                  handleExperienceChange(index, "endDate", e.target.value)
                }
              />

              {/* Document */}
              <div className="md:col-span-2">
                <FileUpload
                  label="Employment Document (Letter)"
                  file={exp.document}
                  currentUrl={exp.documentUrl}
                  onFileChange={(file) =>
                    handleExperienceChange(index, "document", file)
                  }
                  onRemove={() => {
                    handleExperienceChange(index, "document", null);
                    handleExperienceChange(index, "documentUrl", null);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
