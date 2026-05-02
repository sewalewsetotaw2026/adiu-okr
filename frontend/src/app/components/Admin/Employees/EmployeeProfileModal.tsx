import Modal from "../../common/Modal";
import StepReview from "../../employees/wizard/StepReview";
import Button from "../../Core/ui/Button";
import { FiCheck, FiX } from "react-icons/fi";

interface EmployeeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any; // We'll map this to the expected format
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function EmployeeProfileModal({
  isOpen,
  onClose,
  employee,
  onApprove,
  onReject,
}: EmployeeProfileModalProps) {
  if (!employee) return null;

  // Map employee data to StepReview format
  // We fill in missing data with placeholders since the list view only has summary data
  const formData = {
    fullName: employee.full_name || "",
    gender: employee.gender || "",
    dateOfBirth: employee.date_of_birth || "1990-01-01", // Placeholder
    tinNumber: employee.tin_number || "",
    pensionNumber: employee.pension_number || "N/A",
    placeOfWork: employee.place_of_work || "",
    region: "Addis Ababa", // Placeholder
    city: "Addis Ababa", // Placeholder
    subCity: "Bole", // Placeholder
    woreda: "03", // Placeholder
    phones: [
      {
        number: employee.phone_number || "0911234567",
        type: "Mobile",
        isPrimary: true,
      },
    ],
    education: [
      {
        level: "Bachelor's Degree",
        fieldOfStudy: "Computer Science",
        institution: "Addis Ababa University",
        programType: "Regular",
        hasCostSharing: false,
      },
    ],
    workExperience: [],
    certifications: [],
    documents: {
      cv: [],
      certificates: [],
      experienceLetters: [],
      photo: [],
      taxForms: [],
      pensionForms: [],
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Profile Review"
      size="xl"
    >
      <div className="max-h-[70vh] overflow-y-auto px-2">
        <StepReview
          formData={formData}
          onEditStep={() => {}} // Disable edit navigation for now
        />
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
        <Button
          variant="outline"
          className="text-red-600! border-red-600! hover:bg-red-50!"
          onClick={() => onReject(employee.id)}
          icon={FiX}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          onClick={() => onApprove(employee.id)}
          icon={FiCheck}
        >
          Approve
        </Button>
      </div>
    </Modal>
  );
}
