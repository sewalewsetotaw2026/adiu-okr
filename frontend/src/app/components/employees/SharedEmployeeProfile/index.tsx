import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
// Adjust paths as necessary
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout"; // Or wrapper logic
import Button from "../../Core/ui/Button";
import Card from "../../../components/Core/ui/Card";
import InfoGrid from "../../../components/Core/ui/InfoGrid";
import Info from "../../../components/Core/ui/Info";
import Badge from "../../../components/Core/ui/Badge";
import SalaryItem from "../../../components/Core/ui/SalaryItem";
import {
  FiUser,
  FiBriefcase,
  FiDollarSign,
  FiPhone,
  FiMapPin,
  FiBook,
  FiAward,
  FiFileText,
  FiDownload,
  FiCalendar,
  FiPrinter,
  FiCheck,
  FiEdit2,
  FiMail,
  FiTrendingUp,
  FiPenTool,
  FiShield,
} from "react-icons/fi";
import { MdArrowBack } from "react-icons/md";
import { useEmployeeDetailSlice } from "./slice";
import {
  selectEmployee,
  selectEmployeeLoading,
  selectUpdateSuccess,
  selectDetailsCache,
} from "./slice/selectors";

import StepPersonalInfo from "../../../components/employees/wizard/StepPersonalInfo";
import StepContactInfo from "../../../components/employees/wizard/StepContactInfo";
import EditEmploymentForm from "./EditEmploymentForm";
import StepEducation from "../../../components/employees/wizard/StepEducation";
import StepWorkExperience from "../../../components/employees/wizard/StepWorkExperience";
import StepCertifications from "../../../components/employees/wizard/StepCertifications";
import StepDocuments from "../../../components/employees/wizard/StepDocuments";
import StepSignature from "../../../components/employees/wizard/StepSignature";
import StepFinancialDetails from "../../../components/employees/wizard/StepFinancialDetails";
import CareerTimeline from "../../../components/Employee/CareerTimeline";
import apiRoutes from "../../../API/apiRoutes";
import makeCall from "../../../API";
import toast from "react-hot-toast";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import ProfilePictureUpload from "../../Employee/ProfilePictureUpload";
import { authActions } from "../../../slice/authSlice";
import { formatDate, formatIsoDate } from "../../../utils/dayjs-format";

const TABS = [
  { id: "personal", label: "Personal", icon: <FiUser /> },
  { id: "contact", label: "Contact", icon: <FiPhone /> },
  { id: "financial", label: "Financial", icon: <FiDollarSign /> },
  { id: "employment", label: "Employment", icon: <FiBriefcase /> },
  { id: "career", label: "Career Path", icon: <FiTrendingUp /> },
  { id: "probation", label: "Probation", icon: <FiShield /> },
  { id: "education", label: "Education", icon: <FiBook /> },
  {
    id: "experience",
    label: "Previous work experience",
    icon: <FiBriefcase />,
  },
  { id: "certifications", label: "Certifications", icon: <FiAward /> },
  { id: "documents", label: "Documents", icon: <FiFileText /> },
  { id: "signature", label: "Signature", icon: <FiPenTool /> },
];

interface SharedEmployeeProfileProps {
  viewMode: "admin" | "manager" | "employee";
  employeeId?: string; // Optional, can be derived from params or props
}

