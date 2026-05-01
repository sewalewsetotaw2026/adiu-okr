import FormInput from "../../../Core/ui/FormInput";
import Button from "../../../Core/ui/Button";
import FileUpload from "../../../Core/ui/FileUpload";
import { MdAdd, MdDelete, MdCardMembership } from "react-icons/md";

interface StepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  errors: any;
}

export default function StepCertifications({
  formData,
  updateFormData,
}: StepProps) {
  const handleCertificationChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const newCerts = formData.certifications.map((cert: any, i: number) =>
      i === index ? { ...cert, [field]: value } : cert
    );
    updateFormData("certifications", newCerts);
  };

  const addCertification = () => {
    updateFormData("certifications", [
      ...formData.certifications,
      {
        name: "",
        issuingOrganization: "",
        issueDate: "",
        expirationDate: "",
        credentialId: "",
        credentialUrl: "",
        certificateDocument: null,
      },
    ]);
  };

  const removeCertification = (index: number) => {
    const newCerts = formData.certifications.filter(
      (_: any, i: number) => i !== index
    );
    updateFormData("certifications", newCerts);
  };

  return (
    <div className="space-y-8 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={addCertification}
          className="text-sm flex items-center"
        >
          <MdAdd className="mr-1" /> Add Certification
        </Button>
      </div>

      {formData.certifications.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <MdCardMembership className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500">No certifications added yet.</p>
          <Button
            variant="subtle"
            onClick={addCertification}
            className="mt-2 text-[#db602c]"
          >
            Add a certification
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {formData.certifications.map((cert: any, index: number) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6 relative animate-[fadeIn_0.3s_ease-out]"
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-medium text-gray-800 flex items-center">
                <MdCardMembership className="mr-2 text-gray-500" />{" "}
                Certification #{index + 1}
              </h4>
              {formData.certifications.length > 0 && (
                <Button
                  variant="subtle"
                  onClick={() => removeCertification(index)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 h-auto"
                >
                  <MdDelete size={18} />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormInput
                label="Certificate Name"
                value={cert.name}
                onChange={(e) =>
                  handleCertificationChange(index, "name", e.target.value)
                }
                required
              />
              <FormInput
                label="Issuing Organization"
                value={cert.issuingOrganization}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "issuingOrganization",
                    e.target.value
                  )
                }
                placeholder="e.g. Google, Microsoft"
              />
              <FormInput
                label="Issue Date"
                type="date"
                value={cert.issueDate}
                onChange={(e) =>
                  handleCertificationChange(index, "issueDate", e.target.value)
                }
              />
              <FormInput
                label="Expiration Date"
                type="date"
                value={cert.expirationDate}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "expirationDate",
                    e.target.value
                  )
                }
              />
              <FormInput
                label="Credential ID"
                value={cert.credentialId}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "credentialId",
                    e.target.value
                  )
                }
              />
              <FormInput
                label="Credential URL"
                value={cert.credentialUrl}
                onChange={(e) =>
                  handleCertificationChange(
                    index,
                    "credentialUrl",
                    e.target.value
                  )
                }
                placeholder="https://..."
              />
            </div>

            <div className="mb-4">
              <FileUpload
                label="Certificate Document"
                file={cert.certificateDocument}
                currentUrl={cert.documentUrl}
                onFileChange={(file) =>
                  handleCertificationChange(index, "certificateDocument", file)
                }
                onRemove={() => {
                  handleCertificationChange(index, "certificateDocument", null);
                  handleCertificationChange(index, "documentUrl", null);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
