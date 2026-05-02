import React, { useEffect, useState } from "react";
import FormField from "../../../../components/common/FormField";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdEdit } from "react-icons/md";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";

export default function PersonalDetails({ initialData, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    gender: "",
    dateOfBirth: "",
    tinNumber: "",
    pensionNumber: "",
    placeOfWork: "Head Office",
  });

  useEffect(() => {
    if (!isEditing && initialData) {
      setFormData((prev) => ({
        ...prev,
        fullName: initialData.fullName || "",
        gender: initialData.gender || "",
        dateOfBirth: initialData.dateOfBirth || "",
        tinNumber: initialData.tinNumber || "",
        pensionNumber: initialData.pensionNumber || "",
        placeOfWork: initialData.placeOfWork || prev.placeOfWork || "Head Office",
      }));
    }
  }, [initialData, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const save = async () => {
      const requiredFullName =
        String(formData.fullName || "").trim() ||
        String(initialData?.fullName || "").trim();
      const requiredGender =
        String(formData.gender || "").trim() ||
        String(initialData?.gender || "").trim();
      const requiredDateOfBirth =
        String(formData.dateOfBirth || "").trim() ||
        String(initialData?.dateOfBirth || "").trim();

      if (!requiredFullName || !requiredGender || !requiredDateOfBirth) {
        toast.error(
          "Profile data is not loaded yet. Please wait and try again."
        );
        return;
      }

      if (
        formData.tinNumber &&
        !/^\d{10}$/.test(formData.tinNumber)
      ) {
        toast.error("TIN Number must be exactly 10 digits");
        return;
      }

      const loadingToast = toast.loading("Saving personal details...");
      try {
        await onboardingService.updatePersonalInfo({
          fullName: requiredFullName,
          gender: requiredGender,
          dateOfBirth: requiredDateOfBirth,
          tinNumber:
            formData.tinNumber || initialData?.tinNumber || "" || undefined,
          pensionNumber:
            formData.pensionNumber ||
            initialData?.pensionNumber ||
            "" ||
            undefined,
          placeOfWork:
            formData.placeOfWork || initialData?.placeOfWork || "" || undefined,
        });
        toast.dismiss(loadingToast);
        toast.success("Personal details updated successfully");
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } catch (error) {
        toast.dismiss(loadingToast);
        const err = error as any;
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update personal details"
        );
      }
    };

    save();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Personal Details</h2>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            icon={MdEdit}
            onClick={() => {
              if (initialData) {
                setFormData((prev) => ({
                  ...prev,
                  fullName: initialData.fullName || "",
                  gender: initialData.gender || "",
                  dateOfBirth: initialData.dateOfBirth || "",
                  tinNumber: initialData.tinNumber || "",
                  pensionNumber: initialData.pensionNumber || "",
                  placeOfWork: initialData.placeOfWork || prev.placeOfWork || "Head Office",
                }));
              }
              setIsEditing(true);
            }}
          >
            Edit Details
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Read-only / Display Fields - Removed redundant header */}

          <FormField
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="Gender"
            name="gender"
            type="select"
            value={formData.gender}
            onChange={handleChange}
            disabled={!isEditing}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
            ]}
          />

          <FormField
            label="Date of Birth (Gregorian)"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="TIN Number"
            name="tinNumber"
            value={formData.tinNumber}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="Pension Number"
            name="pensionNumber"
            value={formData.pensionNumber}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="Place of Work"
            name="placeOfWork"
            type="select"
            value={formData.placeOfWork}
            onChange={handleChange}
            disabled={!isEditing}
            options={[
              { value: "Head Office", label: "Head Office" },
              { value: "Branch", label: "Branch" },
            ]}
          />
        </div>

        {isEditing && (
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsEditing(false);
                if (initialData) {
                  setFormData((prev) => ({
                    ...prev,
                    ...initialData,
                    placeOfWork: initialData.placeOfWork || prev.placeOfWork,
                  }));
                }
              }}
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