export default function SharedEmployeeProfile({
  viewMode,
  employeeId: propEmployeeId,
}: SharedEmployeeProfileProps) {
  const user = useSelector(selectAuthUser) as any;
  const { employeeId, id } = useParams<{
    employeeId?: string;
    id?: string;
  }>();
  // For 'employee' mode, we might not have ID in params if it is 'me', but ideally we pass it or fetch 'me'
  // But the slice is built around ID.
  // If 'employee' mode, we should fetch 'me' first and then populate ID, or use 'me' as ID for special handling?
  // The slice handles fetchEmployeeRequest.
  // Let's assume for 'employee' mode we handle "me" resolution or pass the ID prop.

  const resolvedEmployeeId = propEmployeeId || employeeId || id;

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions } = useEmployeeDetailSlice();

  const detailsCache = useSelector(selectDetailsCache);
  const cachedEmployee = resolvedEmployeeId
    ? detailsCache[resolvedEmployeeId]?.data
    : null;
  const reduxEmployee = useSelector(selectEmployee);
  const employee = reduxEmployee || cachedEmployee;

  const loading = useSelector(selectEmployeeLoading);
  const updateSuccess = useSelector(selectUpdateSuccess);
  // const error = useSelector(selectEmployeeError);

  const [activeTab, setActiveTab] = useState("personal");
  const [isFullView, setIsFullView] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [isCertificateLoading, setIsCertificateLoading] = useState(false);
  const [isResignationLoading, setIsResignationLoading] = useState(false);
  const [probationSaving, setProbationSaving] = useState(false);
  const [probationDate, setProbationDate] = useState("");

  const todayStr = formatIsoDate(new Date());

  const canEdit = viewMode === "admin" || viewMode === "employee";

  // For employee mode, we might need to fetch "me" ID first if not provided
  // But for now let's assume resolvedEmployeeId is available.
  // If use is accessing /employee/profile, we might need a wrapper that gets the ID.

  useEffect(() => {
    if (resolvedEmployeeId) {
      dispatch(actions.fetchEmployeeRequest(resolvedEmployeeId));
    }
    return () => {
      dispatch(actions.clearEmployee());
    };
  }, [resolvedEmployeeId, dispatch]);

  useEffect(() => {
    if (updateSuccess) {
      setIsEditing(false);
      if (resolvedEmployeeId) {
        dispatch(actions.fetchEmployeeRequest(resolvedEmployeeId));
      }
    }
  }, [updateSuccess, resolvedEmployeeId, dispatch]);

  const visibleTabs = TABS.filter((tab) => {
    if (!employee) return true; // Show all while loading initial structure
    switch (tab.id) {
      case "contact":
        return employee.addresses !== null || employee.phones !== null;
      case "financial":
        return employee.financialDetails !== null;
      case "employment":
        return employee.employments !== null;
      case "career":
        return employee.careerEvents !== null;
      case "probation":
        return viewMode === "admin" && employee.employments !== null;
      case "education":
        return employee.educations !== null;
      case "experience":
        return employee.employmentHistories !== null;
      case "certifications":
        return employee.licensesAndCertifications !== null;
      case "documents":
      case "signature":
        return true;
      default:
        return true;
    }
  });

  // If current tab is hidden, reset to 'personal'
  useEffect(() => {
    if (employee && !visibleTabs.find((t) => t.id === activeTab)) {
      setActiveTab("personal");
    }
  }, [employee, visibleTabs, activeTab]);

  // FORM MAPPING logic (Reuse from Admin/index.tsx)
  useEffect(() => {
    if (employee && !isEditing) {
      const mappedData = {
        // ... reuse exactly as in Admin/index.tsx ...
        // I will copy the exact mapping logic here
        // Personal
        fullName: employee.full_name,
        gender: employee.gender,
        dateOfBirth: employee.date_of_birth
          ? employee.date_of_birth.substring(0, 10)
          : "",
        tinNumber: employee.tin_number,
        pensionNumber: employee.pension_number,
        placeOfWork: employee.place_of_work,
        signature_url: employee.signature_url,

        // Contact
        region: employee.addresses?.[0]?.region || "",
        city: employee.addresses?.[0]?.city || "",
        subCity: employee.addresses?.[0]?.sub_city || "",
        woreda: employee.addresses?.[0]?.woreda || "",
        phones:
          employee.phones?.map((p: any) => ({
            id: p.id,
            number: p.phone_number,
            type: p.phone_type || "Mobile",
            isPrimary: p.is_primary,
          })) || [],
        phone:
          employee.phones?.find((p: any) => p.is_primary)?.phone_number ||
          employee.phones?.[0]?.phone_number ||
          "",

        // Emergency Contact
        emergencyContacts: (employee.emergencyContacts || []).map(
          (ec: any) => ({
            fullName: ec.full_name || ec.fullName || ec.name || "",
            relationship: ec.relationship || "",
            phoneNumber: ec.phone_number || ec.phoneNumber || "",
            email: ec.email || "",
            isPrimary: ec.is_primary || false,
          }),
        ),

        // Employment
        employee_id: employee.employee_id,
        title:
          typeof employee.job_title === "object"
            ? (employee.job_title as any)?.title ||
              (employee.job_title as any)?.name ||
              ""
            : employee.job_title || "",
        titleId:
          typeof employee.job_title === "object"
            ? (employee.job_title as any)?.id
            : undefined,
        level: employee.job_level || "",
        department:
          typeof employee.department === "object"
            ? (employee.department as any)?.name || ""
            : employee.department || "",
        departmentId:
          typeof employee.department === "object"
            ? (employee.department as any)?.id
            : undefined,
        employment_type: employee.employment_type,
        start_date: employee.start_date
          ? employee.start_date.substring(0, 10)
          : "",

        // Salary
        ...(() => {
          const activeEmployment =
            employee.employments?.find((e: any) => e.is_active) ||
            employee.employments?.[0];
          return {
            gross_salary:
              activeEmployment?.gross_salary || employee.salary?.gross || 0,
            basic_salary:
              activeEmployment?.basic_salary || employee.salary?.basic || 0,
            allowances:
              activeEmployment?.allowances?.map((a: any) => ({
                name: a.allowanceType?.name || "Unknown",
                amount: a.amount,
              })) || [],
          };
        })(),

        // Collections
        education: (employee.educations || []).map((edu: any) => ({
          ...edu,
          id: edu.id,
          level: edu.level,
          fieldOfStudy: edu.fieldOfStudy,
          institution: edu.institution,
          institutionCategory: edu.institutionCategory,
          programType: edu.programType || edu.program_type || "",
          startDate: edu.startDate
            ? String(edu.startDate).substring(0, 10)
            : "",
          endDate: edu.endDate ? String(edu.endDate).substring(0, 10) : "",
          hasCostSharing: edu.hasCostSharing ?? edu.has_cost_sharing ?? false,
          costSharing: {
            documentNumber: edu.costSharings?.[0]?.document_number || "",
            issuingInstitution:
              edu.costSharings?.[0]?.issuing_institution || "",
            issueDate: edu.costSharings?.[0]?.issue_date
              ? String(edu.costSharings[0].issue_date).substring(0, 10)
              : "",
            declaredTotalCost: edu.costSharings?.[0]?.declared_total_cost || "",
            currency: edu.costSharings?.[0]?.currency || "ETB",
            commitmentType: edu.costSharings?.[0]?.commitment_type || "",
            paymentStatus:
              edu.costSharings?.[0]?.payment_status ||
              edu.costSharings?.[0]?.paymentStatus ||
              "",
            regulationReference:
              edu.costSharings?.[0]?.regulation_reference || "",
            remarks: edu.costSharings?.[0]?.remarks || "",
          },
          costSharingDocument: (() => {
            const relDocs = edu.costSharings?.[0]?.document_urls || [];
            if (relDocs.length > 0)
              return relDocs.map((url: string) => ({ name: "Document", url }));

            const relDocUrl = edu.costSharings?.[0]?.document_url;
            if (relDocUrl) return [{ name: "Document", url: relDocUrl }];

            const directDocs = edu.costSharingDocument;
            if (Array.isArray(directDocs) && directDocs.length > 0) {
              return directDocs.map((doc: any) =>
                typeof doc === "string" ? { name: "Document", url: doc } : doc,
              );
            }
            if (typeof directDocs === "string" && directDocs)
              return [{ name: "Document", url: directDocs }];

            return [];
          })(),
          document: null,
          documentUrl: edu.documentUrl || edu.document_url,
          costSharingDocumentUrl: edu.costSharingDocumentUrl,
          document_urls: (edu.document_urls || []).map((url: string) => ({
            name: "Document",
            url,
          })),
          isCurrent: edu.isCurrent ?? edu.is_current ?? false,
        })),
        workExperience: (employee.employmentHistories || []).map(
          (exp: any) => ({
            ...exp,
            companyName: exp.previous_company_name || "",
            jobTitle: exp.previous_job_title || exp.jobTitle?.title || "",
            level: exp.previous_level || "",
            department: exp.department_name || "",
            startDate: exp.start_date
              ? String(exp.start_date).substring(0, 10)
              : "",
            endDate: exp.end_date ? String(exp.end_date).substring(0, 10) : "",
            isCurrent: exp.is_current || false,
            employmentType: exp.employment_type || "Full Time",
            document_urls: (exp.document_urls || []).map((url: string) => ({
              name: "Document",
              url,
            })),
            id: exp.id,
          }),
        ),

        certifications: (employee.licensesAndCertifications || []).map(
          (cert: any) => ({
            ...cert,
            name: cert.name || "",
            issuingOrganization: cert.issuing_organization || "",
            issueDate: cert.issue_date
              ? String(cert.issue_date).substring(0, 10)
              : "",
            expirationDate: cert.expiration_date
              ? String(cert.expiration_date).substring(0, 10)
              : "",
            credentialId: cert.credential_id || "",
            credentialUrl: cert.credential_url || "",
            documentUrl: cert.document_urls || [],
            certificateDocument:
              cert.document_urls && cert.document_urls.length > 0
                ? cert.document_urls.map((u: string) => ({
                    name: "Certificate",
                    url: u,
                  }))
                : cert.document_url
                  ? [{ name: "Certificate", url: cert.document_url }]
                  : [],
            id: cert.id,
          }),
        ),

        // Document Mapping Logic Reuse
        documents: {
          cv: (employee.documents?.cv || []).map((url: string) => ({
            name: "CV",
            url,
          })),
          nationalId: (employee.documents?.national_id || []).map(
            (url: string) => ({ name: "National ID", url }),
          ),
          guaranteeLetter: (employee.documents?.guarantee_letter || []).map(
            (url: string) => ({ name: "Guarantee Letter", url }),
          ),
          medicalCertificate: (
            employee.documents?.medical_certificate || []
          ).map((url: string) => ({ name: "Medical Certificate", url })),
          policeCertificate: (employee.documents?.police_certificate || []).map(
            (url: string) => ({ name: "Police Certificate", url }),
          ),
          certificates: (employee.documents?.certificates || []).map(
            (url: string) => ({ name: "Certificate", url }),
          ),
          photo: (employee.documents?.photo || []).map((url: string) => ({
            name: "Photo",
            url,
          })),
          experienceLetters: (employee.documents?.experienceLetters || []).map(
            (url: string) => ({ name: "Experience Letter", url }),
          ),
          taxForms: (employee.documents?.taxForms || []).map((url: string) => ({
            name: "Tax Form",
            url,
          })),
          pensionForms: (employee.documents?.pensionForms || []).map(
            (url: string) => ({ name: "Pension Form", url }),
          ),
        },
        // Financial Details Mapping
        financialDetails: (employee.financialDetails || []).map((fd: any) => ({
          bankId: fd.bank?.id || fd.bankId || "",
          bankName: fd.bank?.name || fd.bankName || "",
          accountNumber: fd.account_number || "",
          accountHolderName: fd.account_holder_name || "",
          isPrimary: fd.is_primary || false,
        })),
      };
      setFormData(mappedData);

      const activeEmployment =
        employee.employments?.find((e: any) => e.is_active) ||
        employee.employments?.[0];
      const currentProbationDate = activeEmployment?.probation_end_date
        ? formatIsoDate(activeEmployment.probation_end_date)
        : "";
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      const defaultFutureDate = formatIsoDate(ninetyDaysFromNow);
      setProbationDate(currentProbationDate || defaultFutureDate);
    }
  }, [employee, isEditing]);

  const handleSetProbationDate = async (dateValue: string | null) => {
    if (!employee?.id) return;
    try {
      setProbationSaving(true);
      await makeCall({
        route: apiRoutes.updateEmployment(employee.id),
        method: "PATCH",
        body: { probation_end_date: dateValue },
        isSecureRoute: true,
      });
      toast.success(
        dateValue
          ? "Employee has been placed on probation"
          : "Probation cleared successfully",
      );
      if (resolvedEmployeeId) {
        dispatch(actions.fetchEmployeeRequest(resolvedEmployeeId));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update probation status");
    } finally {
      setProbationSaving(false);
    }
  };

  const handleEndProbationNow = async () => {
    await handleSetProbationDate(null);
  };

  // ... (handleSave logic - mostly reusable, but need to check if Employee needs specific payload restrictions)
  // For now I'll copy the handleSave logic almost as is, but maybe wrap it to ensure permissions?
  // Admin slice updateEmployeeRequest uses specific endpoints.
  // If viewMode is Employee, we might need a different slice action or ensure the backend allows self-update via the same ID endpoint (it usually does if ACL allows UPDATE_OWN).
  // The backend ACL checks READ_OWN/UPDATE_OWN so using ID should work for self.

  // Entity Map logic ...
  const [deptMap, setDeptMap] = useState<Record<string, number>>({});
  const [jobMap, setJobMap] = useState<Record<string, number>>({});
  // ... (fetchEntities useEffect)
  useEffect(() => {
    // Fetch all departments and job titles to map names to IDs
    const fetchEntities = async () => {
      try {
        const [deptRes, jobRes] = await Promise.all([
          import("../../../API").then((mod) =>
            mod.default({
              route: apiRoutes.departments,
              method: "GET",
              isSecureRoute: true,
            }),
          ),
          import("../../../API").then((mod) =>
            mod.default({
              route: apiRoutes.jobTitles,
              method: "GET",
              isSecureRoute: true,
            }),
          ),
        ]);

        const extractArray = (payload: any, fallbackKeys: string[] = []) => {
          const root = payload?.data ?? payload;
          const candidate = root?.data ?? root;
          if (Array.isArray(candidate)) return candidate;
          for (const key of fallbackKeys) {
            const v = candidate?.[key] ?? root?.[key];
            if (Array.isArray(v)) return v;
          }
          return [];
        };

        const deptList = extractArray(deptRes, [
          "departments",
          "rows",
          "items",
        ]);
        if (deptList.length > 0) {
          const map: Record<string, number> = {};
          deptList.forEach((d: any) => {
            const name = d.name ?? d.department_name;
            if (name && d.id) map[String(name)] = Number(d.id);
          });
          setDeptMap(map);
        }

        const jobList = extractArray(jobRes, [
          "jobTitles",
          "job_titles",
          "rows",
          "items",
        ]);
        if (jobList.length > 0) {
          const map: Record<string, number> = {};
          jobList.forEach((j: any) => {
            const title = j.title ?? j.name;
            if (title && j.id) map[String(title)] = Number(j.id);
          });
          setJobMap(map);
        }
      } catch (e) {
        console.error("Failed to fetch entity maps", e);
      }
    };
    fetchEntities();
  }, []);

  const handleWizardChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const updates: any = { [field]: value };
      if (field === "department") updates.departmentId = deptMap[value];
      if (field === "title") updates.titleId = jobMap[value];
      return { ...prev, ...updates };
    });
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev: any) => {
      const newValue = typeof value === "function" ? value(prev[field]) : value;
      return { ...prev, [field]: newValue };
    });
  };

  const handleSave = () => {
    if (!employee || !formData) return;

    // ... (Mapping logic exactly as in Admin/index.tsx)
    // Map Wizard Form Data -> Redux/Backend Employee
    let submissionData: any = {};

    // ... Copying mapping blocks ...
    // Helper for phone validation
    const validatePhone = (phone: string) => {
      if (!phone) return "Phone number is required";
      const phoneRegex = /^(?:\+\d{7,15}|0\d{9}|251\d{9})$/;
      if (!phoneRegex.test(phone)) {
        return "Invalid phone number format. Must be like +1234567890, 0912345678, or 251912345678.";
      }
      return null;
    };

    if (activeTab === "personal") {
      if (!formData.fullName) {
        toast.error("Full Name is required");
        return;
      }
      if (formData.fullName.trim().split(/\s+/).length !== 3) {
        toast.error(
          "Full Name must contain exactly three words (First Middle Last)",
        );
        return;
      }
      if (!formData.gender) {
        toast.error("Gender is required");
        return;
      }
      if (!formData.dateOfBirth) {
        toast.error("Date of Birth is required");
        return;
      }
      if (!formData.tinNumber) {
        toast.error("Tin number is required");
        return;
      }
      if (formData.tinNumber && !/^\d{10}$/.test(formData.tinNumber)) {
        toast.error("TIN Number must be exactly 10 digits");
        return;
      }
      submissionData = {
        full_name: formData.fullName,
        gender: formData.gender,
        date_of_birth: formData.dateOfBirth,
        tin_number: formData.tinNumber,
        pension_number: formData.pensionNumber,
        place_of_work: formData.placeOfWork,
        documentUrl: formData.documentUrl,
      };
    } else if (activeTab === "contact") {
      // Validation
      const phones = formData.phones || [];
      if (phones.length === 0) {
        toast.error("At least one phone number is required");
        return;
      }
      for (const p of phones) {
        const err = validatePhone(p.number || p.phone_number);
        if (err) {
          toast.error(err);
          return;
        }
      }

      const emergencyContacts = formData.emergencyContacts || [];
      if (emergencyContacts.length === 0) {
        toast.error("At least one emergency contact is required");
        return;
      }

      for (const ec of emergencyContacts) {
        const name = ec.fullName || ec.full_name || ec.name;
        if (!name) {
          toast.error("Emergency Contact Name is required");
          return;
        }
        if (name.trim().split(/\s+/).length !== 3) {
          toast.error("Emergency Contact Name must be three words");
          return;
        }
        if (!ec.relationship) {
          toast.error("Emergency Contact Relationship is required");
          return;
        }
        const err = validatePhone(ec.phoneNumber || ec.phone_number);
        if (err) {
          toast.error(`Emergency Contact: ${err}`);
          return;
        }
      }

      submissionData = {
        email: formData.email,
        phones: phones.map((p: any) => ({
          id: p.id,
          phone_number: p.number || p.phone_number,
          type: p.type || "Mobile",
          is_primary: p.isPrimary,
        })),
        address: [
          {
            ...(employee.addresses?.[0]?.id
              ? { id: employee.addresses[0].id }
              : {}),
            region: formData.region,
            city: formData.city,
            sub_city: formData.subCity,
            woreda: formData.woreda,
          },
        ],
        emergencyContacts: emergencyContacts.map((ec: any) => ({
          id: ec.id, // Include ID if editing existing
          full_name: ec.fullName || ec.full_name || ec.name,
          relationship: ec.relationship,
          phone_number: ec.phoneNumber || ec.phone_number,
          email: ec.email,
          is_primary: ec.isPrimary,
        })),
      };
    } else if (activeTab === "financial") {
      if ((formData.financialDetails || []).length === 0) {
        toast.error("At least one bank account is required");
        return;
      }
      for (const fd of formData.financialDetails) {
        if (!fd.bankId) {
          toast.error("Bank is required");
          return;
        }
        if (!fd.accountNumber) {
          toast.error("Account Number is required");
          return;
        }
        if (!/^\d+$/.test(fd.accountNumber)) {
          toast.error("Account Number must be numeric");
          return;
        }
        if (!fd.accountHolderName) {
          toast.error("Account Holder Name is required");
          return;
        }
        if (fd.accountHolderName.trim().split(/\s+/).length !== 3) {
          toast.error(
            "Account Holder Name must contain exactly three words (First Middle Last)",
          );
          return;
        }
      }
      submissionData = {
        financialDetails: (formData.financialDetails || []).map((fd: any) => ({
          id: fd.id,
          bank_id: fd.bankId,
          account_number: fd.accountNumber,
          account_holder_name: fd.accountHolderName,
          is_primary: fd.isPrimary,
        })),
      };
    } else if (activeTab === "employment") {
      // ...
      submissionData = {
        job_title_id: formData.titleId ? String(formData.titleId) : undefined,
        job_title: formData.title,
        job_level: formData.level,
        department_id: formData.departmentId
          ? String(formData.departmentId)
          : undefined,
        department: formData.department,
        employment_type: formData.employment_type,
        start_date: formData.start_date,
        gross_salary: parseFloat(formData.gross_salary) || 0,
        basic_salary: parseFloat(formData.basic_salary) || 0,
        allowances: (formData.allowances || []).map((a: any) => ({
          name: a.name,
          amount: parseFloat(a.amount) || 0,
        })),
      };
    } else if (activeTab === "education") {
      for (const edu of formData.education || []) {
        if (!edu.level) {
          toast.error("Education Level is required");
          return;
        }
        if (!edu.fieldOfStudy) {
          toast.error("Field of Study is required");
          return;
        }
        if (!edu.institution) {
          toast.error("Institution is required");
          return;
        }
        if (!edu.programType) {
          toast.error("Program Type is required");
          return;
        }

        if (edu.hasCostSharing) {
          const hasDoc =
            edu.costSharingDocumentUrl ||
            (edu.costSharingDocument && edu.costSharingDocument.length > 0);
          if (!hasDoc && !edu.costSharingDetails && !edu.costSharing?.remarks) {
            if (!hasDoc && !edu.costSharingDetails) {
              toast.error("Cost Sharing Document or Details is required");
              return;
            }
          }
        }

        const hasDocs =
          (edu.document_urls && edu.document_urls.length > 0) ||
          edu.documentUrl;
        if (!hasDocs) {
          toast.error("Education Document (Degree/Certificate) is required");
          return;
        }
      }

      submissionData = {
        education: (formData.education || []).map((edu: any) => ({
          ...edu,
          id: edu.id,
          level: edu.level,
          fieldOfStudy: edu.fieldOfStudy,
          institution: edu.institution,
          institutionCategory: edu.institutionCategory,
          programType: edu.programType || "",
          startDate: edu.startDate,
          endDate: edu.endDate,
          is_current: edu.isCurrent || false,
          hasCostSharing: edu.hasCostSharing === true,
          costSharingDocumentUrl: edu.costSharingDocumentUrl,
          costSharingDocumentNumber: edu.costSharing?.documentNumber,
          costSharingIssuingInstitution: edu.costSharing?.issuingInstitution,
          costSharingIssueDate: edu.costSharing?.issueDate,
          costSharingTotalCost: edu.costSharing?.declaredTotalCost,
          costSharingRemarks: edu.costSharing?.remarks,
          currency: edu.costSharing?.currency,
          commitment_type: edu.costSharing?.commitmentType,
          regulation_reference: edu.costSharing?.regulationReference,
          documentUrl: edu.documentUrl,
          cost_sharing_document_url: (() => {
            const doc = edu.costSharingDocument;
            if (typeof doc === "string") return doc;
            if (Array.isArray(doc) && doc.length > 0)
              return doc[0].url || doc[0];
            return edu.costSharingDocumentUrl;
          })(),
          cost_sharing_document_urls: (() => {
            const doc = edu.costSharingDocument;
            if (Array.isArray(doc))
              return doc
                .map((d: any) => (typeof d === "string" ? d : d.url))
                .filter(Boolean);
            if (typeof doc === "string") return [doc];
            return edu.costSharingDocumentUrl
              ? [edu.costSharingDocumentUrl]
              : [];
          })(),
          costSharingDocumentUrls: edu.costSharingDocument, // Pass raw for saga processing
          document: edu.document,
          document_urls: edu.document_urls
            ?.map((d: any) => {
              if (typeof d === "string") return d;
              return d.url || "";
            })
            .filter(Boolean),
        })),
      };
    } else if (activeTab === "experience") {
      for (const exp of formData.workExperience || []) {
        if (!exp.companyName) {
          toast.error("Company Name is required");
          return;
        }
        if (!exp.startDate) {
          toast.error("Start Date is required");
          return;
        }
      }
      submissionData = {
        work_experience: (formData.workExperience || []).map((exp: any) => ({
          ...exp,
          id: exp.id,
          phone_number: exp.phone_number || "",
          company_name: exp.companyName,
          job_title: exp.jobTitle,
          job_level: exp.level,
          department: exp.department,
          employment_type: exp.employmentType,
          start_date: exp.startDate,
          end_date: exp.endDate,
          currentlyWorksHere: exp.isCurrent,
          document_urls:
            exp.document_urls
              ?.map((d: any) => (typeof d === "string" ? d : d.url))
              .filter(Boolean) || [],
        })),
      };
    } else if (activeTab === "certifications") {
      // ...
      submissionData = {
        certifications: (formData.certifications || []).map((cert: any) => {
          let docUrls: string[] = [];
          if (cert.certificateDocument) {
            const docs = cert.certificateDocument;
            if (Array.isArray(docs)) {
              docUrls = docs
                .map((d: any) =>
                  typeof d === "string" ? d : d.url || d.document_url || "",
                )
                .filter(Boolean);
            } else if (typeof docs === "string") {
              docUrls = [docs];
            } else if (docs.url || docs.document_url) {
              docUrls = [docs.url || docs.document_url];
            }
          }
          return {
            ...cert,
            id: cert.id,
            name: cert.name,
            issuing_organization: cert.issuingOrganization,
            issue_date: cert.issueDate,
            expiration_date: cert.expirationDate,
            credential_id: cert.credentialId,
            credentialUrl: cert.credentialUrl || "",
            documentUrl: docUrls[0] || "",
            document_urls: docUrls,
          };
        }),
      };
    } else if (activeTab === "certifications") {
      for (const cert of formData.certifications || []) {
        if (!cert.name) {
          toast.error("Certificate Name is required");
          return;
        }
      }
      submissionData = {
        certifications: (formData.certifications || []).map((cert: any) => {
          let docUrls: string[] = [];
          if (cert.certificateDocument) {
            const docs = cert.certificateDocument;
            if (Array.isArray(docs)) {
              docUrls = docs
                .map((d: any) =>
                  typeof d === "string" ? d : d.url || d.document_url || "",
                )
                .filter(Boolean);
            } else if (typeof docs === "string") {
              docUrls = [docs];
            } else if (docs.url || docs.document_url) {
              docUrls = [docs.url || docs.document_url];
            }
          }
          return {
            ...cert,
            id: cert.id,
            name: cert.name,
            issuing_organization: cert.issuingOrganization,
            issue_date: cert.issueDate,
            expiration_date: cert.expirationDate,
            credential_id: cert.credentialId,
            credentialUrl: cert.credentialUrl || "",
            documentUrl: docUrls[0] || "",
            document_urls: docUrls,
          };
        }),
      };
    } else if (activeTab === "signature") {
      if (!formData.signature_url) {
        toast.error("Signature is required");
        return;
      }
      submissionData = {
        signature_url: formData.signature_url,
      };
    } else if (activeTab === "documents") {
      const docs = formData.documents || {};
      const isValidFile = (files: any) =>
        files &&
        Array.isArray(files) &&
        files.some((item: any) => {
          if (typeof item === "string") return true;
          return (item.url || item.document_url) && !item.error;
        });

      if (!isValidFile(docs.cv)) {
        toast.error("CV/Resume is required");
        return;
      }
      if (!isValidFile(docs.nationalId || docs.national_id)) {
        toast.error("National ID is required");
        return;
      }
      if (!isValidFile(docs.guaranteeLetter || docs.guarantee_letter)) {
        toast.error("Guarantee Letter is required");
        return;
      }
      if (!isValidFile(docs.medicalCertificate || docs.medical_certificate)) {
        toast.error("Medical Certificate is required");
        return;
      }
      if (!isValidFile(docs.policeCertificate || docs.police_certificate)) {
        toast.error("Police Certificate is required");
        return;
      }

      const flatDocs: any[] = [];
      const docTypes = {
        cv: docs.cv,
        national_id: docs.nationalId || docs.national_id,
        guarantee_letter: docs.guaranteeLetter || docs.guarantee_letter,
        medical_certificate:
          docs.medicalCertificate || docs.medical_certificate,
        police_certificate: docs.policeCertificate || docs.police_certificate,
        tax_forms: docs.taxForms || docs.tax_forms,
        pension_forms: docs.pensionForms || docs.pension_forms,
      };
      Object.entries(docTypes).forEach(([type, items]: [string, any]) => {
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            flatDocs.push({
              type,
              file: item instanceof File ? item : undefined,
              url:
                item.url ||
                item.document_url ||
                (typeof item === "string" ? item : undefined),
              name: item.name || item.file_name,
            });
          });
        }
      });
      submissionData = { documents: flatDocs };
    }

    dispatch(
      actions.updateEmployeeRequest({
        id: employee.id,
        section: activeTab,
        ...submissionData,
      }),
    );
  };

  // Helper to check for blob error
  const checkBlobError = async (response: any) => {
    if (response instanceof Blob && response.type === "application/json") {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.status === "error" || json.message) {
          throw new Error(json.message || "Download failed");
        }
      } catch (e) {
        // ignore parse error, proceed as blob
        if (
          e instanceof Error &&
          e.message !== "Unexpected end of JSON input"
        ) {
          throw e;
        }
      }
    }
    return response;
  };

  const handleDownloadCertificate = async () => {
    if (!resolvedEmployeeId) return;
    try {
      setIsCertificateLoading(true);
      let response = await makeCall({
        route: apiRoutes.certificateOfService(resolvedEmployeeId),
        method: "GET",
        isSecureRoute: true,
        responseType: "blob",
      });

      // ... (existing blob check logic) ...
      const blobData = response instanceof Blob ? response : response.data;
      if (blobData instanceof Blob) await checkBlobError(blobData);

      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Certificate_of_Service_${employee.full_name}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Certificate of Service downloaded");
    } catch (error: any) {
      console.error("Download failed", error);
      toast.error(
        error.message ||
          "Failed to download Certificate of Service. Please try again.",
      );
    } finally {
      setIsCertificateLoading(false);
    }
  };

  const handleDownloadResignation = async () => {
    if (!resolvedEmployeeId) return;
    try {
      setIsResignationLoading(true);
      let response = await makeCall({
        route: apiRoutes.resignationLetter(resolvedEmployeeId),
        method: "GET",
        isSecureRoute: true,
        responseType: "blob",
      });

      const blobData = response instanceof Blob ? response : response.data;
      await checkBlobError(blobData);

      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Resignation_Letter_${employee.full_name}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Resignation Letter downloaded");
    } catch (error: any) {
      console.error("Download failed", error);
      toast.error(
        error.message ||
          "Failed to download Resignation Letter. Please try again.",
      );
    } finally {
      setIsResignationLoading(false);
    }
  };

  // Render Helper
  const normalizeExternalUrl = (url: string) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const ViewLink = ({
    url,
    label = "View",
  }: {
    url: string;
    label?: string;
  }) => {
    const href = normalizeExternalUrl(url);
    if (!href) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline font-medium"
      >
        {label}
      </a>
    );
  };

  const renderContent = (tabId: string = activeTab) => {
    if (isEditing && tabId === activeTab) {
      // Only allow editing for the currently ACTIVE tab even in full view?
      // Actually, if in full view, we probably shouldn't allow editing or should jump to that section.
      // For simplicity, if isEditing is true, we force the view to non-full view or we only render editing for the active section.
      // Let's assume edit mode forces 'Section View'. I'll handle that in the edit button click.
      const stepProps = {
        formData,
        handleChange: handleWizardChange,
        updateFormData,
        errors: {},
        // Special logic for Document Step if Employee Mode
        // We can pass `isEmployeeView={viewMode === 'employee'}` to StepDocuments if we update it
      };

      return (
        <Card
          title={`Edit ${TABS.find((t) => t.id === activeTab)?.label}`}
          className="border-primary border-2"
        >
          <div className="py-4">
            {activeTab === "personal" && <StepPersonalInfo {...stepProps} />}
            {activeTab === "contact" && <StepContactInfo {...stepProps} />}
            {activeTab === "employment" && (
              <EditEmploymentForm {...stepProps} />
            )}
            {activeTab === "financial" && (
              <StepFinancialDetails {...stepProps} />
            )}
            {activeTab === "education" && (
              <StepEducation
                {...stepProps}
                readOnlyExistingDocs={viewMode === "employee"}
              />
            )}
            {activeTab === "experience" && (
              <StepWorkExperience
                {...stepProps}
                readOnlyExistingDocs={viewMode === "employee"}
              />
            )}
            {activeTab === "certifications" && (
              <StepCertifications
                {...stepProps}
                readOnlyExistingDocs={viewMode === "employee"}
              />
            )}
            {activeTab === "documents" && (
              <StepDocuments
                {...stepProps}
                readOnlyExisting={viewMode === "employee"}
              />
            )}
            {activeTab === "signature" && (
              <StepSignature
                {...stepProps}
                formData={{
                  ...formData,
                  signature: formData.signature_url,
                }}
                handleChange={(field, value) => {
                  handleWizardChange(
                    field === "signature" ? "signature_url" : field,
                    value,
                  );
                }}
              />
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={loading}>
              Save Changes
            </Button>
          </div>
        </Card>
      );
    }

    // Read Mode
    const editAction = canEdit ? (
      <Button
        variant="outline"
        className="ml-auto"
        onClick={() => setIsEditing(true)}
        icon={FiEdit2}
      >
        Edit
      </Button>
    ) : null;

    // Render specific tab content (Switch/Case reused from Admin Page)
    // For brevity I will assume I paste the switch case here, adjusted for TSX.
    // For now, putting a placeholder for the logic I will insert in tool.
    // Switch Case for Tab Content
    switch (tabId) {
      case "personal":
        return (
          <Card
            title="Personal Information"
            icon={<FiUser />}
            action={editAction}
          >
            <InfoGrid>
              <Info label="Full Name" value={employee.full_name} />
              <Info label="Gender" value={employee.gender} />
              <Info
                label="Date of Birth (Gregorian)"
                value={
                  employee.date_of_birth
                    ? formatDate(employee.date_of_birth)
                    : "-"
                }
              />
              <Info label="TIN Number" value={employee.tin_number || "-"} />
              <Info
                label="Pension Number"
                value={employee.pension_number || "-"}
              />
              <Info
                label="Place of Work"
                value={employee.place_of_work || "-"}
              />
            </InfoGrid>
            {employee.signature_url && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Signature
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 inline-block">
                  <img
                    src={employee.signature_url}
                    alt="Signature"
                    className="h-20 w-auto object-contain mix-blend-multiply"
                  />
                </div>
              </div>
            )}
          </Card>
        );
      case "contact":
        return (
          <div className="space-y-6">
            <Card title="Address" icon={<FiMapPin />} action={editAction}>
              {employee.addresses?.[0] ? (
                <InfoGrid>
                  <Info label="Region" value={employee.addresses[0].region} />
                  <Info label="City" value={employee.addresses[0].city} />
                  <Info
                    label="Sub City"
                    value={employee.addresses[0].sub_city}
                  />
                  <Info label="Woreda" value={employee.addresses[0].woreda} />
                </InfoGrid>
              ) : (
                <p className="text-gray-500 italic">No address found.</p>
              )}
            </Card>
            <Card title="Phone Numbers" icon={<FiPhone />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employee.phones?.map((phone: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="font-medium text-gray-900">
                      {phone.phone_number}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500 capitalize">
                        {phone.phone_type || "Mobile"}
                      </span>
                      {phone.is_primary && (
                        <span className="text-primary font-medium">
                          • Primary
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {(!employee.phones || employee.phones.length === 0) && (
                <p className="text-gray-500 italic">No phone numbers.</p>
              )}
            </Card>
            <Card title="Emergency Contacts" icon={<FiUser />}>
              {employee.emergencyContacts?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employee.emergencyContacts.map(
                    (contact: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary shrink-0">
                          <FiUser className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <p className="font-bold text-gray-900 leading-tight">
                              {contact.full_name ||
                                contact.fullName ||
                                contact.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-500 capitalize">
                                {contact.relationship}
                              </p>
                              {(contact.is_primary || contact.isPrimary) && (
                                <Badge
                                  variant="success"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  Primary
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-50 space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <FiPhone className="w-4 h-4 text-gray-400" />
                              <span>
                                {contact.phone_number || contact.phoneNumber}
                              </span>
                            </div>
                            {contact.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <FiMail className="w-4 h-4 text-gray-400" />
                                <span className="truncate">
                                  {contact.email}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic">No emergency contacts.</p>
              )}
            </Card>
          </div>
        );
      case "employment":
        return (
          <div className="space-y-6">
            <Card
              title="Employment Details"
              icon={<FiBriefcase />}
              action={
                // Only Admin can see Career Event button and Edit button for employment
                viewMode === "admin" ? (
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant="outline"
                      className=""
                      onClick={() =>
                        resolvedEmployeeId &&
                        navigate(
                          `/admin/employees/${resolvedEmployeeId}/promote`,
                        )
                      }
                      icon={FiTrendingUp}
                    >
                      Career Event
                    </Button>
                    {editAction}
                  </div>
                ) : null
              }
            >
              <InfoGrid>
                <Info
                  label="Employee ID"
                  value={employee.employee_id || employee.id}
                />
                <Info label="Job Title" value={employee.job_title} />
                <Info label="Job Level" value={employee.job_level || "-"} />
                <Info label="Department" value={employee.department} />
                <Info
                  label="Employment Type"
                  value={employee.employment_type || "-"}
                />
                <Info
                  label="Start Date"
                  value={
                    employee.start_date ? formatDate(employee.start_date) : "-"
                  }
                />
              </InfoGrid>
            </Card>
            {(viewMode === "admin" || viewMode === "employee") && ( // Hide salary from Managers usually? Or show? Standard is Managers see salary of reports.
              <Card title="Salary Breakdown" icon={<FiDollarSign />}>
                {(() => {
                  const activeEmployment =
                    employee.employments?.find((e: any) => e.is_active) ||
                    employee.employments?.[0];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SalaryItem
                        label="Gross Salary"
                        amount={Number(activeEmployment?.gross_salary) || 0}
                        highlight
                      />
                      <SalaryItem
                        label="Basic Salary"
                        amount={Number(activeEmployment?.basic_salary) || 0}
                      />
                      {(activeEmployment?.allowances || []).map(
                        (allowance: any, idx: number) => (
                          <SalaryItem
                            key={idx}
                            label={allowance.allowanceType?.name || "Allowance"}
                            amount={Number(allowance.amount) || 0}
                          />
                        ),
                      )}
                      {(!activeEmployment?.allowances ||
                        activeEmployment.allowances.length === 0) && (
                        <div className="col-span-2 text-gray-400 text-sm italic">
                          No allowances configured.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>
        );
      case "financial":
        // Financials often sensitive. Verify if Managers should see it. Usually yes for direct reports?
        // Assuming yes based on current permissions.
        return (
          <Card
            title="Financial Details"
            icon={<FiDollarSign />}
            action={editAction}
          >
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
                  <FiDollarSign className="text-primary" /> Bank Accounts
                </h3>
                {employee.financialDetails?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employee.financialDetails.map((fd: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-200 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-primary">
                              <span className="text-xl font-bold">🏦</span>
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                                {fd.bankName || fd.bank?.name || "Unknown Bank"}
                              </p>
                              {fd.is_primary && (
                                <Badge variant="success" className="mt-1">
                                  Primary Account
                                </Badge>
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
                  <p className="text-gray-500 italic">
                    No bank accounts linked.
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> Tax & Pension
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
                      %
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase">
                        TIN Number
                      </p>
                      <p className="text-lg font-bold text-gray-900 font-mono">
                        {employee.tin_number || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xl font-bold">
                      ¶
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium uppercase">
                        Pension Number
                      </p>
                      <p className="text-lg font-bold text-gray-900 font-mono">
                        {employee.pension_number || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      case "career":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Career Path
                </h2>
                <p className="text-gray-500">
                  Track career progression and changes
                </p>
              </div>
              {resolvedEmployeeId && (
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={handleDownloadCertificate}
                    icon={FiDownload}
                    loading={isCertificateLoading}
                  >
                    Certificate of Service
                  </Button>
                  {viewMode === "admin" && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadResignation}
                      icon={FiDownload}
                      loading={isResignationLoading}
                    >
                      Work Experience (Resigned)
                    </Button>
                  )}
                </div>
              )}
            </div>
            <CareerTimeline
              events={employee.careerEvents || []}
              initialData={{
                job_title: employee.job_title,
                job_level: employee.job_level,
                department: employee.department,
                start_date: employee.start_date,
                gross_salary: (() => {
                  const active =
                    employee.employments?.find((e: any) => e.is_active) ||
                    employee.employments?.[0];
                  return active?.gross_salary || 0;
                })(),
              }}
            />
          </div>
        );
      case "probation": {
        const activeEmployment =
          employee.employments?.find((e: any) => e.is_active) ||
          employee.employments?.[0];
        const probationEndDate =
          activeEmployment?.probation_end_date ||
          (activeEmployment?.start_date
            ? new Date(
                new Date(activeEmployment.start_date).getTime() +
                  90 * 24 * 60 * 60 * 1000,
              )
            : null);
        const probationDateObj = probationEndDate
          ? new Date(probationEndDate)
          : null;
        const isOnProbation = probationDateObj
          ? probationDateObj >= new Date(`${todayStr}T00:00:00`)
          : false;

        const remainingDays = probationDateObj
          ? Math.max(
              0,
              Math.ceil(
                (probationDateObj.getTime() -
                  new Date(`${todayStr}T00:00:00`).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

        return (
          <Card title="Probation Management" icon={<FiShield />}>
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Current Status</p>
                <div className="flex items-center gap-3">
                  <Badge variant={isOnProbation ? "warning" : "success"}>
                    {isOnProbation ? "On Probation" : "Probation Ended"}
                  </Badge>
                  <span className="text-sm text-gray-700">
                    {probationDateObj
                      ? `Probation end date: ${formatDate(probationDateObj)}`
                      : "No probation end date set"}
                  </span>
                  {isOnProbation && (
                    <Badge variant="neutral" className="ml-auto">
                      {remainingDays} days remaining
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                onClick={handleEndProbationNow}
                loading={probationSaving}
                variant="outline"
              >
                End Probation Now
              </Button>

              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">
                  Add Back to Probation
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Probation End Date
                    </label>
                    <input
                      type="date"
                      value={probationDate}
                      min={todayStr}
                      onChange={(e) => setProbationDate(e.target.value)}
                      className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => handleSetProbationDate(probationDate)}
                    loading={probationSaving}
                    disabled={!probationDate || probationDate < todayStr}
                  >
                    Save Probation Date
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      }
      case "education":
        return (
          <Card title="Education" icon={<FiBook />} action={editAction}>
            <div className="space-y-4">
              {employee.educations?.map((edu: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">
                        {(typeof edu.fieldOfStudy === "string"
                          ? edu.fieldOfStudy
                          : edu.fieldOfStudy?.name) ||
                          edu.field_of_study ||
                          "Unknown Field of Study"}
                      </h3>
                      <p className="text-primary font-semibold">
                        {edu.institution || "Unknown Institution"}
                      </p>
                    </div>
                    <Badge variant="neutral" className="capitalize">
                      {edu.programType || edu.program_type || "Regular"}
                    </Badge>
                  </div>

                  <InfoGrid cols={3}>
                    <Info
                      label="Level"
                      value={edu.level || edu.educationLevel?.name || "-"}
                    />
                    <Info
                      label="Institution Type"
                      value={
                        edu.institutionCategory ||
                        edu.institution_category ||
                        "Unknown"
                      }
                    />
                    <Info
                      label="Period"
                      value={`${edu.start_date ? formatDate(edu.start_date) : "?"} - ${edu.is_current ? (edu.end_date ? `Expected: ${formatDate(edu.end_date)}` : "Present") : edu.end_date ? formatDate(edu.end_date) : "?"}`}
                    />
                  </InfoGrid>

                  {/* Cost Sharing Details */}
                  {(edu.has_cost_sharing || edu.hasCostSharing) && (
                    <div className="mt-4 p-4 bg-primary-light/30 border border-primary-light rounded-lg">
                      <div className="flex items-center gap-2 mb-3 text-primary-dark">
                        <FiFileText />
                        <span className="font-bold text-sm uppercase tracking-wider">
                          Cost Sharing Agreement
                        </span>
                      </div>
                      <InfoGrid cols={2} className="gap-y-3">
                        <Info
                          label="Document Number"
                          value={edu.costSharings?.[0]?.document_number || "-"}
                        />
                        <Info
                          label="Issue Date"
                          value={
                            edu.costSharings?.[0]?.issue_date
                              ? formatDate(edu.costSharings[0].issue_date)
                              : "-"
                          }
                        />
                        <Info
                          label="Total Cost"
                          value={`${edu.costSharings?.[0]?.declared_total_cost || "0"} ${edu.costSharings?.[0]?.currency || "ETB"}`}
                        />
                        <Info
                          label="Payment Status"
                          value={`${edu.costSharings?.[0]?.payment_status || ""}`}
                        />

                        <Info
                          label="Commitment"
                          value={
                            edu.costSharings?.[0]?.commitment_type?.replace(
                              /_/g,
                              " ",
                            ) || "-"
                          }
                        />
                        <Info
                          label="Regulation Ref"
                          value={
                            edu.costSharings?.[0]?.regulation_reference || "-"
                          }
                        />
                        <Info
                          label="Issuing Inst."
                          value={
                            edu.costSharings?.[0]?.issuing_institution || "-"
                          }
                        />
                        {edu.costSharings?.[0]?.remarks && (
                          <div className="md:col-span-2">
                            <p className="text-xs text-gray-400 font-medium uppercase mb-0.5">
                              Remarks
                            </p>
                            <p className="text-sm text-gray-700 italic">
                              "{edu.costSharings[0].remarks}"
                            </p>
                          </div>
                        )}
                      </InfoGrid>

                      {(edu.cost_sharing_document_url ||
                        edu.costSharings?.[0]?.document_url ||
                        (edu.costSharings?.[0]?.document_urls &&
                          edu.costSharings[0].document_urls.length > 0)) && (
                        <div className="mt-4 pt-3 border-t border-primary-light">
                          <div className="flex flex-wrap gap-2">
                            {(edu.costSharings?.[0]?.document_urls &&
                            edu.costSharings[0].document_urls.length > 0
                              ? edu.costSharings[0].document_urls
                              : [
                                  edu.cost_sharing_document_url ||
                                    edu.costSharings?.[0]?.document_url,
                                ]
                            )
                              .filter(Boolean)
                              .map((url: string, i: number) => (
                                <span
                                  key={i}
                                  className="text-xs flex items-center gap-2 bg-white border border-primary-light px-3 py-1.5 rounded-full shadow-sm w-fit"
                                >
                                  <FiFileText className="text-primary" />
                                  <span className="text-gray-700 font-medium">
                                    Agreement {i + 1}:
                                  </span>
                                  <ViewLink url={url} label="View" />
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
                    {Array.isArray(edu.document_urls) &&
                      edu.document_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-semibold text-gray-400 mr-1 uppercase">
                            Documents:
                          </span>
                          {edu.document_urls.map((doc: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm"
                            >
                              <FiFileText className="text-blue-500" />
                              <span className="text-gray-700 truncate max-w-25">
                                {doc.name || `Doc ${i + 1}`}
                              </span>
                              <ViewLink url={doc.url || doc} label="View Doc" />
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
              {(!employee.educations || employee.educations.length === 0) && (
                <p className="text-gray-500 italic">
                  No education details found.
                </p>
              )}
            </div>
          </Card>
        );
      case "experience":
        return (
          <Card
            title="Previous work experience"
            icon={<FiBriefcase />}
            action={editAction}
          >
            <div className="space-y-4">
              {employee.employmentHistories?.map(
                (history: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-5 bg-gray-50 rounded-xl border border-gray-100 relative"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {history.previous_company_name}
                        </h3>
                        <p className="text-primary font-semibold">
                          {history.previous_job_title_text ||
                            history.jobTitle?.title ||
                            "Unknown Position"}
                        </p>
                      </div>
                      <Badge variant="neutral">
                        {history.employment_type || "Full Time"}
                      </Badge>
                    </div>

                    <InfoGrid cols={2}>
                      <Info
                        label="Department"
                        value={history.department_name || "-"}
                      />
                      <Info
                        label="Level"
                        value={history.previous_level || "-"}
                      />
                      <Info
                        label="Period"
                        value={`${history.start_date ? formatDate(history.start_date) : "?"} - ${history.is_current ? "Present" : history.end_date ? formatDate(history.end_date) : "?"}`}
                      />
                    </InfoGrid>

                    {Array.isArray(history.document_urls) &&
                      history.document_urls.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 mr-1 uppercase self-center">
                            Evidence Documents:
                          </span>
                          {history.document_urls.map((doc: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm"
                            >
                              <FiFileText size={12} className="text-blue-500" />
                              <span className="truncate max-w-30">
                                {doc.name || `Record ${i + 1}`}
                              </span>
                              <ViewLink
                                url={doc.url || doc}
                                label="View Record"
                              />
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                ),
              )}
              {(!employee.employmentHistories ||
                employee.employmentHistories.length === 0) && (
                <p className="text-gray-500 italic">
                  No previous work experience found.
                </p>
              )}
            </div>
          </Card>
        );
      case "certifications":
        return (
          <Card title="Certifications" icon={<FiAward />} action={editAction}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.licensesAndCertifications?.map(
                (cert: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-5 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between h-full hover:shadow-sm transition-shadow"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-primary-light text-primary rounded-lg flex items-center justify-center shrink-0">
                          <FiAward size={20} />
                        </div>
                        <div className="flex gap-2">
                          {(cert.credentialUrl || cert.credential_url) && (
                            <ViewLink
                              url={cert.credentialUrl || cert.credential_url}
                              label="Verify Credential"
                            />
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 mt-3">
                        {cert.name}
                      </h3>
                      <p className="text-primary font-medium text-sm">
                        {cert.issuing_organization || cert.issuingOrganization}
                      </p>

                      {cert.credential_id && (
                        <p className="text-xs text-gray-500 mt-2 font-mono bg-white inline-block px-1.5 py-0.5 rounded border border-gray-100">
                          ID: {cert.credential_id}
                        </p>
                      )}
                    </div>

                    {((cert.document_urls && cert.document_urls.length > 0) ||
                      cert.document_url ||
                      cert.documentUrl) && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-400 mr-1 uppercase self-center">
                          Documents:
                        </span>
                        {(cert.document_urls && cert.document_urls.length > 0
                          ? cert.document_urls
                          : [cert.document_url || cert.documentUrl]
                        )
                          .filter(Boolean)
                          .map((doc: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm"
                            >
                              <FiFileText size={12} className="text-blue-500" />
                              <span className="truncate max-w-30">
                                {typeof doc === "string"
                                  ? `Doc ${i + 1}`
                                  : doc.name || `Doc ${i + 1}`}
                              </span>
                              <ViewLink url={doc.url || doc} label="View Doc" />
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="opacity-70" /> Issued:{" "}
                        {cert.issue_date ? formatDate(cert.issue_date) : "-"}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiCalendar className="opacity-70" /> Expires:{" "}
                        {cert.expiration_date
                          ? formatDate(cert.expiration_date)
                          : "No Expiry"}
                      </span>
                    </div>
                  </div>
                ),
              )}
              {(!employee.licensesAndCertifications ||
                employee.licensesAndCertifications.length === 0) && (
                <p className="text-gray-500 italic col-span-2 text-center py-8">
                  No certifications found.
                </p>
              )}
            </div>
          </Card>
        );
      case "documents":
        return (
          <Card
            title="Documents"
            icon={<FiFileText />}
            action={canEdit ? editAction : undefined}
          >
            <div className="space-y-2">
              {/* Reusing Admin logic manually since data shape is object in employee prop */}
              {(() => {
                const docs = employee.documents || {};
                const docLabels: Record<string, string> = {
                  cv: "Curriculum Vitae (CV)",
                  national_id: "National ID",
                  guarantee_letter: "Guarantee Letter",
                  medical_certificate: "Medical Certificate",
                  police_certificate: "Police / Forensic Certificate",
                  certificates: "Certificates",
                  photo: "Profile Photo",
                  experienceLetters: "Experience Letters",
                  taxForms: "Tax Forms",
                  pensionForms: "Pension Forms",
                };

                const renderDocRow = (key: string, items: any) => {
                  const list = Array.isArray(items)
                    ? items
                    : items
                      ? [items]
                      : [];
                  if (list.length === 0) return null;
                  const label =
                    docLabels[key] ||
                    key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase());

                  return (
                    <div
                      key={key}
                      className="p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                          <FiFileText />
                        </div>
                        <span className="font-medium text-gray-800">
                          {label}
                        </span>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {list.map((url: string, i: number) => (
                          <span
                            key={i}
                            className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full flex items-center gap-2"
                          >
                            Doc {i + 1}
                            <ViewLink url={url} />
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                };

                const entries = Object.entries(docs).filter(
                  ([key]) =>
                    ![
                      "id",
                      "employee_id",
                      "company_id",
                      "created_at",
                      "updated_at",
                    ].includes(key),
                );
                // Filter out empty arrays/nulls to see if any exist
                const hasDocs = entries.some(
                  ([_, v]) =>
                    (Array.isArray(v) && v.length > 0) ||
                    (typeof v === "string" && v),
                );

                if (!hasDocs) {
                  return (
                    <p className="text-gray-500 italic">
                      No documents uploaded.
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {entries
                      .sort((a, b) => {
                        const order = [
                          "cv",
                          "national_id",
                          "guarantee_letter",
                          "medical_certificate",
                          "police_certificate",
                        ];
                        const idxA = order.indexOf(a[0]);
                        const idxB = order.indexOf(b[0]);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a[0].localeCompare(b[0]);
                      })
                      .map(([key, value]) => renderDocRow(key, value))}
                  </div>
                );
              })()}
            </div>
          </Card>
        );
      case "signature":
        return (
          <Card title="Signature" icon={<FiPenTool />} action={editAction}>
            {employee.signature_url ? (
              <div className="flex justify-center p-6 bg-gray-50 rounded-xl border border-gray-100">
                <img
                  src={employee.signature_url}
                  alt="Signature"
                  className="max-h-40 w-auto object-contain mix-blend-multiply"
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 italic">
                No signature configured.
              </div>
            )}
          </Card>
        );
    }

    return null;
  };

  const isHR = user?.role?.name === "HR" || user?.role_name === "HR";
  const Layout = viewMode === "admin" || isHR ? AdminLayout : EmployeeLayout;

  if (loading && !employee)
    return (
      <Layout>
        <LoadingScreen />
      </Layout>
    );

  if (!employee)
    return (
      <Layout>
        <div className="p-8 text-center text-gray-500">Employee not found</div>
      </Layout>
    );

  const handleApprove = () => {
    if (resolvedEmployeeId)
      dispatch(actions.approveEmployeeRequest(resolvedEmployeeId));
  };

  const isPending = employee.onboarding_status !== "COMPLETED";
  const isPendingApproval = employee.onboarding_status === "PENDING_APPROVAL";

  const activeEmployment =
    employee.employments?.find((e: any) => e.is_active) ||
    employee.employments?.[0];
  const displayStatus = activeEmployment?.is_active ? "Active" : "Inactive";
  const displayDepartment =
    activeEmployment?.department?.name ||
    employee.department ||
    "No Department";
  const displayJobTitle =
    activeEmployment?.jobTitle?.title || employee.job_title || "No Job Title";
  const displayId = employee.employee_id || employee.id;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Back Link */}
        <div className="flex items-center justify-between print:hidden">
          {viewMode === "admin" ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <MdArrowBack /> <span>Back to Employees</span>
            </button>
          ) : viewMode === "manager" ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <MdArrowBack /> <span>Back to Team</span>
            </button>
          ) : (
            /* Placeholder for alignment if no back link */
            <div />
          )}

          {isFullView && (
            <button
              onClick={() => setIsFullView(false)}
              className="flex items-center gap-2 text-primary hover:text-primary-dark transition-colors font-medium"
            >
              <MdArrowBack /> Back to Section View
            </button>
          )}
        </div>

        {/* Wide Header Profile Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="shrink-0">
              <ProfilePictureUpload
                employeeId={employee.id}
                currentUrl={
                  employee.profile_picture_url || employee.profile_picture
                }
                isEditable={viewMode === "admin" || viewMode === "employee"}
                onUpdate={() => {
                  dispatch(actions.fetchEmployeeRequest(employee.id));
                  if (viewMode === "employee")
                    dispatch(authActions.getMeRequest());
                }}
                size="w-24 h-24"
              />
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Info */}
              <div className="space-y-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight uppercase">
                    {employee.full_name}
                  </h1>
                  <p className="text-gray-600 font-medium text-lg mt-1">
                    {displayJobTitle}{" "}
                    <span className="text-gray-300 mx-2">•</span>{" "}
                    <span className="text-gray-500">{displayDepartment}</span>
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FiMail className="w-4 h-4" />
                      <span>{employee.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiCalendar className="w-4 h-4" />
                    <span>
                      Joined{" "}
                      {employee.start_date
                        ? formatDate(employee.start_date)
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Badge
                    variant={
                      displayStatus === "Active"
                        ? "success"
                        : displayStatus === "Inactive"
                          ? "error"
                          : "warning"
                    }
                  >
                    {displayStatus}
                  </Badge>

                  {/* Onboarding Status Badge */}
                  {(employee.onboarding_status === "PENDING_APPROVAL" ||
                    employee.onboarding_status === "IN_PROGRESS") && (
                    <Badge variant="warning">
                      {employee.onboarding_status.replace("_", " ")}
                    </Badge>
                  )}

                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-mono">
                    {displayId}
                  </span>
                </div>
              </div>

              {/* Meta / Location / Actions */}
              <div className="flex flex-col justify-between items-start lg:items-end h-full gap-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <FiMapPin className="w-4 h-4" />
                  <span>
                    {employee.addresses?.[0]?.city || "Addis Ababa"},{" "}
                    {employee.addresses?.[0]?.country || "Ethiopia"}
                  </span>
                </div>

                <div className="flex gap-3 mt-auto">
                  {!isFullView && (
                    <Button
                      variant="outline"
                      className="h-9 px-3 text-sm font-medium"
                      onClick={() => setIsFullView(true)}
                    >
                      Full Page View
                    </Button>
                  )}
                  {isFullView && (
                    <Button
                      variant="secondary"
                      className="h-9 px-3 text-sm font-medium print:hidden"
                      onClick={() => window.print()}
                      icon={FiPrinter}
                    >
                      Print Page
                    </Button>
                  )}
                  {viewMode === "admin" && isPending && isPendingApproval && (
                    <Button
                      onClick={handleApprove}
                      icon={FiCheck}
                      variant="success"
                      loading={loading}
                      className="h-9 px-3 text-sm font-medium border-none"
                    >
                      Approve Onboarding
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* content Area */}
        {isFullView ? (
          <div className="space-y-8 animate-fade-in">
            {/* Render ALL sections manually or via loop */}
            {/* We need to temporarily force activeTab to render each, BUT renderContent relies on activeTab state.
                    Better approach: Refactor renderContent to accept 'tabId' prop, or duplicate logic for Full View.
                    Given complexity, let's create a helper 'renderSection(tabId)' and call it.
                */}
            {visibleTabs.map((tab) => {
              // Hacky: We need to set activeTab for renderContent to work if we don't refactor it.
              // But we can't change state in render.
              // Valid Plan: Refactor `renderContent` to take `currentTab` argument.
              // For this step I will assume I can update renderContent below.
              return (
                <div key={tab.id} id={tab.id}>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                    {tab.icon} {tab.label}
                  </h3>
                  {renderContent(tab.id)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-80 shrink-0 space-y-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsEditing(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-primary-light text-primary font-medium shadow-sm border-l-4 border-primary"
                      : "hover:bg-gray-50 text-gray-600 hover:pl-5"
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">{renderContent(activeTab)}</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
