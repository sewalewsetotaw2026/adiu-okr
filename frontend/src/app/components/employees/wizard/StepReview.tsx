import React from "react";
import { MdEdit, MdInsertDriveFile } from "react-icons/md";

interface ReviewSectionProps {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}

const ReviewSection = ({ title, onEdit, children }: ReviewSectionProps) => (
  <div className="bg-gray-50 rounded-xl p-6 mb-6">
    <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
      <h3 className="text-lg font-bold text-k-dark-grey font-heading">
        {title}
      </h3>
      <button
        onClick={onEdit}
        className="text-primary hover:text-primary-dark flex items-center gap-1 text-sm font-medium transition-colors"
      >
        <MdEdit size={16} /> Edit
      </button>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

interface ReviewItemProps {
  label: string;
  value: string | null | undefined;
}

const ReviewItem = ({ label, value }: ReviewItemProps) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    <span className="text-sm font-medium text-k-medium-grey">{label}</span>
    <span className="text-sm text-k-dark-grey sm:col-span-2 font-medium wrap-break-words">
      {value || "-"}
    </span>
  </div>
);

// Replaced by direct usage of FileUpload or custom iteration
// But StepReview uses FileList for list of files.
// I'll keep FileList but update it to use FileUpload style or just loop FileUpload.
// Let's loop FileUpload for consistency as requested "all of the should use that component".
import UniversalFileUpload from "../../Core/ui/UniversalFileUpload";

interface FileListProps {
  files: any;
  label: string;
}

const FileList = ({ files, label }: FileListProps) => {
  if (!files) return <ReviewItem label={label} value="Not uploaded" />;

  const fileArray = (Array.isArray(files) ? files : [files]).filter(Boolean);

  if (fileArray.length === 0)
    return <ReviewItem label={label} value="Not uploaded" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <span className="text-sm font-medium text-k-medium-grey">{label}</span>
      <div className="sm:col-span-2 space-y-2">
        <UniversalFileUpload
          files={fileArray}
          readOnly={true}
          onFileChange={() => { }}
          onRemove={() => { }}
        />
      </div>
    </div>
  );
};

interface StepReviewProps {
  formData: any;
  onEditStep: (step: number) => void;
}

