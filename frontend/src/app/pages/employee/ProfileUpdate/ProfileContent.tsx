import { useCallback, useEffect, useState } from "react";

import { FiTrendingUp, FiFileText } from "react-icons/fi";
import ProfileSidebar from "./ProfileSidebar";
import PersonalDetails from "./sections/PersonalDetails";
import ContactDetails from "./sections/ContactDetails";
import EducationWrapper from "./sections/EducationWrapper";
import WorkExperienceWrapper from "./sections/WorkExperienceWrapper";
import CertificationsWrapper from "./sections/CertificationsWrapper";
import FinancialDetails from "./sections/FinancialDetails";
import JobDetails from "./sections/JobDetails";
import DocumentsWrapper from "./sections/DocumentsWrapper";
import CareerTimeline from "../../../components/Employee/CareerTimeline";
import adminService from "../../../services/adminService";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import Button from "../../../components/Core/ui/Button";
import toast from "react-hot-toast";
import PageHeader from "../../../components/common/PageHeader";
import onboardingService from "../../../services/onboardingService";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { getRoleNameById } from "../../../../utils/constants";
import ProfilePictureUpload from "../../../components/Employee/ProfilePictureUpload";
import { useDispatch } from "react-redux";
import { authActions } from "../../../slice/authSlice";
import { formatIsoDate } from "../../../utils/dayjs-format";

interface ProfileContentProps {
  // Add any props if needed later, currently none required as it pulls from Redux/API
}

