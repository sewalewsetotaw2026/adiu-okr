import React, { useEffect, useState } from "react";
import StepEducation from "../../../../components/employees/wizard/StepEducation";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdEdit } from "react-icons/md";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";

export default function EducationWrapper({ initialEducation, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    education: [],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEditing) {
      setFormData((prev) => ({
        ...prev,
        education: Array.isArray(initialEducation) ? initialEducation : [],
      }));
    }
  }, [initialEducation, isEditing]);

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = {};
    let hasError = false;

    (formData.education || []).forEach((edu, index) => {
      if (!edu.level) { newErrors[`edu_level_${index}`] = "Level is required"; hasError = true; }
      if (!edu.fieldOfStudy) { newErrors[`edu_field_${index}`] = "Field of Study is required"; hasError = true; }
      if (!edu.institution) { newErrors[`edu_inst_${index}`] = "Institution is required"; hasError = true; }
      if (!edu.programType) { newErrors[`edu_prog_${index}`] = "Program Type is required"; hasError = true; }

      if (edu.hasCostSharing) {
        const hasDoc = (
          (edu.costSharingDocumentUrl) ||
          (edu.costSharingDocument && (Array.isArray(edu.costSharingDocument) ? edu.costSharingDocument.length > 0 : !!edu.costSharingDocument))
        );
        if (!hasDoc && !edu.costSharingDetails && !edu.costSharing?.remarks) {
          if (!hasDoc && !edu.costSharingDetails) {
            newErrors[`edu_cost_doc_details_${index}`] = "Cost Sharing Document or Details is required";
            hasError = true;
          }
        }
      }

      const hasDocs = (edu.document_urls && edu.document_urls.length > 0) || edu.documentUrl;
      if (!hasDocs) {
        newErrors[`edu_doc_${index}`] = "Education Document (Degree/Certificate) is required";
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      toast.error("Please fix the errors before saving");
      return;
    }

    const save = async () => {
      const loadingToast = toast.loading("Saving education details...");
      try {
        await onboardingService.updateEducation({
          education: (formData.education || []).map((edu) => {
            let costSharingUrl: string | null = null;
            // ... (keep existing mapping)
            if (edu.costSharingDocument) {
              if (typeof edu.costSharingDocument === "string") {
                costSharingUrl = edu.costSharingDocument;
              } else if (
                typeof edu.costSharingDocument === "object" &&
                "url" in edu.costSharingDocument
              ) {
                costSharingUrl = (edu.costSharingDocument as any).url || null;
              }
            }

            return {
              level: edu.level,
              fieldOfStudy: edu.fieldOfStudy,
              institution: edu.institution,
              programType: edu.programType,
              hasCostSharing: edu.hasCostSharing || false,
              costSharingDocument: costSharingUrl || undefined,
              startDate: edu.startDate || undefined,
              endDate: edu.endDate || undefined,
              isCurrent: edu.isCurrent || false,
            };
          }),
        });
        toast.dismiss(loadingToast);
        toast.success("Education details updated successfully");
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } catch (error) {
        toast.dismiss(loadingToast);
        const err = error as any;
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update education"
        );
      }
    };

    save();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">
          Educational Qualifications
        </h2>
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
          <StepEducation
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        </div>

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
