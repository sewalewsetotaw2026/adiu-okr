import { useRef, useEffect } from "react";
// ... (rest omitted, will use target content logic)
import FormField from "../../common/FormField";
import FormAutocomplete from "../../Core/ui/FormAutocomplete";
import Button from "../../Core/ui/Button";
import Checkbox from "../../common/Checkbox";
import {
  MdAdd,
  MdDelete,
  MdSchool,
  MdDescription,
  MdOpenInNew,
} from "react-icons/md";
import toast from "react-hot-toast";
import UniversalFileUpload from "../../Core/ui/UniversalFileUpload";

interface CostSharing {
  documentNumber: string;
  issuingInstitution: string;
  issueDate: string;
  department: string;
  yearOfEntrance: string | number;
  graduationDate: string;
  declaredTotalCost: string;
  currency: string;
  commitmentType: string;
  regulationReference: string;
  remarks: string;
  paymentStatus: string;
}

interface DocumentState {
  file?: File;
  name?: string;
  url?: string;
  uploading?: boolean;
  uploadId?: string;
  error?: string;
}

interface Education {
  level: string;
  fieldOfStudy: string;
  institution: string;
  programType: string;
  hasCostSharing: boolean;
  costSharingDocument: DocumentState[] | string[];
  costSharingDocumentUrl?: string;
  costSharing: CostSharing;
  document_urls: DocumentState[] | string[];
  startDate: string;
  endDate: string;
  graduationYear?: string | number;
  isCurrent: boolean;
}

interface StepEducationProps {
  formData: {
    education: Education[];
  };
  updateFormData: (field: string, value: any) => void;
  errors?: Record<string, string>;
  readOnlyExistingDocs?: boolean;
}

