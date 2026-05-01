import React from "react";
import {
  MdPerson,
  MdContactPhone,
  MdSchool,
  MdVerifiedUser,
  MdAttachMoney,
  MdWork,
  MdUploadFile,
  MdTrendingUp
} from "react-icons/md";

const SECTIONS = [
  { id: "personal", label: "Personal Details", icon: MdPerson },
  { id: "contact", label: "Contact Details", icon: MdContactPhone },
  { id: "education", label: "Education", icon: MdSchool },
  { id: "workExperience", label: "Previous work experience", icon: MdWork },
  { id: "certifications", label: "Certifications", icon: MdVerifiedUser },
  { id: "employment", label: "Employment", icon: MdWork },
  { id: "career", label: "Career Path", icon: MdTrendingUp },
  { id: "financial", label: "Financial Details", icon: MdAttachMoney },
  { id: "documents", label: "Documents", icon: MdUploadFile },
];

export default function ProfileSidebar({ activeSection, onSectionChange }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 h-fit overflow-x-auto no-scrollbar">
      <nav className="flex lg:block gap-2 space-y-0 lg:space-y-2 min-w-max lg:min-w-0">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap lg:w-full ${isActive
                  ? "bg-primary text-white shadow-md"
                  : "text-k-dark-grey hover:bg-primary-light hover:text-primary"
                }`}
            >
              <Icon size={20} className={`shrink-0 ${isActive ? "text-white" : "text-k-medium-grey"}`} />
              {section.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
