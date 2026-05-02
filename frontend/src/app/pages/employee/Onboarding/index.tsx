import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import StepPersonalInfo from "../../../components/employees/wizard/StepPersonalInfo";
import StepContactInfo from "../../../components/employees/wizard/StepContactInfo";
import StepFinancialDetails from "../../../components/employees/wizard/StepFinancialDetails";
import StepEducation from "../../../components/employees/wizard/StepEducation";
import StepWorkExperience from "../../../components/employees/wizard/StepWorkExperience";
import StepCertifications from "../../../components/employees/wizard/StepCertifications";
import StepDocuments from "../../../components/employees/wizard/StepDocuments";
import StepSignature from "../../../components/employees/wizard/StepSignature";
import StepReview from "../../../components/employees/wizard/StepReview";
import RegistrationModal from "../../../components/employees/RegistrationModal";
import useMinimumDelay from "../../../hooks/useMinimumDelay";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import Button from "../../../components/Core/ui/Button";
import { MdCheck, MdArrowBack, MdArrowForward, MdError } from "react-icons/md";
import toast from "react-hot-toast";
import onboardingService from "../../../services/onboardingService";
import api from "../../../services/api";
import { useDispatch } from "react-redux";
import { authActions } from "../../../slice/authSlice";
import { formatIsoDate } from "../../../utils/dayjs-format";

// Type definitions
interface Phone {
  number: string;
  type: string;
  isPrimary: boolean;
}

interface EmergencyContact {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  email: string;
  isPrimary: boolean;
}

interface FinancialDetail {
  bankId: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary: boolean;
}

interface FileItem {
  file?: File;
  url: string;
  name: string;
  uploading?: boolean;
  error?: string;
}

interface Education {
  level: string;
  fieldOfStudy: string;
  institution: string;
  programType: string;
  hasCostSharing?: boolean;
  costSharingDocument?: (FileItem | string | any)[];
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  costSharingDetails?: string;
  costSharing?: {
    documentNumber?: string;
    issuingInstitution?: string;
    issueDate?: string;
    department?: string;
    yearOfEntrance?: string | number;
    graduationDate?: string;
    declaredTotalCost?: string;
    currency?: string;
    commitmentType?: string;
    regulationReference?: string;
    paymentStatus?: string;
    remarks?: string;
  };
  costSharingDocumentNumber?: string;
  costSharingIssueDate?: string;
  costSharingTotalCost?: string;
  costSharingCurrency?: string;
  costSharingCommitmentType?: string;
  costSharingPaymentStatus?: string;
  costSharingRegulationReference?: string;
  costSharingRemarks?: string;
  document_urls?: (
    | string
    | {
        file?: File;
        url: string;
        name?: string;
        uploading?: boolean;
        error?: string;
      }
  )[];
}

interface WorkExperience {
  companyName: string;
  jobTitle?: string;
  previousJobTitle?: string;
  level?: string;
  department?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  employmentType?: string;
  document_urls?: (FileItem | string)[];
}

interface Certification {
  name: string;
  issuingOrganization?: string;
  issueDate?: string;
  expirationDate?: string;
  certificateDocument?: (FileItem | string | any)[];
  credentialId?: string;
  credentialUrl?: string;
}

interface Documents {
  cv?: (FileItem | string)[];
  certificates?: (FileItem | string)[];
  experienceLetters?: (FileItem | string)[];
  photo?: (FileItem | string)[];
  taxForms?: (FileItem | string)[];
  pensionForms?: (FileItem | string)[];
  nationalId?: (FileItem | string)[];
  guaranteeLetter?: (FileItem | string)[];
  medicalCertificate?: (FileItem | string)[];
  policeCertificate?: (FileItem | string)[];
}

interface FormData {
  // Personal Info
  fullName: string;
  gender: string;
  dateOfBirth: string;
  tinNumber: string;
  pensionNumber: string;
  placeOfWork: string;
  signature: string;
  // Contact Info
  region: string;
  city: string;
  subCity: string;
  woreda: string;
  phones: Phone[];
  emergencyContacts: EmergencyContact[];
  // Financial Details
  financialDetails: FinancialDetail[];
  // Education
  education: Education[];
  // Work Experience
  workExperience: WorkExperience[];
  // Certifications
  certifications: Certification[];
  // Documents
  documents: Documents;
}

interface ExtractedData {
  personalInfo?: Partial<FormData>;
  contactInfo?: {
    region?: string;
    city?: string;
    subCity?: string;
    woreda?: string;
    phones?: Phone[];
  };
  education?: Education[];
  workExperience?: WorkExperience[];
  certifications?: Certification[];
  documents?: Partial<Documents>;
}

interface StepComponentProps {
  formData: FormData;
  handleChange: (field: string, value: unknown) => void;
  updateFormData: (section: string, data: unknown) => void;
  errors: Record<string, string | null>;
  onEditStep?: (stepId: number) => void;
}

type StepComponentType = React.ComponentType<StepComponentProps>;

