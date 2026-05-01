import React, { useEffect, useState } from "react";
import StepWorkExperience from "../../../../components/employees/wizard/StepWorkExperience";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdEdit } from "react-icons/md";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";

export default function WorkExperienceWrapper({
  initialWorkExperience,
  onRefresh,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    workExperience: [],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEditing) {
      setFormData((prev) => ({
        ...prev,
        workExperience: Array.isArray(initialWorkExperience)
          ? initialWorkExperience
          : [],
      }));
    }
  }, [initialWorkExperience, isEditing]);

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors: any = {};
    let hasError = false;

    (formData.workExperience || []).forEach((exp: any, index: number) => {
      if (!exp.companyName) { newErrors[`exp_company_${index}`] = "Company Name is required"; hasError = true; }
      if (!exp.startDate) { newErrors[`exp_start_${index}`] = "Start Date is required"; hasError = true; }
    });

    if (hasError) {
      setErrors(newErrors);
      toast.error("Please fix the errors before saving");
      return;
    }

    const save = async () => {
      const loadingToast = toast.loading("Saving work experience...");
      try {
        await onboardingService.updateWorkExperience({
          workExperience: (formData.workExperience || []).map((exp) => ({
            companyName: exp.companyName,
            position: exp.previousJobTitle || exp.jobTitle || undefined,
            level: exp.level || undefined,
            department: exp.department || undefined,
            startDate: exp.startDate,
            endDate: exp.endDate || undefined,
          })),
        });
        toast.dismiss(loadingToast);
        toast.success("Previous Work experience updated successfully");
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } catch (error) {
        toast.dismiss(loadingToast);
        const err = error as any;
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update work experience"
        );
      }
    };

    save();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Previous work experience</h2>
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
          <StepWorkExperience
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
