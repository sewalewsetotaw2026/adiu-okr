import React from "react";
import Button from "../../../Core/ui/Button";
import { MdEdit } from "react-icons/md";

interface StepProps {
  formData: any;
  onEditStep: (step: number) => void;
}

export default function StepReview({ formData, onEditStep }: StepProps) {
  const Section = ({
    title,
    step,
    children,
  }: {
    title: string;
    step: number;
    children: React.ReactNode;
  }) => (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <Button
          variant="subtle"
          onClick={() => onEditStep(step)}
          className="text-primary text-sm flex items-center"
        >
          <MdEdit className="mr-1" /> Edit
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-gray-500 font-medium">{label}:</span>
      <span className="col-span-2 text-gray-800">{value || "-"}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      <Section title="Personal Information" step={1}>
        <Field label="Full Name" value={formData.fullName} />
        <Field label="Gender" value={formData.gender} />
        <Field label="Date of Birth" value={formData.dateOfBirth} />
        <Field label="TIN Number" value={formData.tinNumber} />
        <Field label="Pension Number" value={formData.pensionNumber} />
        <Field label="Place of Work" value={formData.placeOfWork} />
      </Section>

      <Section title="Contact Information" step={2}>
        <Field label="Region" value={formData.region} />
        <Field label="City" value={formData.city} />
        <Field label="Sub City" value={formData.subCity} />
        <Field label="Woreda" value={formData.woreda} />
        <div className="mt-2">
          <p className="font-medium text-gray-500 mb-1">Phone Numbers:</p>
          {formData.phones.map((p: any, i: number) => (
            <p key={i} className="text-gray-800 ml-4">
              {p.number} ({p.type}){" "}
              {p.isPrimary && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full ml-2">
                  Primary
                </span>
              )}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Education" step={3}>
        {formData.education.length === 0 ? (
          <p className="text-gray-500 italic">No education history added.</p>
        ) : (
          formData.education.map((edu: any, i: number) => (
            <div
              key={i}
              className="mb-4 last:mb-0 border-b border-gray-100 last:border-0 pb-2 last:pb-0"
            >
              <p className="font-semibold text-gray-800">
                {edu.institution}{" "}
                <span className="text-xs font-normal text-gray-400 capitalize">
                  ({edu.institutionCategory})
                </span>
              </p>
              <p className="text-sm text-gray-600">
                {edu.level} in {edu.fieldOfStudy}
              </p>
              <div className="flex justify-between items-end">
                <p className="text-xs text-gray-500">{edu.programType}</p>
                {edu.hasCostSharing && (
                  <div className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">
                    Cost Sharing: {edu.costSharingTotalCost} ETB
                  </div>
                )}
              </div>
              {edu.hasCostSharing && (
                <div className="mt-1 text-xs text-gray-500 bg-gray-100 p-2 rounded-lg">
                  <p>Doc #: {edu.costSharingDocumentNumber}</p>
                  <p>
                    Issued by: {edu.costSharingIssuingInstitution} (
                    {edu.costSharingIssueDate})
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="Previous Work Experience" step={4}>
        {formData.workExperience.length === 0 ? (
          <p className="text-gray-500 italic">No previous work experience added.</p>
        ) : (
          formData.workExperience.map((exp: any, i: number) => (
            <div
              key={i}
              className="mb-4 last:mb-0 border-b border-gray-100 last:border-0 pb-2 last:pb-0"
            >
              <p className="font-semibold text-gray-800">{exp.companyName}</p>
              <p className="text-sm text-gray-600">
                {exp.jobTitle || "Position N/A"}
              </p>
              <p className="text-xs text-gray-500">
                {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate}
              </p>
            </div>
          ))
        )}
      </Section>

      <Section title="Certifications" step={5}>
        {formData.certifications.length === 0 ? (
          <p className="text-gray-500 italic">No certifications added.</p>
        ) : (
          formData.certifications.map((cert: any, i: number) => (
            <div
              key={i}
              className="mb-4 last:mb-0 border-b border-gray-100 last:border-0 pb-2 last:pb-0"
            >
              <p className="font-semibold text-gray-800">{cert.name}</p>
              <p className="text-sm text-gray-600">
                {cert.issuingOrganization} | Issued: {cert.issueDate}
              </p>
              {cert.expirationDate && (
                <p className="text-xs text-gray-500">
                  Expires: {cert.expirationDate}
                </p>
              )}
              {cert.credentialId && (
                <p className="text-xs text-gray-500">ID: {cert.credentialId}</p>
              )}
              {cert.credentialUrl && (
                <a
                  href={cert.credentialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  View Credential
                </a>
              )}
              {cert.certificateDocument && (
                <p className="text-xs text-green-600 mt-1">Document attached</p>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="Documents" step={6}>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(formData.documents).map(
            ([key, files]: [string, any]) => (
              <div key={key}>
                <p className="text-sm font-medium text-gray-500 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="text-sm text-gray-800">
                  {files && files.length > 0
                    ? `${files.length} file(s) attached`
                    : "No files"}
                </p>
              </div>
            )
          )}
        </div>
      </Section>
    </div>
  );
}
