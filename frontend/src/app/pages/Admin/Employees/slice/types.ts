export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email?: string;
  gender: string;
  date_of_birth: string;
  tin_number?: string;
  pension_number?: string;
  place_of_work?: string;
  company_id?: string;
  // Account/Login info
  username?: string;
  role_id?: number;
  onboarding_status?: string;
  profile_picture_url?: string;
  role?: string;
  phone?: string;
  appUsers?: {
    email?: string;
    onboarding_status?: string;
    profile_picture_url?: string;
    role?: { name: string };
  }[];

  // Relations
  addresses?: EmployeeAddress[];
  phones?: EmployeePhone[];
  educations?: EmployeeEducation[];
  employments?: any[]; // Using any to avoid defining full Employment types for now, as we only need deep access
  employmentHistories?: EmployeeExperience[]; // Backend uses employmentHistories
  licensesAndCertifications?: EmployeeCertification[]; // Backend uses licensesAndCertifications
  documents?: EmployeeDocument[];
  careerEvents?: CareerEvent[];

  // Employment details that might be on the root or related
  department?: string; // from join
  job_title?: string; // from join
  job_level?: string;
  employment_type?: string;
  start_date?: string;
  probation_end_date?: string | null;
  salary?: EmployeeSalary;
  team_size?: number;
  manager?: {
    id: string;
    full_name: string;
  };

  emergencyContacts?: EmergencyContact[];
  financialDetails?: FinancialDetail[];
  created_at?: string;
  updated_at?: string;
}

export interface EmergencyContact {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
  isPrimary: boolean;
}

export interface FinancialDetail {
  id: string;
  bankId?: number;
  bankName?: string;
  accountHolderName?: string;
  accountNumber: string;
  iban?: string;
  swiftCode?: string;
  currency?: string;
  isPrimary: boolean;
  bank?: {
    id: number;
    name: string;
    swift_code?: string;
  };
}

export interface EmployeeAddress {
  id: string;
  region: string;
  city: string;
  sub_city: string;
  woreda: string;
  company_id: number;
  employee_id: string;
}

export interface EmployeePhone {
  id: string;
  phone_number: string;
  phone_type?: string; // Backend uses phone_type, frontend used to use type
  is_primary?: boolean;
  company_id: number;
  employee_id: string;
}

export interface EmployeeEducation {
  id: string;
  institution: { name: string; category?: string }; // Backend nested inclusion
  educationLevel: { name: string };
  fieldOfStudy: { name: string };
  program_type: string;
  has_cost_sharing?: boolean;
  cost_sharing_document?: string;
  cost_sharing_document_url?: string;
  start_date?: string;
  end_date?: string;
  document_url?: string;
  costSharings?: EmployeeCostSharing[];
}

export interface EmployeeCostSharing {
  id: number;
  document_number?: string;
  issuing_institution?: string;
  issue_date?: string;
  declared_total_cost?: number | string;
  currency?: string;
  document_url?: string;
  remarks?: string;
}

export interface EmployeeExperience {
  id: string;
  company_name: string;
  job_title: string;
  previous_job_title?: string; // Legacy support
  job_level?: string; // Backend uses job_level
  department?: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean; // Frontend logic usually computes this or backend check
  employment_type?: string;
  description?: string;
  reason_for_leaving?: string;
  document_url?: string;
}

export interface EmployeeDocument {
  id: string;
  document_type: string;
  document_url: string;
  file_name?: string;
  uploaded_at: string;
}

export interface EmployeeCertification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string;
  expiration_date?: string;
  credential_id?: string;
  credential_url?: string;
  document_url?: string;
}

export interface EmployeeSalary {
  gross: number;
  basic: number;
  housing: number;
  transport: number;
  meal: number;
  custom_allowances?: { name: string; amount: number }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EmployeeFilters {
  gender: string;
  department: string;
  job_title: string;
  job_level: string;
  sort_by: string;
  search: string;
  cost_sharing_status: string;
}

export interface EmployeesState {
  loading: boolean;
  error: string | null;

  // Separate caches for each tab
  active: {
    data: Employee[];
    pagination: Pagination;
    lastFetched: number | null;
    pages: Record<number, Employee[]>;
  };
  pending: {
    data: Employee[];
    pagination: Pagination;
    lastFetched: number | null;
    pages: Record<number, Employee[]>;
  };

  inprogress: {
    data: Employee[];
    pagination: Pagination;
    lastFetched: number | null;
    pages: Record<number, Employee[]>;
  };

  inactive: {
    data: Employee[];
    pagination: Pagination;
    lastFetched: number | null;
    pages: Record<number, Employee[]>;
  };

  probation: {
    data: Employee[];
    pagination: Pagination;
    lastFetched: number | null;
    pages: Record<number, Employee[]>;
  };

  selectedEmployee: Employee | null;
  detailsCache: Record<string, { data: Employee; lastFetched: number }>;
  filters: EmployeeFilters;
  activeTab: "active" | "pending" | "inprogress" | "inactive" | "probation";
  approveSuccess?: boolean;
  deleteSuccess?: boolean;
  activateSuccess?: boolean;
  exportSuccess?: boolean;
  globalTabCounts: {
    active: number;
    pending: number;
    inprogress: number;
    inactive: number;
    probation: number;
  };
  lastInvalidated: number | null;
}

export interface CareerEvent {
  id: number;
  event_date: string;
  effective_date: string;
  event_type: string;
  justification?: string;
  notes?: string;
  newJobTitle?: { title: string; level: string };
  previousJobTitle?: { title: string; level: string };
  newEmployment?: { department?: { name: string } };
  previousEmployment?: { department?: { name: string } };
  new_salary?: number | string;
  previous_salary?: number | string;
  department_changed?: boolean;
  document_urls?: string[];
  document_url?: string;
}
