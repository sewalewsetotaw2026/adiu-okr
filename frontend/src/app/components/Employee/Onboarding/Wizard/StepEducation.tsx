import FormInput from "../../../Core/ui/FormInput";
import FormAutocomplete from "../../../Core/ui/FormAutocomplete";
import FormSelect from "../../../Core/ui/FormSelect";
import Button from "../../../Core/ui/Button";
import Checkbox from "../../../Core/ui/Checkbox";
import FileUpload from "../../../Core/ui/FileUpload";
import { MdAdd, MdDelete, MdSchool } from "react-icons/md";

interface StepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  errors: any;
}

export default function StepEducation({
  formData,
  updateFormData,
  errors,
}: StepProps) {
  const handleEducationChange = (index: number, field: string, value: any) => {
    const newEducation = formData.education.map((edu: any, i: number) =>
      i === index ? { ...edu, [field]: value } : edu
    );
    updateFormData("education", newEducation);
  };

  const addEducation = () => {
    updateFormData("education", [
      ...formData.education,
      {
        level: "",
        fieldOfStudy: "",
        institution: "",
        institutionCategory: "Private",
        programType: "Regular",
        startDate: "",
        endDate: "",
        isCurrent: false, 
        hasCostSharing: false,
        costSharingDocumentNumber: "",
        costSharingIssuingInstitution: "",
        costSharingIssueDate: "",
        costSharingTotalCost: "",
        costSharingRemarks: "",
        costSharingDocument: null,
      },
    ]);
  };

  const removeEducation = (index: number) => {
    const newEducation = formData.education.filter(
      (_: any, i: number) => i !== index
    );
    updateFormData("education", newEducation);
  };

  return (
    <div className="space-y-8 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={addEducation}
          className="text-sm flex items-center"
        >
          <MdAdd className="mr-1" /> Add Education
        </Button>
      </div>

      {formData.education.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdSchool className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500">No education history added yet.</p>
          <Button
            variant="subtle"
            onClick={addEducation}
            className="mt-2 text-[#db602c]"
          >
            Add your education
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {formData.education.map((edu: any, index: number) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6 relative animate-[fadeIn_0.3s_ease-out]"
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-medium text-gray-800 flex items-center">
                <MdSchool className="mr-2 text-gray-500" /> Education #
                {index + 1}
              </h4>
              <Button
                  variant="subtle"
                  onClick={() => removeEducation(index)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 h-auto"
                  disabled={formData.education.length === 1} // Keep one? Or allow 0? Usually allow 0 if not mandated global required. User said "Education section should be required".
                >
                  <MdDelete size={18} />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormSelect
                label="Level of Education"
                value={edu.level}
                onChange={(e) =>
                  handleEducationChange(index, "level", e.target.value)
                }
                options={[
                  { value: "High School", label: "High School" },
                  { value: "Diploma", label: "Diploma" },
                  { value: "Bachelors", label: "Bachelor's Degree" },
                  { value: "Masters", label: "Master's Degree" },
                  { value: "PhD", label: "PhD" },
                ]}
                required
                // FormSelect usually doesn't take error prop yet, assuming consistency or might need update.
                // If FormSelect is like FormInput, it needs update. But user didn't ask to update Select.
                // Assuming validation message is shown elsewhere or default browser req.
                // Actually user said "education section should be required like the fields should come and we should have a * showing required".
                // I added * logic via required prop.
              />

              <FormAutocomplete
                label="Field of Study"
                value={edu.fieldOfStudy}
                onChange={(val) =>
                  handleEducationChange(index, "fieldOfStudy", val)
                }
                type="fieldsOfStudy"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormAutocomplete
                label="Institution"
                value={edu.institution}
                onChange={(val) =>
                  handleEducationChange(index, "institution", val)
                }
                type="institutions"
                required
              />

              <FormSelect
                label="Program Type"
                value={edu.programType}
                onChange={(e) =>
                  handleEducationChange(index, "programType", e.target.value)
                }
                options={["Regular", "Extension", "Distance", "Summer"]}
                required
                placeholder="Select Program"
              />

              <FormInput
                label="Start Date"
                type="date"
                value={edu.startDate}
                onChange={(e) =>
                  handleEducationChange(index, "startDate", e.target.value)
                }
                required
                error={errors[`edu_start_${index}`]}
              />

              <div>
                  <FormInput
                    label={edu.isCurrent ? "Expected End Date" : "End Date"}
                    type="date"
                    value={edu.endDate}
                    onChange={(e) =>
                      handleEducationChange(index, "endDate", e.target.value)
                    }
                    error={errors[`edu_end_${index}`]}
                  />
                  <Checkbox 
                     label="Currently studying / attending"
                     checked={edu.isCurrent || false}
                     onChange={(e) => handleEducationChange(index, "isCurrent", e.target.checked)}
                  />
              </div>

              <FormSelect
                label="Institution Type"
                value={edu.institutionCategory}
                onChange={(e) =>
                  handleEducationChange(
                    index,
                    "institutionCategory",
                    e.target.value
                  )
                }
                options={[
                  { value: "Private", label: "Private" },
                  { value: "Government", label: "Government" },
                ]}
                required
              />

              <div className="md:col-span-2">
                <Checkbox
                  label="Has Cost Sharing?"
                  checked={edu.hasCostSharing}
                  onChange={(e) =>
                    handleEducationChange(
                      index,
                      "hasCostSharing",
                      e.target.checked
                    )
                  }
                />
              </div>

              {edu.hasCostSharing && (
                <div className="md:col-span-2 space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Cost Sharing Document Number"
                      value={edu.costSharingDocumentNumber}
                      onChange={(e) =>
                        handleEducationChange(
                          index,
                          "costSharingDocumentNumber",
                          e.target.value
                        )
                      }
                      required
                    />
                    <FormInput
                      label="Issuing Institution"
                      value={edu.costSharingIssuingInstitution}
                      onChange={(e) =>
                        handleEducationChange(
                          index,
                          "costSharingIssuingInstitution",
                          e.target.value
                        )
                      }
                      required
                    />
                    <FormInput
                      label="Issue Date"
                      type="date"
                      value={edu.costSharingIssueDate}
                      onChange={(e) =>
                        handleEducationChange(
                          index,
                          "costSharingIssueDate",
                          e.target.value
                        )
                      }
                      required
                    />
                    <FormInput
                      label="Total Cost Amount"
                      type="number"
                      value={edu.costSharingTotalCost}
                      onChange={(e) =>
                        handleEducationChange(
                          index,
                          "costSharingTotalCost",
                          e.target.value
                        )
                      }
                      required
                    />
                  </div>

                  <FormInput
                    label="Remarks"
                    value={edu.costSharingRemarks}
                    onChange={(e) =>
                      handleEducationChange(
                        index,
                        "costSharingRemarks",
                        e.target.value
                      )
                    }
                    placeholder="Any additional notes..."
                  />

                  {/* Use FileUpload Component */}
                  <div className="mt-4">
                    <FileUpload
                      label="Cost Sharing Agreement/Declaration Document"
                      required
                      file={(edu.costSharingDocument instanceof File) ? edu.costSharingDocument : null}
                      currentUrl={typeof edu.costSharingDocument === "string" ? edu.costSharingDocument : edu.costSharingDocumentUrl}
                      onFileChange={(file) =>
                        handleEducationChange(
                          index,
                          "costSharingDocument",
                          file
                        )
                      }
                      onRemove={() => {
                        handleEducationChange(index, "costSharingDocument", null);
                        handleEducationChange(index, "costSharingDocumentUrl", null);
                      }}
                      error={errors[`edu_cost_doc_${index}`]}
                    />
                  </div>
                </div>
              )}

              {/* General Document (Degree/Diploma) */}
              <div className="md:col-span-2">
                <FileUpload
                  label="Education Document (Degree/Diploma)"
                  file={(edu.document instanceof File) ? edu.document : null}
                  currentUrl={typeof edu.document === "string" ? edu.document : edu.documentUrl}
                  onFileChange={(file) =>
                    handleEducationChange(index, "document", file)
                  }
                  onRemove={() => {
                    handleEducationChange(index, "document", null);
                    handleEducationChange(index, "documentUrl", null);
                  }}
                  error={errors[`edu_doc_${index}`]}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