export default function StepEducation({
  formData,
  updateFormData,
  errors = {},
  readOnlyExistingDocs = false,
}: StepEducationProps) {
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  // Ensure education is always an array
  const education = Array.isArray(formData.education) ? formData.education : [];

  // Ensure at least one education entry exists
  useEffect(() => {
    if (education.length === 0) {
      updateFormData("education", [
        {
          level: "",
          fieldOfStudy: "",
          institution: "",
          programType: "Regular",
          hasCostSharing: false,
          costSharingDocument: [],
          costSharing: {
            documentNumber: "",
            issuingInstitution: "",
            issueDate: "",
            department: "",
            yearOfEntrance: "",
            graduationDate: "",
            declaredTotalCost: "",
            currency: "ETB",
            commitmentType: "",
            regulationReference: "",
            remarks: "",
            paymentStatus: "UNPAID",
          },
          document_urls: [],
          startDate: "",
          endDate: "",
          graduationYear: "",
          isCurrent: false,
        },
      ]);
    }
  }, [education.length]);

  const handleEducationChange = (index: number, field: string, value: any) => {
    const newEducation = [...education];
    (newEducation[index] as any)[field] = value;

    // Auto-calculate graduation year if end date changes
    if (field === "endDate" && value) {
      newEducation[index].graduationYear = new Date(value).getFullYear();
    }

    // Auto-sync cost sharing duplicates
    if (newEducation[index].costSharing) {
      if (field === "institution")
        newEducation[index].costSharing.issuingInstitution = value;
      if (field === "fieldOfStudy")
        newEducation[index].costSharing.department = value;
      if (field === "startDate" && value)
        newEducation[index].costSharing.yearOfEntrance = new Date(
          value,
        ).getFullYear();
      if (field === "endDate" && value)
        newEducation[index].costSharing.graduationDate = value;

      // Also sync if enabling cost sharing
      if (field === "hasCostSharing" && value === true) {
        const edu = newEducation[index];
        if (edu.institution)
          edu.costSharing.issuingInstitution = edu.institution;
        if (edu.fieldOfStudy) edu.costSharing.department = edu.fieldOfStudy;
        if (edu.startDate)
          edu.costSharing.yearOfEntrance = new Date(
            edu.startDate,
          ).getFullYear();
        if (edu.endDate) edu.costSharing.graduationDate = edu.endDate;
      }
    }

    updateFormData("education", newEducation);
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

    // 2. Add all items in one go using functional update to ensure we have latest state
    updateFormData("education", (prev: any[]) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      // Deep clone the specific entry to avoid mutating state directly
      const newEducation = safePrev.map((item, i) =>
        i === index ? { ...item } : item,
      );
      const currentFiles = [...(newEducation[index][field] || [])];
      newEducation[index][field] = [...currentFiles, ...newItems];
      return newEducation;
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
        updateFormData("education", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newEducation = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newEducation[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              url,
              uploading: false,
            };
            newEducation[index][field] = latestFiles;
          }
          return newEducation;
        });

        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        if (error?.message === "Upload cancelled") return;

        const errorMessage = error?.message || "Upload failed";
        toast.error(`Failed to upload "${file.name}": ${errorMessage}`);

        // 5. Update error status using functional update
        updateFormData("education", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newEducation = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newEducation[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              error: errorMessage,
              uploading: false,
            };
            newEducation[index][field] = latestFiles;
          }
          return newEducation;
        });
      } finally {
        delete abortControllersRef.current[uploadId];
      }
    }
  };

  const addEducation = () => {
    updateFormData("education", [
      ...education,
      {
        level: "",
        fieldOfStudy: "",
        institution: "",
        programType: "Regular",
        hasCostSharing: false,
        costSharingDocument: [],
        costSharing: {
          documentNumber: "",
          issuingInstitution: "",
          issueDate: "",
          department: "",
          yearOfEntrance: "",
          graduationDate: "",
          declaredTotalCost: "",
          currency: "ETB",
          commitmentType: "",
          regulationReference: "",
          remarks: "",
          paymentStatus: "UNPAID",
        },
        document_urls: [],
        startDate: "",
        endDate: "",
        graduationYear: "",
        isCurrent: false,
      },
    ]);
  };

  const removeEducation = (index: number) => {
    const newEducation = education.filter(
      (_: Education, i: number) => i !== index,
    );
    updateFormData("education", newEducation);
  };
  console.log("cost sharing information", education);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-k-dark-grey">
          Education History
        </h3>
        <Button
          variant="secondary"
          onClick={addEducation}
          icon={MdAdd}
          className="py-2! px-4! h-10! text-sm cursor-pointer"
        >
          Add Education
        </Button>
      </div>

      {education.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdSchool className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-k-medium-grey">No education details added yet.</p>
          <Button variant="link" onClick={addEducation} className="mt-2">
            Add your first education entry
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {education.map((edu, index) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative animate-[slideUp_0.3s_ease-out]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Level */}
              <FormField
                name={`edu_level_${index}`}
                label="Education Level"
                type="select"
                value={edu.level}
                onChange={(e) =>
                  handleEducationChange(index, "level", e.target.value)
                }
                required
                error={errors[`edu_level_${index}`]}
              >
                <option value="">Select Level</option>
                <option value="High School">High School</option>
                <option value="Diploma">Diploma</option>
                <option value="Bachelor">Bachelor's Degree</option>
                <option value="Master">Master's Degree</option>
                <option value="PhD">PhD</option>
              </FormField>

              {/* Field of Study */}
              {/* Field of Study */}
              <FormAutocomplete
                label="Field of Study"
                value={edu.fieldOfStudy}
                onChange={(val) =>
                  handleEducationChange(index, "fieldOfStudy", val)
                }
                type="fieldsOfStudy"
                placeholder="e.g. Computer Science"
                required
                error={errors[`edu_field_${index}`]}
                creatable={true}
              />

              {/* Institution */}
              <FormAutocomplete
                label="Institution"
                value={edu.institution}
                onChange={(val) =>
                  handleEducationChange(index, "institution", val)
                }
                type="institutions"
                placeholder="e.g. Addis Ababa University"
                required
                error={errors[`edu_inst_${index}`]}
                creatable={true}
              />

              {/* Program Type */}
              <FormField
                name={`edu_prog_${index}`}
                label="Program Type"
                type="select"
                value={edu.programType}
                onChange={(e) =>
                  handleEducationChange(index, "programType", e.target.value)
                }
                required
                error={errors[`edu_prog_${index}`]}
              >
                <option value="Regular">Regular</option>
                <option value="Extension">Extension</option>
                <option value="Weekend">Weekend</option>
                <option value="Distance">Distance</option>
              </FormField>

              {/* Dates */}
              <FormField
                label="Start Date"
                type="date"
                name={`edu_start_${index}`}
                value={edu.startDate}
                onChange={(e) =>
                  handleEducationChange(index, "startDate", e.target.value)
                }
                required
                error={errors[`edu_start_${index}`]}
              />

              <FormField
                label={edu.isCurrent ? "Expected End Date" : "End Date"}
                type="date"
                name={`edu_end_${index}`}
                value={edu.endDate}
                onChange={(e) =>
                  handleEducationChange(index, "endDate", e.target.value)
                }
                error={errors[`edu_end_${index}`]}
              />

              {/* Checkboxes */}
              <div className="md:col-span-2 flex flex-col gap-4 mt-2">
                <div className="flex flex-col sm:flex-row gap-6">
                  <Checkbox
                    name={`edu_isCurrent_${index}`}
                    label="I am currently studying here"
                    checked={edu.isCurrent}
                    onChange={(e) =>
                      handleEducationChange(
                        index,
                        "isCurrent",
                        e.target.checked,
                      )
                    }
                  />
                  <Checkbox
                    name={`edu_hasCostSharing_${index}`}
                    label="Has Cost Sharing?"
                    checked={edu.hasCostSharing}
                    onChange={(e) =>
                      handleEducationChange(
                        index,
                        "hasCostSharing",
                        e.target.checked,
                      )
                    }
                  />
                </div>

                {/* Conditional Cost Sharing Upload */}
                {edu.hasCostSharing && (
                  <div className="mt-2 p-4 bg-primary-light/30 border border-primary-light rounded-xl animate-[slideUp_0.3s_ease-out]">
                    <UniversalFileUpload
                      label="Upload Cost Sharing Agreement(s)"
                      required={true}
                      files={edu.costSharingDocument || []}
                      multiple={true}
                      lockExisting={readOnlyExistingDocs}
                      onFileChange={(files) =>
                        handleMultiFileChange(
                          index,
                          "costSharingDocument",
                          files,
                        )
                      }
                      onRemove={(docIdx) => {
                        const newDocs = [
                          ...(edu.costSharingDocument || []),
                        ].filter((_, i) => i !== docIdx);
                        handleEducationChange(
                          index,
                          "costSharingDocument",
                          newDocs,
                        );
                      }}
                      onCancel={(docIdx) => {
                        const doc = (edu.costSharingDocument as any[])[docIdx];
                        if (doc?.uploadId) {
                          const controller =
                            abortControllersRef.current[doc.uploadId];
                          if (controller) {
                            controller.abort();
                            delete abortControllersRef.current[doc.uploadId];
                            toast("Upload cancelled");
                            // Remove the cancelled item from the list
                            const newDocs = [
                              ...(edu.costSharingDocument || []),
                            ].filter((_, i) => i !== docIdx);
                            handleEducationChange(
                              index,
                              "costSharingDocument",
                              newDocs,
                            );
                          }
                        }
                      }}
                      error={errors[`edu_cost_doc_${index}`]}
                    />
                    {errors[`edu_cost_doc_${index}`] && (
                      <p className="mt-1 text-xs text-error">
                        {errors[`edu_cost_doc_${index}`]}
                      </p>
                    )}

                    {/* Comprehensive Cost Sharing Form */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {edu.costSharingDocumentUrl && (
                        <div className="md:col-span-2 bg-primary-light/30 p-3 rounded-lg border border-primary-light flex items-center gap-3">
                          <div className="p-1.5 bg-primary-light rounded-full text-primary">
                            <MdDescription size={16} />
                          </div>
                          <a
                            href={edu.costSharingDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            View Current Agreement <MdOpenInNew size={14} />
                          </a>
                        </div>
                      )}

                      <FormField
                        name={`edu_cost_doc_num_${index}`}
                        label="Document Number"
                        value={edu.costSharing?.documentNumber || ""}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            documentNumber: e.target.value,
                          })
                        }
                        placeholder="e.g. CS-2023-001"
                      />

                      <FormField
                        label="Issue Date"
                        type="date"
                        name={`edu_cost_issue_${index}`}
                        value={edu.costSharing?.issueDate || ""}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            issueDate: e.target.value,
                          })
                        }
                      />

                      <FormField
                        name={`edu_cost_total_${index}`}
                        label="Declared Total Cost"
                        type="number"
                        value={edu.costSharing?.declaredTotalCost || ""}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            declaredTotalCost: e.target.value,
                          })
                        }
                        placeholder="e.g. 50000"
                      />

                      <FormField
                        name={`edu_cost_currency_${index}`}
                        label="Currency"
                        type="select"
                        value={edu.costSharing?.currency || "ETB"}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            currency: e.target.value,
                          })
                        }
                      >
                        <option value="ETB">ETB</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </FormField>

                      <FormField
                        name={`edu_cost_payment_status_${index}`}
                        label="Payment Status"
                        type="select"
                        value={`${edu.costSharing?.paymentStatus || ""}`}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            paymentStatus: e.target.value,
                          })
                        }
                      >
                        <option value="UNPAID">Unpaid</option>
                        <option value="PARTIALLY_PAID">Partially Paid</option>
                        <option value="FULLY_PAID">Fully Paid</option>
                      </FormField>

                      <FormField
                        name={`edu_cost_commitment_${index}`}
                        label="Commitment Type"
                        type="select"
                        value={edu.costSharing?.commitmentType || ""}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            commitmentType: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Type</option>
                        <option value="Full_Study">Full Study</option>
                        <option value="Partial_Study">Partial Study</option>
                        <option value="Service_Obligation">
                          Service Obligation
                        </option>
                      </FormField>

                      <FormField
                        name={`edu_cost_regulation_${index}`}
                        label="Regulation Reference"
                        value={edu.costSharing?.regulationReference || ""}
                        onChange={(e) =>
                          handleEducationChange(index, "costSharing", {
                            ...edu.costSharing,
                            regulationReference: e.target.value,
                          })
                        }
                        placeholder="e.g. Regulation No. 1234/2020"
                      />

                      <div className="md:col-span-2">
                        <FormField
                          name={`edu_cost_remarks_${index}`}
                          label="Remarks"
                          value={edu.costSharing?.remarks || ""}
                          onChange={(e) =>
                            handleEducationChange(index, "costSharing", {
                              ...edu.costSharing,
                              remarks: e.target.value,
                            })
                          }
                          placeholder="Additional notes about the cost sharing agreement..."
                          type="textarea"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <UniversalFileUpload
                label="Education Documents (Degree/Diploma/Certificates)"
                files={edu.document_urls as any[]}
                multiple={true}
                required={true}
                lockExisting={readOnlyExistingDocs}
                onFileChange={(files) =>
                  handleMultiFileChange(index, "document_urls", files)
                }
                onRemove={(docIdx) => {
                  const newDocs = [...(edu.document_urls || [])].filter(
                    (_, i) => i !== docIdx,
                  );
                  handleEducationChange(index, "document_urls", newDocs);
                }}
              />
            </div>

            {education.length > 1 && (
              <button
                onClick={() => removeEducation(index)}
                className="absolute top-4 right-4 text-gray-400 hover:text-error transition-colors p-2 hover:bg-red-50 rounded-full"
                title="Remove Entry"
              >
                <MdDelete size={20} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
