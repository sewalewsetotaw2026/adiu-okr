import { useEffect, useState } from "react";
import StepCertifications from "../../../../components/employees/wizard/StepCertifications";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdEdit } from "react-icons/md";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";

type CertificationsWrapperProps = {
  initialCertifications?: any[];
  onRefresh?: () => void | Promise<void>;
};

export default function CertificationsWrapper({
  initialCertifications,
  onRefresh,
}: CertificationsWrapperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<{ certifications: any[] }>({
    certifications: [],
  });
  const [errors] = useState<Record<string, any>>({});

  const certificateLinks = (formData.certifications || [])
    .map((cert: any, index: number) => {
      const url =
        typeof cert?.certificateDocument === "string"
          ? cert.certificateDocument
          : cert?.certificateDocument?.url || null;
      if (!url) return null;
      return { index, url };
    })
    .filter(Boolean) as Array<{ index: number; url: string }>;

  useEffect(() => {
    if (!isEditing) {
      setFormData({
        certifications: Array.isArray(initialCertifications)
          ? initialCertifications
          : [],
      });
    }
  }, [initialCertifications, isEditing]);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  console.log("form data of the certificate", formData);
  const handleSubmit = (e: any) => {
    e.preventDefault();

    const newErrors: any = {};
    let hasError = false;

    (formData.certifications || []).forEach((cert: any, index: number) => {
      if (!cert.name) { newErrors[`cert_name_${index}`] = "Certificate Name is required"; hasError = true; }
    });

    if (hasError) {
      // StepCertifications might use 'errors' prop differently (as object of errors), 
      // usually it expects object key matching field name, or we just toast.
      // Given StepCertifications implementation usually takes errors object.
      // But for simplicity and consistency with wrappers, toast is good.
      // We can also pass errors down if StepCertifications supports it.
      // Looking at StepCertifications props in previous read, it takes errors.
      // I will assume it renders them if passed.
      // But I'll toast as well.
      toast.error("Certificate Name is required");
      return;
    }

    const save = async () => {
      const loadingToast = toast.loading("Saving certifications...");
      try {
        await onboardingService.updateCertifications({
          certifications: (formData.certifications || []).map((cert) => {
            let certUrl: string | undefined = undefined;
            if (cert.certificateDocument) {
              if (typeof cert.certificateDocument === "string") {
                certUrl = cert.certificateDocument;
              } else if (
                typeof cert.certificateDocument === "object" &&
                "url" in cert.certificateDocument
              ) {
                certUrl = (cert.certificateDocument as any).url;
              }
            }

            return {
              name: cert.name,
              issuingOrganization: cert.issuingOrganization || undefined,
              issueDate: cert.issueDate || undefined,
              expirationDate: cert.expirationDate || undefined,
              credentialId: cert.credentialId || undefined,
              certificateDocument: certUrl,
            };
          }),
        });
        toast.dismiss(loadingToast);
        toast.success("Certifications updated successfully");
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } catch (error) {
        toast.dismiss(loadingToast);
        const err = error as any;
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update certifications",
        );
      }
    };

    save();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Certifications</h2>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            icon={MdEdit}
            onClick={() => setIsEditing(true)}
          >
            Edit Details
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className={!isEditing ? "pointer-events-none opacity-80" : ""}>
          <StepCertifications
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        </div>

        {!isEditing && certificateLinks.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-k-dark-grey mb-2">
              Certificate Documents
            </p>
            <div className="space-y-1">
              {certificateLinks.map(({ index, url }) => (
                <div key={url} className="text-sm">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-k-orange hover:underline"
                  >
                    View certificate #{index + 1}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex justify-end gap-4 pt-4 border-t mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" icon={MdSave}>
              Save Changes
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