interface Step {
  id: number;
  title: string;
  component: StepComponentType;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "Personal Info",
    component: StepPersonalInfo as StepComponentType,
  },
  {
    id: 2,
    title: "Contact Info",
    component: StepContactInfo as StepComponentType,
  },
  {
    id: 3,
    title: "Financial Details",
    component: StepFinancialDetails as StepComponentType,
  },
  { id: 4, title: "Education", component: StepEducation as StepComponentType },
  {
    id: 5,
    title: "Previous Work Experience",
    component: StepWorkExperience as StepComponentType,
  },
  {
    id: 6,
    title: "Certifications",
    component: StepCertifications as StepComponentType,
  },
  { id: 7, title: "Documents", component: StepDocuments as StepComponentType },
  { id: 8, title: "Signature", component: StepSignature as StepComponentType },
  { id: 9, title: "Review", component: StepReview as StepComponentType },
];

export default function EmployeeOnboarding() {
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(true);
  const [wizardStarted, setWizardStarted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    // Personal Info (flat structure)
    fullName: "",
    gender: "",
    dateOfBirth: "",
    tinNumber: "",
    pensionNumber: "",
    placeOfWork: "Head Office",
    signature: "",

    // Contact Info (flat structure)
    region: "",
    city: "",
    subCity: "",
    woreda: "",
    phones: [{ number: "", type: "Private", isPrimary: true }],
    emergencyContacts: [],
    // Financial Details
    financialDetails: [],

    // Education
    education: [],

    // Work Experience
    workExperience: [],

    // Certifications
    certifications: [],

    // Documents (all as arrays for multiple file support)
    documents: {
      cv: [],
      certificates: [],
      experienceLetters: [],
      photo: [],
      taxForms: [],
      pensionForms: [],
      nationalId: [],
      guaranteeLetter: [],
      medicalCertificate: [],
      policeCertificate: [],
    },
  });

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (step === 1) {
      if (!formData.fullName) {
        newErrors.fullName = "Full Name is required";
      } else if (formData.fullName.trim().split(/\s+/).length !== 3) {
        newErrors.fullName =
          "Full Name must contain exactly three words (First Middle Last)";
      }

      if (!formData.gender) newErrors.gender = "Gender is required";
      if (!formData.dateOfBirth)
        newErrors.dateOfBirth = "Date of Birth is required";

      if (!formData.tinNumber) newErrors.tinNumber = "Tin number is required";
      if (formData.tinNumber && !/^\d{10}$/.test(formData.tinNumber)) {
        newErrors.tinNumber = "TIN Number must be exactly 10 digits";
      }
    }

    const validatePhone = (phone: string) => {
      if (!phone) return "Phone number is required";
      const cleanPhone = phone.replace(/\D/g, "");
      // Validate phone number format (e.g., +1234567890, 0912345678, 251912345678)
      // This regex allows for numbers starting with '+' followed by 7-15 digits,
      // or numbers starting with '0' followed by 9 digits,
      // or numbers starting with '251' followed by 9 digits.
      const phoneRegex = /^(?:\+\d{7,15}|0\d{9}|251\d{9})$/;
      if (!phoneRegex.test(phone)) {
        return "Invalid phone number format. Must be like +1234567890, 0912345678, or 251912345678.";
      }
      return null;
    };

    if (step === 2) {
      if (formData.phones.length === 0) {
        newErrors.phones = "At least one phone number is required";
      } else {
        formData.phones.forEach((phone, index) => {
          const phoneError = validatePhone(phone.number);
          if (phoneError) {
            newErrors[`phone_${index}`] = phoneError;
          }
        });
      }

      if ((formData.emergencyContacts || []).length === 0) {
        newErrors.emergencyContacts =
          "At least one emergency contact is required";
      } else {
        formData.emergencyContacts.forEach((contact, index) => {
          if (!contact.fullName) {
            newErrors[`ec_${index}_name`] = "Full Name is required";
          } else if (contact.fullName.trim().split(/\s+/).length !== 3) {
            newErrors[`ec_${index}_name`] = "Name must be three words";
          }

          if (!contact.relationship)
            newErrors[`ec_${index}_rel`] = "Relationship is required";

          const ecPhoneError = validatePhone(contact.phoneNumber);
          if (ecPhoneError) {
            newErrors[`ec_${index}_phone`] = ecPhoneError;
          }
        });
      }
    }

    if (step === 3) {
      if ((formData.financialDetails || []).length === 0) {
        newErrors.financialDetails = "At least one bank account is required";
      } else {
        formData.financialDetails.forEach((detail, index) => {
          if (!detail.bankId)
            newErrors[`fd_${index}_bank`] = "Bank is required";
          if (!detail.accountNumber) {
            newErrors[`fd_${index}_accNum`] = "Account Number is required";
          } else if (!/^\d+$/.test(detail.accountNumber)) {
            newErrors[`fd_${index}_accNum`] = "Account Number must be numeric";
          }
          if (!detail.accountHolderName) {
            newErrors[`fd_${index}_accName`] =
              "Account Holder Name is required";
          } else if (
            detail.accountHolderName.trim().split(/\s+/).length !== 3
          ) {
            newErrors[`fd_${index}_accName`] =
              "Account Holder Name must contain exactly three words (First Middle Last)";
          }
        });
      }
    }

    if (step === 4) {
      formData.education.forEach((edu, index) => {
        if (!edu.level) newErrors[`edu_level_${index}`] = "Level is required";
        if (!edu.fieldOfStudy)
          newErrors[`edu_field_${index}`] = "Field of Study is required";
        if (!edu.institution)
          newErrors[`edu_inst_${index}`] = "Institution is required";
        if (!edu.programType)
          newErrors[`edu_prog_${index}`] = "Program Type is required";

        if (edu.hasCostSharing) {
          if (!edu.costSharingDocument && !edu.costSharingDetails) {
            newErrors[`edu_cost_doc_details_${index}`] =
              "Cost Sharing Document or Details is required";
          } else if (
            edu.costSharingDocument &&
            typeof edu.costSharingDocument === "object" &&
            "error" in edu.costSharingDocument &&
            edu.costSharingDocument.error
          ) {
            newErrors[`edu_cost_doc_${index}`] =
              "Cost Sharing Document upload failed. Please retry.";
          } else if (
            edu.costSharingDocument &&
            typeof edu.costSharingDocument === "object" &&
            "url" in edu.costSharingDocument &&
            !edu.costSharingDocument.url
          ) {
            newErrors[`edu_cost_doc_${index}`] =
              "Cost Sharing Document must be uploaded";
          } else if (edu.costSharingDocument instanceof File) {
            newErrors[`edu_cost_doc_${index}`] =
              "Cost Sharing Document must be uploaded";
          }
        }

        // Validate General Education Documents
        const hasDocs =
          edu.document_urls &&
          Array.isArray(edu.document_urls) &&
          edu.document_urls.length > 0;
        if (!hasDocs) {
          newErrors[`edu_doc_${index}`] =
            "Education Document (Degree/Certificate) is required";
        }
      });
    }

    if (step === 5) {
      formData.workExperience.forEach((exp, index) => {
        if (!exp.companyName)
          newErrors[`exp_company_${index}`] = "Company Name is required";
        if (!exp.startDate)
          newErrors[`exp_start_${index}`] = "Start Date is required";
      });
    }

    if (step === 6) {
      formData.certifications.forEach((cert, index) => {
        if (!cert.name)
          newErrors[`cert_name_${index}`] = "Certificate Name is required";
      });
    }

    if (step === 7) {
      // Check if files are uploaded (have URLs)
      const isValidFile = (files: any) =>
        files &&
        Array.isArray(files) &&
        files.some((item) => {
          if (typeof item === "string") return true;
          return item.url && !item.error;
        });

      if (!isValidFile(formData.documents.cv)) {
        newErrors.cv = "CV/Resume is required";
      }
      if (!isValidFile(formData.documents.nationalId)) {
        newErrors.nationalId = "National ID is required";
      }
      if (!isValidFile(formData.documents.guaranteeLetter)) {
        newErrors.guaranteeLetter = "Guarantee Letter is required";
      }
      if (!isValidFile(formData.documents.medicalCertificate)) {
        newErrors.medicalCertificate = "Medical Certificate is required";
      }
      if (!isValidFile(formData.documents.policeCertificate)) {
        newErrors.policeCertificate = "Police Certificate is required";
      }
    }

    if (step === 8) {
      if (!formData.signature) {
        newErrors.signature = "Signature is required";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
    } else {
      setErrors({});
    }

    return isValid;
  };

  // Fetch signature when step is 8
  useEffect(() => {
    const fetchSignature = async () => {
      if (currentStep === 8) {
        try {
          const response = await onboardingService.getSignature();
          if (response.data && response.data.signature_url) {
            setFormData((prev) => ({
              ...prev,
              signature: response.data.signature_url,
            }));
          }
        } catch (error) {
          console.error("Failed to fetch signature", error);
        }
      }
    };
    fetchSignature();
  }, [currentStep]);

  // Fetch onboarding status on mount
  useEffect(() => {
    let isMounted = true;

    const fetchOnboardingStatus = async () => {
      let loadingToast: string | undefined;
      try {
        setIsLoadingStatus(true);
        const response = await onboardingService.getStatus();

        if (!isMounted) return;

        if (response.data) {
          // Only show onboarding if status is PENDING or IN_PROGRESS
          const onboardingStatus = response.data.onboarding_status;
          if (
            onboardingStatus &&
            !["PENDING_APPROVAL", "IN_PROGRESS"].includes(onboardingStatus)
          ) {
            setShouldRedirect(true);
            setIsLoadingStatus(false);
            dispatch(authActions.getMeRequest());
            navigate("/employee/dashboard", { replace: true });
            return;
          }

          if (onboardingStatus === "PENDING_APPROVAL") {
            // If explicit edit mode not active, redirect to waiting screen
            if (!location.state?.edit) {
              setShouldRedirect(true);
              setIsLoadingStatus(false);
              navigate("/employee/waiting-approval", { replace: true });
              return;
            }
            // Else fall through to load data
          }

          // Only show loading toast if we're actually going to load data
          loadingToast = toast.loading("Loading your saved data...");

          const {
            employee,
            contact,
            financialDetails,
            education,
            workExperience,
            certifications,
            documents,
          } = response.data;

          if (loadingToast) toast.dismiss(loadingToast);

          // Map backend data to frontend format
          if (employee) {
            setFormData((prev) => ({
              ...prev,
              fullName: employee.full_name || prev.fullName,
              gender: employee.gender || prev.gender,
              dateOfBirth: employee.date_of_birth
                ? formatIsoDate(employee.date_of_birth)
                : prev.dateOfBirth,
              tinNumber: employee.tin_number || prev.tinNumber,
              pensionNumber: employee.pension_number || prev.pensionNumber,
              placeOfWork: employee.place_of_work || prev.placeOfWork,
              signature: employee.signature_url || prev.signature,
            }));
          }

          if (documents) {
            const mapDocs = (docUrls: any) => {
              if (!docUrls) return [];
              const urls = Array.isArray(docUrls) ? docUrls : [docUrls];
              return urls.filter(Boolean).map((url: string, index: number) => {
                // Try to extract filename from URL
                let name = `Document ${index + 1}`;
                try {
                  const urlObj = new URL(url);
                  const pathname = urlObj.pathname;
                  const parts = pathname.split("/");
                  const filename = parts[parts.length - 1];
                  if (filename && filename.length > 0) {
                    name = decodeURIComponent(filename);
                  }
                } catch (e) {
                  // If not a valid URL or other error, just use the extracted name logic or default
                  if (typeof url === "string") {
                    const parts = url.split("/");
                    if (parts.length > 0) name = parts[parts.length - 1];
                  }
                }

                return {
                  id: `loaded-doc-${index}-${Date.now()}-${Math.random()}`,
                  url: url,
                  name: name,
                  uploading: false,
                };
              });
            };

            setFormData((prev) => ({
              ...prev,
              documents: {
                cv: mapDocs(documents.cv || documents.cv_url),
                nationalId: mapDocs(
                  documents.nationalId ||
                    documents.national_id ||
                    documents.national_id_card,
                ),
                guaranteeLetter: mapDocs(
                  documents.guaranteeLetter || documents.guarantee_letter,
                ),
                medicalCertificate: mapDocs(
                  documents.medicalCertificate || documents.medical_certificate,
                ),
                policeCertificate: mapDocs(
                  documents.policeCertificate || documents.police_certificate,
                ),
                certificates: mapDocs(documents.certificates),
                photo: mapDocs(documents.photo || documents.photo_url),
                experienceLetters: mapDocs(
                  documents.experienceLetters || documents.experience_letters,
                ),
                taxForms: mapDocs(documents.taxForms || documents.tax_forms),
                pensionForms: mapDocs(
                  documents.pensionForms || documents.pension_forms,
                ),
              },
            }));
          }

          if (contact) {
            const phones =
              contact.phones?.map((phone: any) => ({
                number: phone.phone_number || phone.number,
                type: phone.phone_type || phone.type || "Private",
                isPrimary: phone.is_primary || phone.isPrimary || false,
              })) || [];

            const emergencyContacts =
              contact.emergencyContacts?.map((ec: any) => ({
                fullName: ec.fullName,
                relationship: ec.relationship,
                phoneNumber: ec.phoneNumber,
                email: ec.email || "",
                isPrimary: ec.isPrimary || false,
              })) || [];

            const address = contact.addresses?.[0] || {};

            setFormData((prev) => ({
              ...prev,
              region: address.region || prev.region,
              city: address.city || prev.city,
              subCity: address.sub_city || address.subCity || prev.subCity,
              woreda: address.woreda || prev.woreda,
              phones: phones.length > 0 ? phones : prev.phones,
              emergencyContacts:
                emergencyContacts.length > 0
                  ? emergencyContacts
                  : prev.emergencyContacts,
            }));
          }

          if (financialDetails && Array.isArray(financialDetails)) {
            // Wait, financialDetails might be top level or part of employee?
            // In backend getOnboardingStatus I added it to top level Data object.
            const fds = financialDetails.map((fd: any) => ({
              bankId: fd.bankId?.toString(),
              bankName: fd.bank?.name || fd.bankName || "",
              accountNumber: fd.accountNumber,
              accountHolderName: fd.accountHolderName,
              isPrimary: fd.isPrimary || false,
            }));
            setFormData((prev) => ({
              ...prev,
              financialDetails: fds.length > 0 ? fds : prev.financialDetails,
            }));
          } else if (
            response.data.employee &&
            response.data.employee.financialDetails
          ) {
            // Just in case it's nested
          }

          if (education && Array.isArray(education)) {
            const mappedEducation = education.map((edu: any) => ({
              level: edu.educationLevel?.name || edu.level || "",
              fieldOfStudy:
                edu.fieldOfStudy?.name ||
                edu.fieldOfStudy ||
                edu.field_of_study ||
                "",
              institution:
                edu.institution?.name ||
                edu.institution ||
                edu.institution_name ||
                "",
              programType: edu.program_type || edu.programType || "Regular",
              hasCostSharing:
                edu.has_cost_sharing || edu.hasCostSharing || false,
              costSharingDocument: edu.cost_sharing_document_url
                ? Array.isArray(edu.cost_sharing_document_url)
                  ? edu.cost_sharing_document_url
                  : [edu.cost_sharing_document_url]
                : edu.costSharingDocument
                  ? Array.isArray(edu.costSharingDocument)
                    ? edu.costSharingDocument
                    : [edu.costSharingDocument]
                  : [],
              costSharing: {
                documentNumber:
                  edu.costSharingDocumentNumber || edu.document_number || "",
                declaredTotalCost:
                  edu.costSharingTotalCost || edu.declared_total_cost || "",
                currency: edu.costSharingCurrency || edu.currency || "ETB",
                commitmentType:
                  edu.costSharingCommitmentType || edu.commitment_type || "",
                regulationReference:
                  edu.costSharingRegulationReference ||
                  edu.regulation_reference ||
                  "",
                remarks: edu.costSharingRemarks || edu.remarks || "",
                issueDate:
                  edu.costSharingIssueDate || edu.issue_date
                    ? new Date(edu.costSharingIssueDate || edu.issue_date)
                        .toISOString()
                        .split("T")[0]
                    : "",
                issuingInstitution:
                  edu.costSharingIssuingInstitution ||
                  edu.issuing_institution ||
                  "",
                paymentStatus:
                  edu.costSharingPaymentStatus || edu.payment_status || "",
              },
              costSharingDetails: edu.cost_sharing_details || "",
              document_urls: edu.document_urls || [], // Map document_urls from backend
              startDate:
                edu.start_date || edu.startDate
                  ? new Date(edu.start_date || edu.startDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              endDate:
                edu.end_date || edu.endDate
                  ? new Date(edu.end_date || edu.endDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              isCurrent: edu.is_current || edu.isCurrent || false,
            }));

            setFormData((prev) => ({
              ...prev,
              education:
                mappedEducation.length > 0 ? mappedEducation : prev.education,
            }));
          }

          if (workExperience && Array.isArray(workExperience)) {
            const mappedWorkExp = workExperience.map((exp: any) => ({
              companyName:
                exp.previousCompanyName ||
                exp.previous_company_name ||
                exp.companyName ||
                "",
              jobTitle:
                exp.job_title_id ||
                exp.previous_job_title_id ||
                exp.jobTitleId ||
                exp.jobTitle ||
                "",
              employmentType: exp.employment_type || exp.employmentType || "",
              previousJobTitle:
                exp.previous_job_title_text ||
                exp.position ||
                exp.previousJobTitle ||
                exp.jobTitle ||
                "",
              level: exp.previousLevel || exp.level || "",
              department: exp.departmentName || exp.department || "",
              startDate:
                exp.start_date || exp.startDate
                  ? new Date(exp.start_date || exp.startDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              endDate:
                exp.end_date || exp.endDate
                  ? new Date(exp.end_date || exp.endDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              isCurrent: exp.is_current || exp.isCurrent || false,
              document_urls: exp.document_urls || [],
            }));

            setFormData((prev) => ({
              ...prev,
              workExperience:
                mappedWorkExp.length > 0 ? mappedWorkExp : prev.workExperience,
            }));
          }

          if (certifications && Array.isArray(certifications)) {
            console.log("Received certifications:", certifications);
            const mappedCerts = certifications.map((cert: any) => ({
              name: cert.name || "",
              issuingOrganization:
                cert.issuing_organization || cert.issuingOrganization || "",
              issueDate:
                cert.issue_date || cert.issueDate
                  ? new Date(cert.issue_date || cert.issueDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              expirationDate:
                cert.expiration_date || cert.expirationDate
                  ? new Date(cert.expiration_date || cert.expirationDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
              credentialId: cert.credential_id || cert.credentialId || "",
              credentialUrl: cert.credential_url || cert.credentialUrl || "",
              certificateDocument: cert.document_url
                ? Array.isArray(cert.document_url)
                  ? cert.document_url
                  : [cert.document_url]
                : cert.certificateDocument
                  ? Array.isArray(cert.certificateDocument)
                    ? cert.certificateDocument
                    : [cert.certificateDocument]
                  : [],
            }));

            setFormData((prev) => ({
              ...prev,
              certifications:
                mappedCerts.length > 0 ? mappedCerts : prev.certifications,
            }));
          }
        }
      } catch (error: any) {
        // If 404 or no data, user hasn't started onboarding - that's okay
        if (error?.response?.status !== 404) {
          console.error("Failed to fetch onboarding status:", error);
          if (loadingToast) toast.dismiss(loadingToast);
          toast.error("Failed to load saved data. Starting fresh.");
        } else {
          if (loadingToast) toast.dismiss(loadingToast);
        }
      } finally {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      }
    };

    fetchOnboardingStatus();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleNext = async () => {
    if (currentStep === STEPS.length) {
      navigate("/employee/dashboard");
      return;
    }

    if (!validateStep(currentStep)) {
      toast.error("Please fill in all required fields correctly");
      window.scrollTo(0, 0);
      return;
    }

    // Save data to backend before moving to next step
    setIsSaving(true);
    const loadingToast = toast.loading("Saving your information...");

    try {
      switch (currentStep) {
        case 1: // Personal Info
          await onboardingService.updatePersonalInfo({
            fullName: formData.fullName,
            gender: formData.gender,
            dateOfBirth: formData.dateOfBirth,
            tinNumber: formData.tinNumber || undefined,
            pensionNumber: formData.pensionNumber || undefined,
            placeOfWork: formData.placeOfWork || undefined,
          });
          toast.dismiss(loadingToast);
          toast.success("Personal information saved successfully");
          break;

        case 2: // Contact Info
          await onboardingService.updateContactInfo({
            region: formData.region || undefined,
            city: formData.city || undefined,
            subCity: formData.subCity || undefined,
            woreda: formData.woreda || undefined,
            phones: formData.phones.map((phone) => ({
              number: phone.number,
              type: phone.type || "Private",
              isPrimary: phone.isPrimary || false,
            })),
            emergencyContacts: formData.emergencyContacts.map((c) => ({
              fullName: c.fullName,
              relationship: c.relationship,
              phoneNumber: c.phoneNumber,
              email: c.email || undefined,
              isPrimary: c.isPrimary,
            })),
          });

          toast.dismiss(loadingToast);
          toast.success("Contact information saved successfully");
          break;

        case 3: // Financial Details
          await onboardingService.updateFinancialDetails({
            financialDetails: formData.financialDetails.map((fd) => ({
              bankId: fd.bankId,
              accountNumber: fd.accountNumber,
              accountHolderName: fd.accountHolderName,
              isPrimary: fd.isPrimary,
            })),
          });
          toast.dismiss(loadingToast);
          toast.success("Financial details saved successfully");
          break;

        case 4: // Education
          console.log("form data form onboarding", formData.education);
          await onboardingService.updateEducation({
            education: formData.education.map((edu) => {
              // Extract URLs from costSharingDocument array
              const costSharingUrls = (edu.costSharingDocument || [])
                .map((item: any) => {
                  if (typeof item === "string") return item;
                  return item.url || null;
                })
                .filter(Boolean);

              // Extract URLs from document_urls array
              const documentUrls = (edu.document_urls || [])
                .map((item: any) => {
                  if (typeof item === "string") return item;
                  return item.url || null;
                })
                .filter(Boolean);

              return {
                level: edu.level,
                fieldOfStudy: edu.fieldOfStudy,
                institution: edu.institution,
                programType: edu.programType,
                hasCostSharing: edu.hasCostSharing || false,
                costSharingDocumentNumber:
                  edu.costSharing?.documentNumber || undefined,
                costSharingIssueDate: edu.costSharing?.issueDate || undefined,
                costSharingTotalCost:
                  edu.costSharing?.declaredTotalCost || undefined,
                costSharingCurrency: edu.costSharing?.currency || "ETB",
                costSharingCommitmentType:
                  edu.costSharing?.commitmentType || undefined,
                costSharingRegulationReference:
                  edu.costSharing?.regulationReference || undefined,
                costSharingRemarks: edu.costSharing?.remarks || undefined,
                costSharingPaymentStatus:
                  edu.costSharing?.paymentStatus || undefined,
                costSharingDocument:
                  costSharingUrls.length > 0 ? costSharingUrls : undefined,
                costSharingDetails: edu.costSharingDetails || undefined,
                document_urls:
                  documentUrls.length > 0 ? documentUrls : undefined, // Include document_urls in payload
                start_date: edu.startDate ?? "",
                end_date: edu.endDate ?? "",
                startDate: edu.startDate ?? "",
                endDate: edu.endDate ?? "",
                is_current: edu.isCurrent || false,
                isCurrent: edu.isCurrent || false,
              };
            }),
          });
          toast.dismiss(loadingToast);
          toast.success("Education information saved successfully");
          break;

        case 5: // Work Experience
          await onboardingService.updateWorkExperience({
            workExperience: formData.workExperience.map((exp) => ({
              companyName: exp.companyName,
              position: exp.previousJobTitle || exp.jobTitle || undefined,
              employmentType: exp.employmentType || undefined,
              level: exp.level || undefined,
              department: exp.department || undefined,
              startDate: exp.startDate,
              endDate: exp.endDate || undefined,
              document_urls:
                (exp.document_urls
                  ?.map((item) => (typeof item === "string" ? item : item.url))
                  .filter(Boolean) as string[]) || undefined,
            })),
          });
          toast.dismiss(loadingToast);
          toast.success("Previous Work experience saved successfully");
          break;

        case 6: // Certifications
          await onboardingService.updateCertifications({
            certifications: formData.certifications.map((cert) => {
              // Extract URLs from certificateDocument array
              const certUrls = (cert.certificateDocument || [])
                .map((item: any) => {
                  if (typeof item === "string") return item;
                  return item.url || null;
                })
                .filter(Boolean);

              return {
                name: cert.name,
                issuingOrganization: cert.issuingOrganization || undefined,
                issueDate: cert.issueDate || undefined,
                expirationDate: cert.expirationDate || undefined,
                credentialId: cert.credentialId || undefined,
                credentialUrl: cert.credentialUrl || undefined,
                certificateDocument: certUrls.length > 0 ? certUrls : undefined,
              };
            }),
          });
          toast.dismiss(loadingToast);
          toast.success("Certifications saved successfully");
          break;

        case 7: // Documents
          const extractDocUrls = (items: any) => {
            if (!items) return undefined;
            if (Array.isArray(items)) {
              return items
                .map((item) => (typeof item === "string" ? item : item.url))
                .filter(Boolean) as string[];
            }
            return undefined;
          };

          await onboardingService.updateDocuments({
            documents: {
              cv: extractDocUrls(formData.documents.cv),
              nationalId: extractDocUrls(formData.documents.nationalId),
              guaranteeLetter: extractDocUrls(
                formData.documents.guaranteeLetter,
              ),
              medicalCertificate: extractDocUrls(
                formData.documents.medicalCertificate,
              ),
              policeCertificate: extractDocUrls(
                formData.documents.policeCertificate,
              ),
            },
          });
          toast.dismiss(loadingToast);
          toast.success("Documents saved successfully");
          break;

        case 8: // Signature
          console.log("Saving Signature...", formData.signature);
          await onboardingService.updateSignature({
            signature_url: formData.signature,
          });
          toast.dismiss(loadingToast);
          toast.success("Signature saved successfully");
          break;
      }

      // Move to next step
      if (currentStep < STEPS.length) {
        setCurrentStep((prev) => prev + 1);
        window.scrollTo(0, 0);
      }
    } catch (error: any) {
      console.error("Failed to save step:", error);
      toast.dismiss(loadingToast);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to save. Please try again.";
      toast.error(errorMessage);

      // Don't move to next step if save failed
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate first before setting loading state
    if (!validateStep(currentStep)) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    setIsSubmitting(true);
    const submittingToast = toast.loading("Submitting your application...");

    try {
      // Deep copy formData to avoid mutating state directly
      const submissionData = JSON.parse(JSON.stringify(formData));

      // Helper to extract URL from file item (files are already uploaded)
      const extractUrl = (item: FileItem | string | null): string | null => {
        if (!item) return null;
        if (typeof item === "string") return item;
        if (item.url) return item.url;
        // If file exists but no URL, it means upload failed - should not happen if validation works
        if (item.error) {
          throw new Error(
            `File "${item.name}" failed to upload: ${item.error}`,
          );
        }
        return null;
      };

      // 1. Extract URLs from Main Documents (files are already uploaded)
      const docFields = [
        "cv",
        "photo",
        "taxForms",
        "pensionForms",
        "nationalId",
        "guaranteeLetter",
        "medicalCertificate",
        "policeCertificate",
      ];

      docFields.forEach((field) => {
        if (
          formData.documents[field as keyof Documents] &&
          Array.isArray(formData.documents[field as keyof Documents]) &&
          (formData.documents[field as keyof Documents] as any[]).length > 0
        ) {
          (submissionData.documents as any)[field] = (
            formData.documents[field as keyof Documents] as any[]
          )
            .map(extractUrl)
            .filter((url): url is string => url !== null);
        }
      });

      // submissionData already contains correct document arrays at this point

      console.log("Submitting with Uploaded URLs:", submissionData);

      // Save documents to backend (completes onboarding)
      await onboardingService.updateDocuments({
        documents: {
          cv: submissionData.documents.cv,
          nationalId: submissionData.documents.nationalId,
          guaranteeLetter: submissionData.documents.guaranteeLetter,
          medicalCertificate: submissionData.documents.medicalCertificate,
          policeCertificate: submissionData.documents.policeCertificate,
          certificates: submissionData.documents.certificates,
          photo: submissionData.documents.photo,
          experienceLetters: submissionData.documents.experienceLetters,
          taxForms: submissionData.documents.taxForms,
          pensionForms: submissionData.documents.pensionForms,
        },
      });

      toast.dismiss(submittingToast);
      toast.success(
        "Application submitted successfully! Onboarding completed.",
      );

      try {
        sessionStorage.setItem("onboardingRedirectOverride", "1");
      } catch {
        // ignore
      }

      try {
        const meResponse = await api.get("/users/me");
        const payload: any = meResponse?.data;
        const user =
          payload?.data?.user || payload?.data || payload?.user || null;

        if (user) {
          dispatch(authActions.getMeSuccess(user));
        } else {
          dispatch(authActions.getMeRequest());
        }
      } catch {
        dispatch(authActions.getMeRequest());
      }

      // Navigate to waiting for approval page immediately
      navigate("/employee/waiting-approval", { replace: true });
    } catch (error: unknown) {
      console.error("Submission error:", error);
      toast.dismiss(submittingToast);
      const errorObj = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message =
        errorObj.response?.data?.message ||
        errorObj.message ||
        "Failed to submit application. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (section: string, data: unknown) => {
    setFormData((prev) => {
      // Support functional updates for concurrent operations (like parallel file uploads)
      const newValue =
        typeof data === "function"
          ? (data as Function)(prev[section as keyof typeof prev])
          : data;
      return {
        ...prev,
        [section]: newValue,
      };
    });
    setErrors({});
  };

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Modal handlers
  const handleAutoFill = (extractedData: ExtractedData) => {
    console.log("Auto-fill data received:", extractedData);

    setFormData((prev) => ({
      ...prev,
      fullName: extractedData.personalInfo?.fullName || prev.fullName,
      gender: extractedData.personalInfo?.gender || prev.gender,
      dateOfBirth: extractedData.personalInfo?.dateOfBirth || prev.dateOfBirth,
      tinNumber: extractedData.personalInfo?.tinNumber || prev.tinNumber,
      pensionNumber:
        extractedData.personalInfo?.pensionNumber || prev.pensionNumber,
      placeOfWork: extractedData.personalInfo?.placeOfWork || prev.placeOfWork,

      region: extractedData.contactInfo?.region || prev.region,
      city: extractedData.contactInfo?.city || prev.city,
      subCity: extractedData.contactInfo?.subCity || prev.subCity,
      woreda: extractedData.contactInfo?.woreda || prev.woreda,
      phones: extractedData.contactInfo?.phones?.length
        ? extractedData.contactInfo.phones
        : prev.phones,

      education: extractedData.education?.length
        ? extractedData.education
        : prev.education,
      workExperience: extractedData.workExperience?.length
        ? extractedData.workExperience
        : prev.workExperience,
      certifications: extractedData.certifications?.length
        ? extractedData.certifications
        : prev.certifications,

      documents: {
        ...prev.documents,
        ...(extractedData.documents || {}),
      },
    }));

    console.log("Form data updated with extracted information");
    setWizardStarted(true);
    setShowModal(false);
  };

  const handleManualStart = () => {
    setWizardStarted(true);
    setShowModal(false);
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  const showLoadingStatus = useMinimumDelay(isLoadingStatus, 800);

  // Redirect immediately if onboarding is completed (prevent flash)
  if (shouldRedirect) {
    return null;
  }

  // Show loading state while fetching onboarding status
  <div className="min-h-screen bg-k-light-grey flex items-center justify-center">
    <LoadingScreen />
  </div>;

  return (
    <>
      {/* Registration Modal */}
      <RegistrationModal
        isOpen={showModal && !wizardStarted}
        onClose={() => setShowModal(false)}
        onAutoFill={handleAutoFill}
        onManualStart={handleManualStart}
      />

      <div className="min-h-screen bg-k-light-grey py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-k-dark-grey">
              Employee Onboarding
            </h1>
            <p className="text-k-medium-grey mt-2">
              Please complete your profile information
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {/* Progress Line Background */}
              <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-0.75 bg-gray-200 z-10" />

              {/* Active Progress Line */}
              <div
                className="absolute left-0 top-4 transform -translate-y-1/2 h-0.75 bg-success transition-all duration-500 z-20"
                style={{
                  width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
                }}
              />

              {STEPS.map((step) => {
                const isCompleted = step.id < currentStep;
                const isCurrent = step.id === currentStep;

                return (
                  <div
                    key={step.id}
                    className="flex flex-col items-center cursor-pointer z-30"
                    onClick={() => {
                      if (isCompleted) setCurrentStep(step.id);
                    }}
                  >
                    {/* Circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                        isCompleted
                          ? "bg-success border-white"
                          : isCurrent
                            ? "bg-white border-k-orange"
                            : "bg-white border-gray-300"
                      }`}
                    >
                      {isCompleted ? (
                        <MdCheck className="w-5 h-5 text-white" />
                      ) : (
                        <span
                          className={`text-sm font-medium font-heading ${
                            isCurrent ? "text-k-orange" : "text-gray-500"
                          }`}
                        >
                          {step.id}
                        </span>
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                        isCurrent
                          ? "text-k-orange"
                          : isCompleted
                            ? "text-success"
                            : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-2xl shadow-card p-6 md:p-10 mb-8 animate-[slideUp_0.4s_ease-out]">
            <h2 className="text-2xl font-bold text-k-dark-grey mb-6 border-b pb-4 flex justify-between items-center">
              {STEPS[currentStep - 1].title}
              {Object.keys(errors).length > 0 && (
                <span className="text-error text-sm font-normal flex items-center gap-1">
                  <MdError /> Please fill in all required fields
                </span>
              )}
            </h2>

            <CurrentStepComponent
              formData={formData}
              handleChange={handleChange}
              updateFormData={updateFormData}
              errors={errors}
              onEditStep={(stepId: number) => {
                setCurrentStep(stepId);
                window.scrollTo(0, 0);
              }}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={currentStep === 1}
              icon={MdArrowBack}
            >
              Previous
            </Button>

            <Button
              variant="primary"
              onClick={currentStep === STEPS.length ? handleSubmit : handleNext}
              icon={currentStep === STEPS.length ? MdCheck : MdArrowForward}
              iconPosition="right"
              loading={
                (isSubmitting && currentStep === STEPS.length) ||
                (isSaving && currentStep !== STEPS.length) ||
                isLoadingStatus
              }
              disabled={isLoadingStatus}
            >
              {currentStep === STEPS.length
                ? "Finish"
                : currentStep === STEPS.length - 1
                  ? "Review and Submit"
                  : "Next Step"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
