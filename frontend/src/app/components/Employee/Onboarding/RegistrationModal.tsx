import React from "react";
import Modal from "../../Core/ui/Modal";
import Button from "../../Core/ui/Button";
import { MdFileUpload, MdEdit } from "react-icons/md";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAutoFill: (data: any) => void;
  onManualStart: () => void;
}

export default function RegistrationModal({
  isOpen,
  onClose,
  onAutoFill,
  onManualStart,
}: RegistrationModalProps) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Mock extraction for now
      console.log("File uploaded for extraction:", file.name);
      // In a real app, we would call an API here
      // For now, just simulate a delay and return empty data or mock data
      setTimeout(() => {
        onAutoFill({
          personalInfo: { fullName: "Extracted Name" },
        });
      }, 1000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome to Onboarding">
      <div className="space-y-6">
        <p className="text-gray-600">
          To speed up your registration, you can upload your CV/Resume to
          auto-fill some information, or start manually.
        </p>

        <div className="grid grid-cols-1 gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors relative cursor-pointer group">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <MdFileUpload className="text-blue-500 text-2xl" />
            </div>
            <h4 className="font-semibold text-gray-800">Auto-fill from CV</h4>
            <p className="text-sm text-gray-500 mt-1">
              Upload PDF or Word document
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={onManualStart}
            className="w-full py-3 flex items-center justify-center gap-2"
          >
            <MdEdit /> Start Manually
          </Button>
        </div>
      </div>
    </Modal>
  );
}
