import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import Button from "../../../components/Core/ui/Button";
import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiAward,
  FiBookOpen,
  FiFile,
  FiDownload,
  FiExternalLink,
  FiBriefcase,
  FiDollarSign,
  FiFileText,
  FiTrendingUp,
  FiEdit2,
  FiUser,
  FiShield,
} from "react-icons/fi";
import {
  MdPerson,
  MdContactPhone,
  MdSchool,
  MdWork,
  MdVerifiedUser,
  MdUploadFile,
} from "react-icons/md";
import Card from "../../../components/Core/ui/Card";
import InfoGrid from "../../../components/Core/ui/InfoGrid";
import Info from "../../../components/Core/ui/Info";
import Badge from "../../../components/Core/ui/Badge";
import StepPersonalInfo from "../../../components/employees/wizard/StepPersonalInfo";
import StepContactInfo from "../../../components/employees/wizard/StepContactInfo";
import { useEmployeeDetailSlice } from "../../Admin/EmployeeDetail/slice";
import {
  selectEmployee,
  selectEmployeeLoading,
  selectUpdateSuccess,
} from "../../Admin/EmployeeDetail/slice/selectors";
import CareerTimeline from "../../../components/Employee/CareerTimeline";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import adminService from "../../../services/adminService";
import ToastService from "../../../../utils/ToastService";
import { authActions } from "../../../slice/authSlice";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import AccountSecurity from "../../../components/common/AccountSecurity";

import ProfilePictureUpload from "../../../components/Employee/ProfilePictureUpload";
import { formatDate as formatDayjsDate } from "../../../utils/dayjs-format";

type SectionId =
  | "personal"
  | "contact"
  | "financial"
  | "education"
  | "workExperience"
  | "employment"
  | "career"
  | "compensation"
  | "certifications"
  | "documents"
  | "security";

const SECTIONS = [
  { id: "personal" as SectionId, label: "Personal Info", icon: MdPerson },
  {
    id: "contact" as SectionId,
    label: "Contact Details",
    icon: MdContactPhone,
  },
  {
    id: "financial" as SectionId,
    label: "Financial Details",
    icon: FiDollarSign,
  },
  { id: "education" as SectionId, label: "Education", icon: MdSchool },
  {
    id: "workExperience" as SectionId,
    label: "Previous work experience",
    icon: MdWork,
  },
  { id: "employment" as SectionId, label: "Employment", icon: FiBriefcase },
  { id: "career" as SectionId, label: "Career Path", icon: FiTrendingUp },
  {
    id: "compensation" as SectionId,
    label: "Compensation",
    icon: FiDollarSign,
  },
  {
    id: "certifications" as SectionId,
    label: "Certifications",
    icon: MdVerifiedUser,
  },
  { id: "documents" as SectionId, label: "Documents", icon: MdUploadFile },
  { id: "security" as SectionId, label: "Account Security", icon: FiShield },
];

