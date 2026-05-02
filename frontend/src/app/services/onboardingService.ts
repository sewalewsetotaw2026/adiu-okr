import api from "./api";
import apiRoutes from "../API/apiRoutes";

interface PersonalInfoData {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  tinNumber?: string;
  pensionNumber?: string;
  placeOfWork?: string;
  signature_url?: string;
}

interface Phone {
  number: string;
  type?: string;
  isPrimary?: boolean;
}

interface EmergencyContact {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
  isPrimary?: boolean;
}

interface ContactInfoData {
  region?: string;
  city?: string;
  subCity?: string;
  woreda?: string;
  phones: Phone[];
  emergencyContacts?: EmergencyContact[];
}

interface FinancialDetailData {
  bankId: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary?: boolean;
}

interface EducationData {
  level: string;
  fieldOfStudy: string;
  institution: string;
  programType: string;
  hasCostSharing?: boolean;
  costSharingDocument?: string[];
  costSharingDocumentNumber?: string;
  costSharingIssueDate?: string;
  costSharingTotalCost?: string | number;
  costSharingCurrency?: string;
  costSharingCommitmentType?: string;
  costSharingRegulationReference?: string;
  costSharingRemarks?: string;
  costSharingPaymentStatus?: string;
  document_urls?: string[];
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

interface WorkExperienceData {
  companyName: string;
  position?: string;
  level?: string;
  department?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

interface CertificationData {
  name: string;
  issuingOrganization?: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  certificateDocument?: string[];
}

interface DocumentsData {
  cv?: string[];
  certificates?: string[];
  photo?: string[];
  experienceLetters?: string[];
  taxForms?: string[];
  pensionForms?: string[];
  nationalId?: string[];
  guaranteeLetter?: string[];
  medicalCertificate?: string[];
  policeCertificate?: string[];
}

interface OnboardingStatusResponse {
  status: string;
  data: {
    onboarding_status: string;
    employee?: any;
    contact?: any;
    financialDetails?: any[];
    education?: any[];
    workExperience?: any[];
    certifications?: any[];
    documents?: any;
  };
}

const onboardingService = {
  /**
   * Get current onboarding status and saved data
   */
  getStatus: async (): Promise<OnboardingStatusResponse> => {
    const response = await api.get(apiRoutes.onboardingStatus);
    return response.data;
  },

  /**
   * Step 1: Update personal information
   */
  updatePersonalInfo: async (data: PersonalInfoData) => {
    const response = await api.patch(apiRoutes.onboardingPersonalInfo, data);
    return response.data;
  },

  /**
   * Step 2: Update contact information
   */
  updateContactInfo: async (data: ContactInfoData) => {
    const response = await api.patch(apiRoutes.onboardingContactInfo, data);
    return response.data;
  },

  /**
   * Step 3: Update education
   */

  updateEducation: async (data: { education: EducationData[] }) => {
    console.log("the onboarding education payload", data);
    const response = await api.patch(apiRoutes.onboardingEducation, data);
    return response.data;
  },

  /**
   * Step 4: Update work experience
   */
  updateWorkExperience: async (data: {
    workExperience: WorkExperienceData[];
  }) => {
    const response = await api.patch(apiRoutes.onboardingWorkExperience, data);
    return response.data;
  },

  /**
   * Step 5: Update certifications
   */
  updateCertifications: async (data: {
    certifications: CertificationData[];
  }) => {
    const response = await api.patch(apiRoutes.onboardingCertifications, data);
    return response.data;
  },
  /**
   * Step 6: Update documents (completes onboarding)
   */
  updateDocuments: async (data: {
    documents: DocumentsData;
    isFinal?: boolean;
  }) => {
    const response = await api.patch(apiRoutes.onboardingDocuments, data);
    return response.data;
  },

  /**
   * Step 3 (New): Update financial details
   */
  updateFinancialDetails: async (data: {
    financialDetails: FinancialDetailData[];
  }) => {
    const response = await api.patch(
      apiRoutes.onboardingFinancialDetails,
      data,
    );
    return response.data;
  },

  /**
   * Step 8 (New): Update Signature
   */
  updateSignature: async (data: { signature_url: string }) => {
    const response = await api.patch(apiRoutes.onboardingSignature, data);
    return response.data;
  },

  getSignature: async () => {
    const response = await api.get(apiRoutes.onboardingSignature);
    return response.data;
  },
};

export default onboardingService;
export type {
  PersonalInfoData,
  ContactInfoData,
  EducationData,
  WorkExperienceData,
  CertificationData,
  DocumentsData,
  OnboardingStatusResponse,
  FinancialDetailData,
};