export default function ProfileContent() {
  const [activeSection, setActiveSection] = useState("personal");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const dispatch = useDispatch();

  const user = useSelector(selectAuthUser) as any;

  const displayName = (() => {
    const fullName =
      user?.full_name ||
      user?.fullName ||
      user?.name ||
      user?.employee?.full_name ||
      user?.employee?.fullName ||
      null;

    if (fullName && String(fullName).trim()) return String(fullName).trim();

    const first = user?.first_name || user?.firstName || null;
    const last = user?.last_name || user?.lastName || null;
    const composed = [first, last].filter(Boolean).join(" ").trim();
    if (composed) return composed;

    const email = user?.email;
    if (email && typeof email === "string") {
      const prefix = email.split("@")[0];
      if (prefix) return prefix;
    }

    return "Employee";
  })();

  const roleLabel = getRoleNameById(user?.role_id);

  const [profileData, setProfileData] = useState<any>({
    personal: {
      fullName: "",
      gender: "",
      dateOfBirth: "",
      tinNumber: "",
      pensionNumber: "",
      placeOfWork: "Head Office",
    },
    contact: {
      region: "",
      city: "",
      subCity: "",
      woreda: "",
      houseNumber: "",
      phones: [{ number: "", type: "Private", isPrimary: true }],
      emergencyContacts: [],
    },
    education: [],
    workExperience: [],
    certifications: [],
    documents: {
      cv: [],
      certificates: [],
      photo: [],
      experienceLetters: [],
      taxForms: [],
      pensionForms: [],
    },
    careerEvents: [],
    financial: [],
    jobDetails: {},
  });

  const toISODate = (value: unknown): string => {
    if (!value) return "";
    const parsed = new Date(value as any);
    if (Number.isNaN(parsed.getTime())) return "";
    return formatIsoDate(parsed);
  };

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const response = await onboardingService.getStatus();
      const data = response?.data || {};

      const next: any = {
        personal: { ...profileData.personal },
        contact: { ...profileData.contact },
        education: Array.isArray(profileData.education)
          ? [...profileData.education]
          : [],
        workExperience: Array.isArray(profileData.workExperience)
          ? [...profileData.workExperience]
          : [],
        certifications: Array.isArray(profileData.certifications)
          ? [...profileData.certifications]
          : [],
        documents: { ...profileData.documents },
      };

      if (data.employee) {
        next.personal = {
          ...next.personal,
          fullName: data.employee.full_name || next.personal.fullName,
          gender: data.employee.gender || next.personal.gender,
          dateOfBirth:
            toISODate(data.employee.date_of_birth) || next.personal.dateOfBirth,
          tinNumber: data.employee.tin_number || next.personal.tinNumber,
          pensionNumber:
            data.employee.pension_number || next.personal.pensionNumber,
          placeOfWork: data.employee.place_of_work || next.personal.placeOfWork,
        };
      }

      if (data.contact) {
        const phones =
          data.contact.phones?.map((phone: any) => ({
            number: phone.phone_number || phone.number || "",
            type: phone.phone_type || phone.type || "Private",
            isPrimary: phone.is_primary || phone.isPrimary || false,
          })) || [];

        const emergencyContacts =
          data.contact.emergencyContacts?.map((ec: any) => ({
            fullName: ec.full_name || ec.fullName || "",
            relationship: ec.relationship || "",
            phoneNumber: ec.phone_number || ec.phoneNumber || "",
            email: ec.email || "",
            isPrimary: ec.is_primary || ec.isPrimary || false,
          })) || [];

        const address = data.contact.addresses?.[0] || {};

        next.contact = {
          ...next.contact,
          region: address.region || next.contact.region,
          city: address.city || next.contact.city,
          subCity: address.sub_city || address.subCity || next.contact.subCity,
          woreda: address.woreda || next.contact.woreda,
          houseNumber:
            address.house_number ||
            address.houseNumber ||
            next.contact.houseNumber,
          phones: phones.length > 0 ? phones : next.contact.phones,
          emergencyContacts:
            emergencyContacts.length > 0
              ? emergencyContacts
              : next.contact.emergencyContacts,
        };
      }

      // ... existing education ...

      if (data.documents) {
        const docs = data.documents;
        const makeDocArray = (items: any) => {
          if (Array.isArray(items)) return items;
          if (typeof items === "string") return [items];
          if (items) return [items];
          return [];
        };

        next.documents = {
          ...next.documents,
          cv: makeDocArray(docs.cv || docs.cv_url),
          nationalId: makeDocArray(
            docs.national_id || docs.nationalId || docs.national_id_card,
          ),
          guaranteeLetter: makeDocArray(
            docs.guarantee_letter || docs.guaranteeLetter,
          ),
          medicalCertificate: makeDocArray(
            docs.medical_certificate || docs.medicalCertificate,
          ),
          policeCertificate: makeDocArray(
            docs.police_certificate || docs.policeCertificate,
          ),
          certificates: makeDocArray(docs.certificates),
          photo: makeDocArray(docs.photo || docs.photo_url),
          experienceLetters: makeDocArray(
            docs.experience_letters || docs.experienceLetters,
          ),
          taxForms: makeDocArray(docs.tax_forms || docs.taxForms),
          pensionForms: makeDocArray(docs.pension_forms || docs.pensionForms),
        };
      }

      // Fetch full employee detail for Career Path and Job Details using /employees/me
      try {
        const detailResponse = await adminService.getMyProfile();
        const detail =
          detailResponse.data?.employee ||
          detailResponse.employee ||
          detailResponse;

        if (detail) {
          // Populate Career Events
          if (detail.careerEvents) {
            next.careerEvents = detail.careerEvents;
          }

          // Populate Job Details (Employment) - get from active employment
          const activeEmployment =
            detail.employments?.find((e: any) => e.is_active) ||
            detail.employments?.[0];

          // Populate Emergency Contacts
          if (detail.emergencyContacts) {
            next.contact.emergencyContacts = detail.emergencyContacts.map(
              (ec: any) => ({
                fullName: ec.full_name || ec.fullName || "",
                relationship: ec.relationship || "",
                phoneNumber: ec.phone_number || ec.phoneNumber || "",
                email: ec.email || "",
                isPrimary: ec.is_primary || ec.isPrimary || false,
              }),
            );
          }

          // Populate Documents from Detail (Object format from fetchEmployeeDetail)
          if (detail.documents) {
            const dDocs = detail.documents;
            const toList = (items: any) => {
              if (Array.isArray(items)) return items;
              if (typeof items === "string") return [items];
              if (items) return [items];
              return [];
            };

            // Group items by type if dDocs is an array (Complete Employee Detail format)
            if (Array.isArray(dDocs)) {
              const grouped: any = {
                cv: [],
                certificates: [],
                photo: [],
                experienceLetters: [],
                taxForms: [],
                pensionForms: [],
                nationalId: [],
                guaranteeLetter: [],
                medicalCertificate: [],
                policeCertificate: [],
              };

              dDocs.forEach((doc: any) => {
                const type = (doc.document_type || "").toUpperCase();
                const url = doc.document_url || doc.url;
                if (!url) return;

                if (type === "CV" || type.includes("RESUME"))
                  grouped.cv.push(url);
                else if (
                  type === "ID_DOCUMENT" ||
                  type === "NATIONAL_ID" ||
                  type === "PASSPORT"
                )
                  grouped.nationalId.push(url);
                else if (type === "GUARANTEE_LETTER")
                  grouped.guaranteeLetter.push(url);
                else if (type === "MEDICAL_CERTIFICATE")
                  grouped.medicalCertificate.push(url);
                else if (type === "POLICE_CERTIFICATE" || type === "FORENSIC")
                  grouped.policeCertificate.push(url);
                else if (type === "TAX_FORM" || type === "TAX")
                  grouped.taxForms.push(url);
                else if (type === "PENSION_FORM" || type === "PENSION")
                  grouped.pensionForms.push(url);
                else if (type === "CERTIFICATE" || type === "CERTIFICATES")
                  grouped.certificates.push(url);
                else if (type === "PHOTO" || type === "PROFILE_PICTURE")
                  grouped.photo.push(url);
                else if (
                  type === "EXPERIENCE_LETTER" ||
                  type === "WORK_EXPERIENCE"
                )
                  grouped.experienceLetters.push(url);
              });

              next.documents = { ...next.documents, ...grouped };
            } else {
              // Object format (bucketed)
              next.documents = {
                ...next.documents,
                cv: toList(dDocs.cv || dDocs.cv_url),
                nationalId: toList(dDocs.national_id || dDocs.nationalId),
                guaranteeLetter: toList(
                  dDocs.guarantee_letter || dDocs.guaranteeLetter,
                ),
                medicalCertificate: toList(
                  dDocs.medical_certificate || dDocs.medicalCertificate,
                ),
                policeCertificate: toList(
                  dDocs.police_certificate || dDocs.policeCertificate,
                ),
                certificates: toList(dDocs.certificates),
                photo: toList(dDocs.photo || dDocs.photo_url),
                experienceLetters: toList(
                  dDocs.experience_letters || dDocs.experienceLetters,
                ),
                taxForms: toList(dDocs.tax_forms || dDocs.taxForms),
                pensionForms: toList(dDocs.pension_forms || dDocs.pensionForms),
              };
            }
          }

          next.jobDetails = {
            employeeId: detail.id,
            jobTitle:
              detail.job_title || activeEmployment?.jobTitle?.title || "",
            jobLevel: activeEmployment?.jobTitle?.level || "",
            department:
              detail.department || activeEmployment?.department?.name || "",
            employmentType:
              detail.employment_type ||
              activeEmployment?.employment_type ||
              "Full Time",
            startDate: detail.start_date || activeEmployment?.start_date || "",
            contractEndDate: activeEmployment?.contract_end_date || "N/A",
            branch: detail.place_of_work || "Head Office",
            manager: activeEmployment?.manager?.full_name || "N/A",
            grossSalary: activeEmployment?.gross_salary || 0,
            basicSalary: activeEmployment?.basic_salary || 0,
            allowances: activeEmployment?.allowances || [],
          };

          // Populate Financial Details
          if (detail.financialDetails) {
            next.financial = detail.financialDetails.map((fd: any) => ({
              id: fd.id,
              bankName: fd.bank?.name || fd.bankName || "",
              accountNumber: fd.account_number || "",
              accountName: fd.account_holder_name || "",
              isPrimary: fd.is_primary || false,
              tinNumber: detail.tin_number || "", // TIN is on employee level usually
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch additional employee details", error);
      }

      setProfileData(next);
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load profile",
      );
    } finally {
      setIsLoadingProfile(false);
    }
  }, []); // Remove profileData dependency to assume only mounting logic for simplicity or useRef if needed, but [] matches original

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const renderSection = () => {
    switch (activeSection) {
      case "personal":
        return (
          <PersonalDetails
            initialData={profileData.personal}
            onRefresh={loadProfile}
          />
        );
      case "contact":
        return (
          <ContactDetails
            initialData={profileData.contact}
            onRefresh={loadProfile}
          />
        );
      case "education":
        return (
          <EducationWrapper
            initialEducation={profileData.education}
            onRefresh={loadProfile}
          />
        );
      case "workExperience":
        return (
          <WorkExperienceWrapper
            initialWorkExperience={profileData.workExperience}
            onRefresh={loadProfile}
          />
        );
      case "certifications":
        return (
          <CertificationsWrapper
            initialCertifications={profileData.certifications}
            onRefresh={loadProfile}
          />
        );
      case "financial":
        return (
          <FinancialDetails
            initialData={profileData.financial}
            onRefresh={loadProfile}
          />
        );
      case "employment":
        return <JobDetails data={profileData.jobDetails} />;
      case "career":
        return (
          <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <FiTrendingUp className="text-xl" />
                </div>
                <h2 className="text-xl font-bold text-k-dark-grey">
                  Career Progression
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="text-sm px-3 py-1.5 h-auto border-primary text-primary hover:bg-primary-light"
                  onClick={async () => {
                    if (!user?.employee_id) return;
                    try {
                      const response = await makeCall({
                        route: apiRoutes.certificateOfService(user.employee_id),
                        method: "GET",
                        responseType: "blob",
                      });
                      const url = window.URL.createObjectURL(
                        new Blob([response.data]),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.setAttribute(
                        "download",
                        `Certificate_of_Service.pdf`,
                      );
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      toast.success("Certificate of Service downloaded");
                    } catch {
                      toast.error("Failed to download Certificate of Service");
                    }
                  }}
                  icon={FiFileText}
                >
                  Certificate of Service
                </Button>
              </div>
            </div>
            <CareerTimeline
              events={profileData.careerEvents || []}
              initialData={{
                job_title: profileData.jobDetails?.jobTitle,
                job_level: profileData.jobDetails?.jobLevel,
                department: profileData.jobDetails?.department,
                start_date: profileData.jobDetails?.startDate,
                gross_salary: profileData.jobDetails?.grossSalary,
              }}
            />
          </div>
        );
      case "documents":
        return (
          <DocumentsWrapper
            initialDocuments={profileData.documents}
            onRefresh={loadProfile}
          />
        );
      default:
        return (
          <PersonalDetails
            initialData={profileData.personal}
            onRefresh={loadProfile}
          />
        );
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header Banner */}
      <PageHeader className="rounded-b-3xl -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-8 pt-8 pb-24 h-52">
        <div className="max-w-7xl mx-auto relative z-10">
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="">
            Manage your personal information and employment details
          </p>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 self-start">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 text-center">
              <div className="mb-4">
                <ProfilePictureUpload
                  employeeId={user?.employee?.id || user?.id}
                  currentUrl={
                    user?.employee?.profile_picture_url ||
                    user?.profile_picture_url
                  }
                  onUpdate={() => {
                    dispatch(authActions.getMeRequest());
                    loadProfile();
                  }}
                  size="w-24 h-24"
                />
              </div>
              <h2 className="text-xl font-bold text-k-dark-grey">
                {displayName}
              </h2>
              <p className="text-k-medium-grey text-sm mb-4">{roleLabel}</p>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                Active Employee
              </div>
            </div>

            <ProfileSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full">
            {isLoadingProfile ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-k-medium-grey">
                Loading profile...
              </div>
            ) : (
              renderSection()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
