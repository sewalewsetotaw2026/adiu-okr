import React, { useRef, useEffect } from "react";
import FormField from "../../common/FormField";
import Button from "../../Core/ui/Button";
import { MdAdd, MdDelete, MdCardMembership } from "react-icons/md";
import toast from "react-hot-toast";
import UniversalFileUpload from "../../Core/ui/UniversalFileUpload";

interface CertificationDocState {
  file?: File;
  url?: string;
  uploading?: boolean;
  uploadId?: string;
  error?: string;
}

interface Certification {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate: string;
  credentialId: string;
  credentialUrl: string;
  documentUrl?: string;
  certificateDocument: CertificationDocState[] | string[];
}

interface StepCertificationsProps {
  formData: {
    certifications: Certification[];
  };
  updateFormData: (field: string, value: any) => void;
  errors?: Record<string, string>;
  readOnlyExistingDocs?: boolean;
}

export default function StepCertifications({
  formData,
  updateFormData,
  errors = {},
  readOnlyExistingDocs = false,
}: StepCertificationsProps) {
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  // Ensure certifications is always an array
  const certifications = Array.isArray(formData.certifications)
    ? formData.certifications
    : [];
  console.log("certification", certifications);

  const handleCertificationChange = (
    index: number,
    field: string,
    value: any,
  ) => {
    const newCertifications = [...certifications];
    (newCertifications[index] as any)[field] = value;
    updateFormData("certifications", newCertifications);
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
    updateFormData("certifications", (prev: any[]) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      // Deep clone the specific entry to avoid mutating state directly
      const newCertifications = safePrev.map((item, i) =>
        i === index ? { ...item } : item,
      );
      const currentFiles = [...(newCertifications[index][field] || [])];
      newCertifications[index][field] = [...currentFiles, ...newItems];
      return newCertifications;
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
        updateFormData("certifications", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newCertifications = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newCertifications[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item: any) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              url,
              uploading: false,
            };
            newCertifications[index][field] = latestFiles;
          }
          return newCertifications;
        });

        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        if (error?.message === "Upload cancelled") return;

        const errorMessage = error?.message || "Upload failed";
        toast.error(`Failed to upload "${file.name}": ${errorMessage}`);

        // 5. Update error status using functional update
        updateFormData("certifications", (prev: any[]) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Deep clone the specific entry
          const newCertifications = safePrev.map((item, i) =>
            i === index ? { ...item } : item,
          );
          const latestFiles = [...(newCertifications[index][field] || [])];
          const itemIndex = latestFiles.findIndex(
            (item: any) => item.uploadId === uploadId,
          );

          if (itemIndex > -1) {
            latestFiles[itemIndex] = {
              ...latestFiles[itemIndex],
              error: errorMessage,
              uploading: false,
            };
            newCertifications[index][field] = latestFiles;
          }
          return newCertifications;
        });
      } finally {
        delete abortControllersRef.current[uploadId];
      }
    }
  };

  console.log("certifications the form", ...certifications);
  const addCertification = () => {
    updateFormData("certifications", [
      ...certifications,
      {
        name: "",
        issuingOrganization: "",
        issueDate: "",
        expirationDate: "",
        credentialId: "",
        documentUrl: "",
        credentialUrl: "",
        certificateDocument: [],
      },
    ]);
  };

  const removeCertification = (index: number) => {
    const newCertifications = certifications.filter(
      (_: Certification, i: number) => i !== index,
    );
    updateFormData("certifications", newCertifications);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-k-dark-grey">
          Licenses & Certifications
        </h3>
        <Button
          variant="secondary"
          onClick={addCertification}
          icon={MdAdd}
          className="py-2! px-4! h-10! text-sm cursor-pointer!"
        >
          Add Certificate
        </Button>
      </div>

      {certifications.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdCardMembership className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-k-medium-grey">No certifications added yet.</p>
          <Button
            variant="link"
            onClick={addCertification}
            className="mt-2 cursor-pointer"
          >
            Add your first certification
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {certifications.map((cert, index) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative animate-[slideUp_0.3s_ease-out]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Certificate Name */}
              <div className="md:col-span-2">
                <FormField
                  name={`cert_name_${index}`}
                  label="Certificate Name"
                  value={cert.name}
                  onChange={(e) =>
                    handleCertificationChange(index, "name", e.target.value)
                  }
                  required
                  error={errors[`cert_name_${index}`]}
                />
              </div>

              {/* Issuing Organization */}
              <FormField
                name={`cert_org_${index}`}
                label="Issuing Organization"
                value={cert.issuingOrganization}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "issuingOrganization",
                    e.target.value,
                  )
                }
                placeholder="Optional"
              />

              {/* Credential ID */}
              <FormField
                name={`cert_id_${index}`}
                label="Credential ID"
                value={cert.credentialId}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "credentialId",
                    e.target.value,
                  )
                }
                placeholder="Optional"
              />

              {/* Dates */}
              <FormField
                label="Issue Date"
                type="date"
                name={`cert_issue_${index}`}
                value={cert.issueDate}
                onChange={(e) =>
                  handleCertificationChange(index, "issueDate", e.target.value)
                }
              />

              <FormField
                label="Expiration Date"
                type="date"
                name={`cert_exp_${index}`}
                value={cert.expirationDate}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "expirationDate",
                    e.target.value,
                  )
                }
              />

              {/* Credential URL */}
              <div className="md:col-span-2">
                <FormField
                  name={`cert_url_${index}`}
                  label="Credential URL (Optional)"
                  type="url"
                  value={cert.credentialUrl}
                  onChange={(e) =>
                    handleCertificationChange(
                      index,
                      "credentialUrl",
                      e.target.value,
                    )
                  }
                  placeholder="https://..."
                />
              </div>

              {/* Certificate Document Upload */}
              <div className="md:col-span-2">
                <UniversalFileUpload
                  label="Upload Certificate Image(s)/Document(s)"
                  files={cert.certificateDocument || []}
                  multiple={true}
                  lockExisting={readOnlyExistingDocs}
                  onFileChange={(files) =>
                    handleMultiFileChange(index, "certificateDocument", files)
                  }
                  onRemove={(docIdx) => {
                    const updatedDocs = [
                      ...(cert.certificateDocument || []),
                    ].filter((_, i) => i !== docIdx);
                    handleCertificationChange(
                      index,
                      "certificateDocument",
                      updatedDocs,
                    );
                  }}
                  onCancel={(docIdx) => {
                    const doc = (cert.certificateDocument as any[])[docIdx];
                    if (doc?.uploadId) {
                      const controller =
                        abortControllersRef.current[doc.uploadId];
                      if (controller) {
                        controller.abort();
                        delete abortControllersRef.current[doc.uploadId];
                        toast("Upload cancelled");
                        // Remove the cancelled item from the list
                        const updatedDocs = [
                          ...(cert.certificateDocument || []),
                        ].filter((_, i) => i !== docIdx);
                        handleCertificationChange(
                          index,
                          "certificateDocument",
                          updatedDocs,
                        );
                      }
                    }
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => removeCertification(index)}
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