export default function StepReview({ formData, onEditStep }: StepReviewProps) {
  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800">
          Please review all information carefully before submitting. You can
          edit any section by clicking the Edit button.
        </p>
      </div>

      {/* Personal Info */}
      <ReviewSection title="Personal Information" onEdit={() => onEditStep(1)}>
        <ReviewItem label="Full Name" value={formData.fullName} />
        <ReviewItem label="Gender" value={formData.gender} />
        <ReviewItem label="Date of Birth" value={formData.dateOfBirth} />
        <ReviewItem label="TIN Number" value={formData.tinNumber} />
        <ReviewItem label="Pension Number" value={formData.pensionNumber} />
        <ReviewItem label="Place of Work" value={formData.placeOfWork} />
      </ReviewSection>

      {/* Contact Info */}
      <ReviewSection title="Contact Information" onEdit={() => onEditStep(2)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Address and Phones */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-k-dark-grey mb-3 border-b pb-1">
                Address Information
              </p>
              <div className="space-y-2">
                <ReviewItem label="Region" value={formData.region} />
                <ReviewItem label="City" value={formData.city} />
                <ReviewItem label="Sub City" value={formData.subCity} />
                <ReviewItem label="Woreda" value={formData.woreda} />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-sm font-bold text-k-dark-grey mb-3 border-b pb-1">
                Phone Numbers
              </p>
              {formData.phones.map((phone: any, index: number) => (
                <div
                  key={index}
                  className="bg-white p-2 rounded border border-gray-200 mb-2 text-sm"
                >
                  <span className="font-medium text-k-dark-grey">
                    {phone.number}
                  </span>
                  <span className="text-gray-500 ml-2">({phone.type})</span>
                  {phone.isPrimary && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Emergency Contacts */}
          <div>
            <p className="text-sm font-bold text-k-dark-grey mb-3 border-b pb-1">
              Emergency Contacts
            </p>
            {formData.emergencyContacts &&
              formData.emergencyContacts.length > 0 ? (
              <div className="space-y-3">
                {formData.emergencyContacts.map(
                  (contact: any, index: number) => (
                    <div
                      key={index}
                      className="bg-white p-3 rounded border border-gray-200 text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-k-dark-grey">
                          {contact.fullName}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {contact.relationship}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1 flex items-center gap-2">
                        <span>{contact.phoneNumber}</span>
                        {contact.email && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="truncate">{contact.email}</span>
                          </>
                        )}
                      </div>
                      {contact.isPrimary && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase tracking-wider bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 font-bold">
                            Primary
                          </span>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No emergency contacts listed
              </p>
            )}
          </div>
        </div>
      </ReviewSection>

      {/* Financial Details */}
      <ReviewSection title="Financial Details" onEdit={() => onEditStep(3)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formData.financialDetails && formData.financialDetails.length > 0 ? (
            formData.financialDetails.map((detail: any, index: number) => (
              <div
                key={index}
                className="bg-white p-4 rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                      <span className="text-sm font-bold">🏦</span>
                    </div>
                    <p className="font-bold text-k-dark-grey leading-tight">
                      {detail.bankName || "Unknown Bank"}
                    </p>
                  </div>
                  {detail.isPrimary && (
                    <span className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 font-bold">
                      Primary
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                      Account Number
                    </p>
                    <p className="font-mono text-sm text-k-dark-grey font-medium">
                      {detail.accountNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                      Account Holder
                    </p>
                    <p className="text-sm text-k-dark-grey font-medium">
                      {detail.accountHolderName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {detail.iban && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                          IBAN
                        </p>
                        <p className="font-mono text-[11px] text-k-dark-grey truncate">
                          {detail.iban}
                        </p>
                      </div>
                    )}
                    {detail.swiftCode && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                          SWIFT
                        </p>
                        <p className="font-mono text-[11px] text-k-dark-grey">
                          {detail.swiftCode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">
              No financial details provided
            </p>
          )}
        </div>
      </ReviewSection>

      {/* Education */}
      <ReviewSection title="Education" onEdit={() => onEditStep(4)}>
        {formData.education.length > 0 ? (
          formData.education.map((edu: any, index: number) => (
            <div
              key={index}
              className="bg-white p-4 rounded-xl border border-gray-200 mb-4 last:mb-0 shadow-sm"
            >
              <p className="font-bold text-lg text-k-dark-grey">
                {edu.institution}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <p className="text-sm text-primary font-semibold">
                  {edu.level} - {edu.fieldOfStudy}
                </p>
                <p className="text-xs text-gray-400 sm:text-right italic uppercase">
                  {edu.programType}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1 pb-3 border-b border-gray-50">
                {edu.startDate} - {edu.endDate || "Present"}
              </p>

              {edu.hasCostSharing && (
                <div className="mt-3 bg-primary-light/50 p-3 rounded-lg border border-primary-light text-xs text-k-dark-grey space-y-2">
                  <p className="font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
                    <MdInsertDriveFile /> Cost Sharing Agreement
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <p>
                      <span className="text-gray-500 font-medium">
                        Total Cost:
                      </span>{" "}
                      {edu.costSharing?.declaredTotalCost}{" "}
                      {edu.costSharing?.currency}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">
                        Doc Number:
                      </span>{" "}
                      {edu.costSharing?.documentNumber || "-"}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">
                        Payment Status:
                      </span>{" "}
                      {edu.costSharing?.paymentStatus || ""}
                    </p>

                    <p>
                      <span className="text-gray-500 font-medium">
                        Issue Date:
                      </span>{" "}
                      {edu.costSharing?.issueDate || "-"}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">
                        Commitment:
                      </span>{" "}
                      {edu.costSharing?.commitmentType || "-"}
                    </p>
                  </div>
                  {edu.costSharing?.remarks && (
                    <p>
                      <span className="text-gray-500 font-medium">
                        Remarks:
                      </span>{" "}
                      <span className="italic">
                        "{edu.costSharing?.remarks}"
                      </span>
                    </p>
                  )}
                  <div className="pt-2">
                    <UniversalFileUpload
                      files={
                        Array.isArray(edu.costSharingDocument)
                          ? edu.costSharingDocument
                          : edu.costSharingDocument
                            ? [edu.costSharingDocument]
                            : []
                      }
                      readOnly={true}
                      onFileChange={() => { }}
                      onRemove={() => { }}
                    />
                  </div>
                </div>
              )}

              {edu.document_urls && edu.document_urls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Educational Documents
                  </p>
                  <UniversalFileUpload
                    files={edu.document_urls}
                    readOnly={true}
                    onFileChange={() => { }}
                    onRemove={() => { }}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">
            No education history added
          </p>
        )}
      </ReviewSection>

      {/* Work Experience */}
      <ReviewSection
        title="Previous work experience"
        onEdit={() => onEditStep(5)}
      >
        {formData.workExperience.length > 0 ? (
          formData.workExperience.map((exp: any, index: number) => (
            <div
              key={index}
              className="bg-white p-4 rounded-xl border border-gray-200 mb-4 last:mb-0 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <p className="font-bold text-lg text-k-dark-grey">
                  {exp.companyName}
                </p>
                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold uppercase text-gray-500">
                  {exp.employmentType}
                </span>
              </div>
              <p className="text-sm text-primary font-semibold">
                {exp.jobTitle}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                <p>
                  <span className="text-gray-400 font-medium">Department:</span>{" "}
                  {exp.department || "-"}
                </p>
                <p>
                  <span className="text-gray-400 font-medium">Level:</span>{" "}
                  {exp.level || "-"}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2 pb-3 border-b border-gray-50">
                {exp.startDate} -{" "}
                {exp.isCurrent ? "Present" : exp.endDate || "?"}
              </p>

              {exp.document_urls && exp.document_urls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Experience Evidences
                  </p>
                  <UniversalFileUpload
                    files={exp.document_urls}
                    readOnly={true}
                    onFileChange={() => { }}
                    onRemove={() => { }}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">
            No previous work experience added
          </p>
        )}
      </ReviewSection>

      {/* Certifications */}
      <ReviewSection title="Certifications" onEdit={() => onEditStep(6)}>
        {formData.certifications.length > 0 ? (
          formData.certifications.map((cert: any, index: number) => (
            <div
              key={index}
              className="bg-white p-4 rounded-xl border border-gray-200 mb-4 last:mb-0 shadow-sm"
            >
              <p className="font-bold text-lg text-k-dark-grey">{cert.name}</p>
              <p className="text-sm text-primary font-semibold">
                {cert.issuingOrganization}
              </p>
              <p className="text-xs text-gray-500 mt-1 pb-3 border-b border-gray-50">
                Issued: {cert.issueDate}{" "}
                {cert.expirationDate && `• Expires: ${cert.expirationDate}`}
              </p>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {(cert.credentialId || cert.credentialUrl) && (
                  <div className="text-xs text-gray-600 space-y-1">
                    {cert.credentialId && (
                      <p>
                        <span className="text-gray-400 font-medium uppercase tracking-tighter mr-1">
                          ID:
                        </span>{" "}
                        <span className="font-mono">{cert.credentialId}</span>
                      </p>
                    )}
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        Verify Credential Link
                      </a>
                    )}
                  </div>
                )}

                {cert.certificateDocument && (
                  <div className="mt-2">
                    <UniversalFileUpload
                      files={
                        Array.isArray(cert.certificateDocument)
                          ? cert.certificateDocument
                          : cert.certificateDocument
                            ? [cert.certificateDocument]
                            : []
                      }
                      readOnly={true}
                      onFileChange={() => { }}
                      onRemove={() => { }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">
            No certifications added
          </p>
        )}
      </ReviewSection>

      {/* Documents */}
      <ReviewSection title="Documents" onEdit={() => onEditStep(7)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          <FileList label="CV / Resume" files={formData.documents.cv} />
          <FileList
            label="National ID / Passport"
            files={formData.documents.nationalId}
          />
          <FileList
            label="Guarantee Letter"
            files={formData.documents.guaranteeLetter}
          />
          <FileList
            label="Medical Certificate"
            files={formData.documents.medicalCertificate}
          />
          <FileList
            label="Police / Forensic Certificate"
            files={formData.documents.policeCertificate}
          />
        </div>
      </ReviewSection>

      {/* Signature */}
      <ReviewSection title="Signature" onEdit={() => onEditStep(8)}>
        {formData.signature ? (
          <div className="border border-gray-300 rounded-lg p-2 bg-white inline-block">
            <img
              src={formData.signature}
              alt="Signature"
              className="max-h-24 mix-blend-multiply"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No signature provided</p>
        )}
      </ReviewSection>
    </div>
  );
}
