import { useRef, useEffect } from "react";
import FormField from "../../common/FormField";
import FormAutocomplete from "../../Core/ui/FormAutocomplete";
import Button from "../../Core/ui/Button";
import { MdAdd, MdDelete, MdWork } from "react-icons/md";
import toast from "react-hot-toast";
import UniversalFileUpload from "../../Core/ui/UniversalFileUpload";

interface WorkExperienceItem {
  companyName: string;
  jobTitle?: string;
  employmentType?: string;
  level?: string;
  department?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  document_urls?: any[];
}

interface StepWorkExperienceProps {
  formData: {
    workExperience: WorkExperienceItem[];
  };
  updateFormData: (field: string, value: any) => void;
  errors?: Record<string, string>;
  readOnlyExistingDocs?: boolean;
}

export default function StepWorkExperience({
  formData,
  updateFormData,
  errors = {},
  readOnlyExistingDocs = false,
}: StepWorkExperienceProps) {
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  // Ensure workExperience is always an array
  const workExperience = Array.isArray(formData.workExperience)
    ? formData.workExperience
    : [];

  const handleExperienceChange = (
    index: number,
    field: keyof WorkExperienceItem,
    value: any,
  ) => {
    const newExperience = [...workExperience];
    (newExperience[index] as any)[field] = value;
    updateFormData("workExperience", newExperience);
  };

  const handleMultiFileChange = async (
    index: number,
    field: string,
    newFiles: File[],
  ) => {
    // 1. Prepare all new file items
    const newItems = newFiles.map((file) => ({
      file,
      name: file.name,
      uploading: true,
      uploadId: `${field}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    // 2. Add all items in one go using functional update
    updateFormData("workExperience", (prev: any[]) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      // Deep clone the specific entry to avoid mutating state directly
      const newExperience = safePrev.map((item, i) =>
        i === index ? { ...item } : item,
      );
      const currentFiles = [...(newExperience[index][field] || [])];
      newExperience[index][field] = [...currentFiles, ...newItems];
      return newExperience;
    });

    // 3. Start individual uploads
    for (const newItem of newItems) {
      const { uploadId, file } = newItem;
      const abortController = new AbortController();
      abortControllersRef.current[uploadId] = abortController;

      try {
        const { uploadFile } =
          await import("../../../services/fileUploadService");
        const url = await uploadFile(file, {
          signal: abortController.signal,
          timeout: 5 * 60 * 1000,
        });

        if (abortController.signal.aborted) return;

        // 4. Update the item using functional update to avoid race conditions
        updateFormData("workExperience", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newExperience = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newExperience[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item: any) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              url,
              uploading: false,
            };
            newExperience[index][field] = latestFiles;
          }
          return newExperience;
        });

        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        if (error?.message === "Upload cancelled") return;

        const errorMessage = error?.message || "Upload failed";
        toast.error(`Failed to upload "${file.name}": ${errorMessage}`);

        // 5. Update error status using functional update
        updateFormData("workExperience", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newExperience = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newExperience[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item: any) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              error: errorMessage,
              uploading: false,
            };
            newExperience[index][field] = latestFiles;
          }
          return newExperience;
        });
      } finally {
        delete abortControllersRef.current[uploadId];
      }
    }
  };

  const addExperience = () => {
    updateFormData("workExperience", [
      ...workExperience,
      {
        companyName: "",
        jobTitle: "",
        employmentType: "",
        level: "",
        department: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        document_urls: [],
      },
    ]);
  };

  const removeExperience = (index: number) => {
    const newExperience = workExperience.filter((_, i) => i !== index);
    updateFormData("workExperience", newExperience);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-k-dark-grey">
          Previous work experience
        </h3>
        <Button
          variant="secondary"
          onClick={addExperience}
          icon={MdAdd}
          className="py-2! px-4! h-10! text-sm cursor-pointer"
        >
          Add Experience
        </Button>
      </div>

      {workExperience.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdWork className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-k-medium-grey">No work experience added yet.</p>
          <Button
            variant="link"
            onClick={addExperience}
            className="mt-2 cursor-pointer"
          >
            Add your first work experience
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {workExperience.map((exp: WorkExperienceItem, index: number) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative animate-[slideUp_0.3s_ease-out]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div>
                <FormField
                  name={`exp_company_${index}`}
                  label="Company Name"
                  value={exp.companyName}
                  onChange={(e) =>
                    handleExperienceChange(index, "companyName", e.target.value)
                  }
                  required
                  error={errors[`exp_company_${index}`]}
                />
              </div>

              {/* Job Titles */}
              <div>
                <FormAutocomplete
                  label="Job Title"
                  value={exp.jobTitle ?? ""}
                  onChange={(val) =>
                    handleExperienceChange(index, "jobTitle", val)
                  }
                  onCreateNew={(val) =>
                    handleExperienceChange(index, "jobTitle", val)
                  }
                  type="jobTitles"
                  placeholder="Search or type to add new job title..."
                  required
                  creatable={true}
                />
              </div>

              {/* Employment Type & Level */}
              <div>
                <FormField
                  name={`exp_type_${index}`}
                  label="Employment Type"
                  type="select"
                  value={exp.employmentType ?? ""}
                  onChange={(e) =>
                    handleExperienceChange(
                      index,
                      "employmentType",
                      e.target.value,
                    )
                  }
                >
                  <option value="">Select Type</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Freelance">Freelance</option>
                </FormField>
              </div>

              <div>
                <FormAutocomplete
                  label="Level"
                  value={exp.level ?? ""}
                  onChange={(val) =>
                    handleExperienceChange(index, "level", val)
                  }
                  onCreateNew={(val) =>
                    handleExperienceChange(index, "level", val)
                  }
                  type="jobLevels"
                  placeholder="Search or add level..."
                />
              </div>

              <FormAutocomplete
                label="Department"
                value={exp.department ?? ""}
                onChange={(val) =>
                  handleExperienceChange(index, "department", val)
                }
                type="departments"
                placeholder="Search or add department..."
                onCreateNew={(val) =>
                  handleExperienceChange(index, "department", val)
                }
                creatable={true}
              />

              {/* Dates */}
              <FormField
                label="Start Date"
                type="date"
                name={`exp_start_${index}`}
                value={exp.startDate}
                onChange={(e) =>
                  handleExperienceChange(index, "startDate", e.target.value)
                }
                required
                error={errors[`exp_start_${index}`]}
              />

              <FormField
                label={"End Date"}
                type="date"
                name={`exp_end_${index}`}
                value={exp.endDate ?? ""}
                onChange={(e) =>
                  handleExperienceChange(index, "endDate", e.target.value)
                }
                error={errors[`exp_end_${index}`]}
              />

              <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-200">
                <UniversalFileUpload
                  label="Experience Documents (Optional)"
                  multiple={true}
                  files={exp.document_urls || []}
                  lockExisting={readOnlyExistingDocs}
                  onFileChange={(files) =>
                    handleMultiFileChange(index, "document_urls", files)
                  }
                  onRemove={(docIdx) => {
                    const updatedDocs = [...(exp.document_urls || [])].filter(
                      (_, i) => i !== docIdx,
                    );
                    handleExperienceChange(index, "document_urls", updatedDocs);
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => removeExperience(index)}
              className="absolute top-4 right-4 text-gray-400 hover:text-error transition-colors p-2 hover:bg-red-50 rounded-full cursor-pointer"
              title="Remove Entry"
            >
              <MdDelete size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