export default function Profile() {
  const dispatch = useDispatch();
  const [activeSection, setActiveSection] = useState<SectionId>("personal");
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);

  const { actions } = useEmployeeDetailSlice();
  const employee = useSelector(selectEmployee);
  const loading = useSelector(selectEmployeeLoading);
  const updateSuccess = useSelector(selectUpdateSuccess);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const authUser = useSelector((state: any) => state.auth.user);

  useEffect(() => {
    if (updateSuccess && isEditing) {
      setIsEditing(false);
      ToastService.success("Profile updated successfully");
      // Refetch data is handled by the saga implicitly by dispatching fetchEmployeeRequest,
      // but since we are on Profile page, we should maybe refetch here or rely on the fact that
      // the saga will update the global state?
      // Actually, this Profile page uses local state 'employee'.
      // I should update local state when updateSuccess is true.
    }
  }, [updateSuccess]);

  const handleWizardChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateFormSectionData = (section: string, data: any) => {
    setFormData((prev: any) => ({ ...prev, [section]: data }));
  };

  const handleEdit = (section: SectionId) => {
    // Initialize formData with current employee data
    const initialData: any = { ...employee };

    // Map existing data to what the Wizard steps expect
    if (section === "contact") {
      initialData.region = employee.addresses?.[0]?.region || "";
      initialData.city = employee.addresses?.[0]?.city || "";
      initialData.subCity = employee.addresses?.[0]?.sub_city || "";
      initialData.woreda = employee.addresses?.[0]?.woreda || "";

      initialData.phones =
        employee.phones?.map((p: any) => ({
          number: p.phone_number,
          type: p.phone_type || "Private",
          isPrimary: p.is_primary,
        })) || [];

      initialData.emergencyContacts =
        employee.emergencyContacts?.map((ec: any) => ({
          fullName: ec.full_name,
          relationship: ec.relationship,
          phoneNumber: ec.phone_number,
          email: ec.email,
          isPrimary: ec.is_primary,
        })) || [];
    }

    setFormData(initialData);
    setIsEditing(true);
    setActiveSection(section);
  };

  const handleSave = () => {
    if (!employee?.id) return;

    console.log("Saving profile changes", activeSection, formData);

    // Prepare payload for the saga
    const payload: any = {
      id: employee.id,
      section: activeSection,
      ...formData,
    };

    // Special mapping for contact section to match what saga expects
    if (activeSection === "contact") {
      payload.address = [
        {
          region: formData.region,
          city: formData.city,
          sub_city: formData.subCity,
          woreda: formData.woreda,
          address_type: "Primary",
        },
      ];
      // phones and emergencyContacts are already in formData from handleWizardChange/updateFormSectionData
    }

    dispatch(actions.updateEmployeeRequest(payload));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch allowance types
        const types = await adminService.getAllowanceTypes();
        setAllowanceTypes(types);

        // Fetch employee details using Redux
        const employeeId = authUser?.employee?.id || authUser?.id;
        if (employeeId) {
          dispatch(actions.fetchEmployeeRequest(employeeId));
        }
      } catch (err) {
        console.error("Failed to fetch profile supplemental data", err);
      }
    };

    fetchData();
  }, [authUser, dispatch]);

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return formatDayjsDate(date, "N/A");
  };

  const getGenderLabel = (gender: string | null) => {
    if (!gender) return "Not specified";
    return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  };

  const renderSection = () => {
    if (!employee) return null;

    switch (activeSection) {
      case "personal":
        return (
          <PersonalSection
            employee={employee}
            formatDate={formatDate}
            getGenderLabel={getGenderLabel}
            isEditing={isEditing}
            formData={formData}
            onWizardChange={handleWizardChange}
            onEdit={() => handleEdit("personal")}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            loading={loading}
          />
        );
      case "contact":
        return (
          <ContactSection
            employee={employee}
            email={employee.email || authUser?.email}
            isEditing={isEditing}
            formData={formData}
            onWizardChange={handleWizardChange}
            onUpdateFormData={updateFormSectionData}
            onEdit={() => handleEdit("contact")}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            loading={loading}
          />
        );
      case "financial":
        return (
          <FinancialDetailsSection
            financialDetails={employee.financialDetails}
          />
        );
      case "education":
        return (
          <EducationSection
            educations={employee?.educations}
            formatDate={formatDate}
          />
        );
      case "workExperience":
        return (
          <WorkExperienceSection
            histories={employee?.employmentHistories}
            formatDate={formatDate}
          />
        );
      case "employment":
        return <EmploymentSection employee={employee} />;
      case "career":
        return <CareerSection events={employee?.careerEvents} />;
      case "compensation":
        return (
          <CompensationSection
            employee={employee}
            allowanceTypes={allowanceTypes}
          />
        );
      case "certifications":
        return (
          <CertificationsSection
            certifications={employee?.licensesAndCertifications}
          />
        );
      case "documents":
        return <DocumentsSection documents={employee?.documents} />;
      case "security":
        return <AccountSecurity />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="p-6">
          <LoadingSkeleton count={3} />
        </div>
      </EmployeeLayout>
    );
  }

  if (!employee) {
    return (
      <EmployeeLayout>
        <div className="p-6 text-center py-12">
          <p className="text-gray-500">Could not load profile details.</p>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-2">
            View and manage your personal and employment information.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 sticky top-24">
              {/* Profile Picture Header */}
              <div className="flex flex-col items-center p-4 border-b border-gray-100 mb-2">
                <ProfilePictureUpload
                  employeeId={employee?.id}
                  currentUrl={
                    employee?.profile_picture || employee?.profile_picture_url
                  }
                  onUpdate={(url) => {
                    dispatch(
                      actions.updateEmployeeSuccess({ profile_picture: url }),
                    );
                    dispatch(authActions.getMeRequest());
                  }}
                />
                <h3 className="mt-3 font-semibold text-lg text-center">
                  {employee?.full_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {employee?.job_title || "Employee"}
                </p>
              </div>

              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${activeSection === section.id
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="font-medium whitespace-nowrap">
                    {section.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">{renderSection()}</div>
        </div>
      </div>
    </EmployeeLayout>
  );
}

// Section Components (Read-only versions)

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="font-medium text-k-dark-grey">{value || "N/A"}</p>
    </div>
  );
}

function PersonalSection({
  employee,
  formatDate,
  getGenderLabel,
  isEditing,
  formData,
  onWizardChange,
  onEdit,
  onSave,
  onCancel,
  loading,
}: any) {
  const editAction = (
    <Button variant="outline" onClick={onEdit} icon={FiEdit2}>
      Edit
    </Button>
  );

  if (isEditing) {
    return (
      <Card title="Edit Personal Information" icon={<FiUser />}>
        <div className="py-4">
          <StepPersonalInfo formData={formData} handleChange={onWizardChange} />
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Personal Information" icon={<FiUser />} action={editAction}>
      <InfoGrid>
        <Info label="Full Name" value={employee?.full_name} />
        <Info label="Gender" value={getGenderLabel(employee?.gender)} />
        <Info
          label="Date of Birth (Gregorian)"
          value={formatDate(employee?.date_of_birth)}
        />
        <Info label="TIN Number" value={employee?.tin_number} />
        <Info label="Pension Number" value={employee?.pension_number} />
        <Info label="Place of Work" value={employee?.place_of_work} />
      </InfoGrid>
    </Card>
  );
}

function ContactSection({
  employee,
  email,
  isEditing,
  formData,
  onWizardChange,
  onUpdateFormData,
  onEdit,
  onSave,
  onCancel,
  loading,
}: any) {
  const editAction = (
    <Button variant="outline" onClick={onEdit} icon={FiEdit2}>
      Edit
    </Button>
  );

  if (isEditing) {
    return (
      <Card title="Edit Contact Details" icon={<MdContactPhone />}>
        <div className="py-4">
          <StepContactInfo
            formData={formData}
            handleChange={onWizardChange}
            updateFormData={onUpdateFormData}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      <Card title="Contact Information" icon={<FiMail />} action={editAction}>
        <InfoGrid>
          <Info label="Email Address" value={email} />
          {employee.phones?.map((phone: any, idx: number) => (
            <Info
              key={idx}
              label={`${phone.phone_type || "Phone"} ${phone.is_primary ? "(Primary)" : ""}`}
              value={phone.phone_number}
            />
          ))}
        </InfoGrid>
      </Card>

      <Card title="Address Details" icon={<FiMapPin />}>
        {employee.addresses?.[0] ? (
          <InfoGrid>
            <Info label="Region" value={employee.addresses[0].region} />
            <Info label="City" value={employee.addresses[0].city} />
            <Info label="Sub City" value={employee.addresses[0].sub_city} />
            <Info label="Woreda" value={employee.addresses[0].woreda} />
          </InfoGrid>
        ) : (
          <p className="text-gray-500 italic p-4 text-center">
            No address details found.
          </p>
        )}
      </Card>

      <Card title="Emergency Contacts" icon={<FiUser />}>
        {employee.emergencyContacts?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employee.emergencyContacts.map((contact: any, idx: number) => (
              <div
                key={idx}
                className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <FiUser className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="font-bold text-gray-900 leading-tight">
                      {contact.full_name || contact.name}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {contact.relationship}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-50 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FiPhone className="w-4 h-4 text-gray-400" />
                      <span>{contact.phone_number}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FiMail className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">No emergency contacts.</p>
        )}
      </Card>
    </div>
  );
}

function FinancialDetailsSection({ financialDetails }: any) {
  return (
    <Card title="Financial Details" icon={<FiDollarSign />}>
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
            <FiDollarSign className="text-green-600" /> Bank Accounts
          </h3>
          {financialDetails?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {financialDetails.map((fd: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-200 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                        <span className="text-xl font-bold">🏦</span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                          {fd.bankName || fd.bank?.name || "Unknown Bank"}
                        </p>
                        {fd.is_primary && (
                          <Badge variant="success">Primary Account</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-100 text-gray-400">
                        <span className="text-lg">#</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Account Number
                        </p>
                        <p className="font-mono font-medium text-gray-900 tracking-wide">
                          {fd.account_number}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-100 text-gray-400">
                        <FiUser />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Account Holder
                        </p>
                        <p className="font-medium text-gray-900">
                          {fd.account_holder_name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No bank accounts linked.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function EducationSection({ educations, formatDate }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-xl font-bold text-k-dark-grey mb-6 border-b pb-4">
        Education
      </h2>
      <div className="space-y-4">
        {educations?.length > 0 ? (
          educations.map((edu: any, index: number) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-xl border-l-4 border-primary"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <FiBookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-k-dark-grey">
                    {edu.institution_name}
                  </p>
                  <p className="text-sm text-gray-600">{edu.field_of_study}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Level: {edu.education_level || "N/A"} •{" "}
                    {formatDate(edu.start_date)} -{" "}
                    {edu.is_current ? "Present" : formatDate(edu.end_date)}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">
            No education records found.
          </p>
        )}
      </div>
    </div>
  );
}

function WorkExperienceSection({ histories, formatDate }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-xl font-bold text-k-dark-grey mb-6 border-b pb-4">
        Previous work experience
      </h2>
      <div className="space-y-4">
        {histories?.length > 0 ? (
          histories.map((work: any, index: number) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-xl border-l-4 border-primary"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <FiBriefcase className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-k-dark-grey">
                    {work.previous_company_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {work.previous_job_title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(work.start_date)} -{" "}
                    {work.end_date ? formatDate(work.end_date) : "Present"}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">
            No previous work experience records found.
          </p>
        )}
      </div>
    </div>
  );
}

function EmploymentSection({ employee }: any) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const latest =
    employee?.employments?.length > 0 ? employee.employments[0] : null;

  const handleDownload = async (
    type: "experience-letter" | "certificate-of-service",
  ) => {
    if (!employee?.id) return;
    try {
      setDownloading(type);
      // Construct route based on type
      const route =
        type === "experience-letter"
          ? apiRoutes.experienceLetter(employee.id)
          : apiRoutes.certificateOfService(employee.id);

      const response: any = await makeCall({
        method: "GET",
        route,
        isSecureRoute: true,
        responseType: "blob",
      });

      const file = new Blob([response.data], { type: "application/pdf" });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `${type === "experience-letter" ? "Experience_Letter" : "Certificate_of_Service"}_${employee.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
      ToastService.error("Failed to download document");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-k-dark-grey">
          Employment Details
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-sm border-primary/20 text-primary hover:bg-primary-light px-3 py-1.5"
            onClick={() => handleDownload("experience-letter")}
            disabled={downloading !== null}
            loading={downloading === "experience-letter"}
            icon={FiDownload}
          >
            Experience Letter
          </Button>
          <Button
            variant="outline"
            className="text-sm border-primary/20 text-primary hover:bg-primary-light px-3 py-1.5"
            onClick={() => handleDownload("certificate-of-service")}
            disabled={downloading !== null}
            loading={downloading === "certificate-of-service"}
            icon={FiFileText}
          >
            Certificate of Service
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoField label="Department" value={latest?.department?.name} />
        <InfoField
          label="Job Title"
          value={
            latest?.jobTitle
              ? `${latest.jobTitle.title}${latest.jobTitle.level ? ` - ${latest.jobTitle.level}` : ""}`
              : "N/A"
          }
        />
        <InfoField label="Employment Type" value={latest?.employment_type} />
        <InfoField
          label="Start Date"
          value={
            latest?.start_date
              ? formatDayjsDate(latest.start_date, "N/A")
              : "N/A"
          }
        />
        <InfoField
          label="Manager"
          value={latest?.manager?.fullName || "Not assigned"}
        />
      </div>
    </div>
  );
}

function CompensationSection({ employee, allowanceTypes }: any) {
  const latest =
    employee?.employments?.length > 0 ? employee.employments[0] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Compensation</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <InfoField
          label="Gross Salary"
          value={
            latest?.gross_salary
              ? `${Number(latest.gross_salary).toLocaleString()} ETB`
              : "N/A"
          }
        />
        <InfoField
          label="Basic Salary"
          value={
            latest?.basic_salary
              ? `${Number(latest.basic_salary).toLocaleString()} ETB`
              : "N/A"
          }
        />
      </div>

      <div className="border-t pt-6">
        <h3 className="font-semibold text-k-dark-grey mb-4 flex items-center gap-2">
          <FiDollarSign className="text-primary" /> Allowances
        </h3>
        {latest?.allowances?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {latest.allowances.map((a: any, index: number) => {
              const typeName =
                a.allowanceType?.name ||
                allowanceTypes.find((at: any) => at.id === a.allowance_type_id)
                  ?.name ||
                "Allowance";
              return (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p className="text-sm text-gray-500 mb-1">{typeName}</p>
                  <p className="font-bold text-k-dark-grey">
                    {Number(a.amount).toLocaleString()} ETB
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">
            No allowances assigned.
          </p>
        )}
      </div>
    </div>
  );
}

function CertificationsSection({ certifications }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-xl font-bold text-k-dark-grey mb-6 border-b pb-4">
        Certifications
      </h2>
      <div className="space-y-4">
        {certifications?.length > 0 ? (
          certifications.map((cert: any, index: number) => (
            <div key={index} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <FiAward className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-k-dark-grey">{cert.name}</p>
                  <p className="text-sm text-gray-500">
                    {cert.issuing_organization}
                  </p>
                  {cert.credential_url && (
                    <a
                      href={cert.credential_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
                    >
                      <FiExternalLink className="w-4 h-4" /> View Credential
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">
            No certifications found.
          </p>
        )}
      </div>
    </div>
  );
}

// Helper Component for View Link to match Admin
const ViewLink = ({ url }: { url: string }) => {
  const normalizeExternalUrl = (url: string) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const href = normalizeExternalUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-xs flex items-center gap-1 text-primary hover:underline font-medium bg-primary-light px-2 py-1 rounded"
    >
      <FiExternalLink /> View
    </a>
  );
};

function DocumentsSection({ documents, editAction }: any) {
  return (
    <Card title="Documents" icon={<FiFileText />} action={editAction}>
      {(() => {
        const raw = documents;

        const extractUrl = (v: any) => {
          if (!v) return "";
          if (typeof v === "string") return v;
          return v.document_url || v.url || v.fileUrl || "";
        };

        if (!raw) {
          return <p className="text-gray-500 italic">No documents found.</p>;
        }

        // Format A: array of document objects
        if (Array.isArray(raw)) {
          const items = raw
            .map((d: any) => ({
              label: d.file_name || d.document_type || "Document",
              type: d.document_type || "",
              url: extractUrl(d),
            }))
            .filter((d: any) => d.url);

          if (items.length === 0) {
            return <p className="text-gray-500 italic">No documents found.</p>;
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((doc: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded border border-gray-100"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FiFileText className="text-primary" />
                      <span className="text-sm font-bold text-gray-800 truncate">
                        {doc.label}
                      </span>
                    </div>
                    {doc.type && (
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">
                        {doc.type}
                      </div>
                    )}
                  </div>
                  <ViewLink url={doc.url} />
                </div>
              ))}
            </div>
          );
        }

        // Format B: bucket object with arrays of URL strings (cv/photo/etc)
        if (raw && typeof raw === "object") {
          const buckets: Array<{ key: string; label: string }> = [
            { key: "cv", label: "CV" },
            { key: "national_id", label: "National ID / Passport" },
            { key: "guarantee_letter", label: "Guarantee Letter" },
            { key: "medical_certificate", label: "Medical Certificate" },
            { key: "police_certificate", label: "Police Certificate" },
            { key: "photo", label: "Photo" },
            { key: "tax_forms", label: "Tax Forms" },
            { key: "pension_forms", label: "Pension Forms" },
          ];

          const rows = buckets
            .map((b) => {
              const list = (raw as any)[b.key];
              const urls: string[] = Array.isArray(list)
                ? list.map(extractUrl).filter(Boolean)
                : [];
              return { ...b, urls };
            })
            .filter((r) => r.urls.length > 0);

          if (rows.length === 0) {
            return <p className="text-gray-500 italic">No documents found.</p>;
          }

          return (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FiFileText className="text-primary" />
                    <h3 className="font-bold text-gray-900">{row.label}</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {row.urls.map((url, idx) => (
                      <ViewLink key={idx} url={url} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return <p className="text-gray-500 italic">No documents found.</p>;
      })()}
    </Card>
  );
}

function DocumentCard({ title, files }: any) {
  return (
    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary">
            <FiFileText className="w-5 h-5" />
          </div>
          <p className="font-semibold text-gray-900">{title}</p>
        </div>
      </div>

      <div className="space-y-3">
        {files.map((file: string, index: number) => {
          const fileName =
            file.split("/").pop()?.split("?")[0] || `Document ${index + 1}`;
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group/item hover:bg-white hover:ring-1 hover:ring-primary/20 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 text-primary">
                  <FiFile className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium text-gray-700 truncate max-w-[150px]"
                    title={fileName}
                  >
                    {fileName}
                  </p>
                  <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{" "}
                    Uploaded
                  </p>
                </div>
              </div>
              <a
                href={file}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark bg-white px-3 py-1.5 rounded-md border border-primary/20 shadow-sm"
              >
                <FiDownload className="w-3.5 h-3.5" /> View
              </a>
            </div>
          );
        })}
        <button className="w-full mt-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs font-medium hover:border-primary/40 hover:text-primary hover:bg-primary-light transition-all flex items-center justify-center gap-2">
          <FiEdit2 className="w-3 h-3" /> + Add more files
        </button>
      </div>
    </div>
  );
}

function CareerSection({ events }: { events: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <h2 className="text-xl font-bold text-k-dark-grey mb-6 border-b pb-4">
        Career Path
      </h2>
      <CareerTimeline events={events || []} />
    </div>
  );
}
