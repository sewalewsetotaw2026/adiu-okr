// Employment Management Types

export interface Department {
  id: number;
  name: string;
  company_id?: number;
}

export interface JobTitle {
  id: number;
  title: string;
  level: string;
  company_id?: number;
}

export interface Employment {
  id: number;
  employee_id: string;
  company_id?: number;
  department_id: number;
  job_title_id: number;
  manager_id?: string;
  employment_type: string;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  employee?: {
    id: string;
    full_name: string;
  };
  department?: Department;
  jobTitle?: JobTitle;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmploymentsResponse {
  employments: Employment[];
  pagination: Pagination;
}

export interface EmploymentResponse {
  employment: Employment;
}

export interface CountResponse {
  count: number;
}

export interface DistributionResponse {
  [key: string]: number;
}

// Request Types
export interface GetEmploymentsParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface CreateEmploymentRequest {
  employee_id: string;
  department_id: number;
  job_title_id: number;
  manager_id?: string;
  employment_type: string;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

export interface UpdateEmploymentRequest {
  department_id?: number;
  job_title_id?: number;
  manager_id?: string;
  employment_type?: string;
  end_date?: string | null;
  is_active?: boolean;
}

// State Types
export interface EmploymentState {
  employments: Employment[];
  currentEmployment: Employment | null;
  employmentCount: number | null;
  activeEmploymentCount: number | null;
  inactiveEmploymentCount: number | null;
  managersCount: number | null;
  genderDistribution: DistributionResponse | null;
  managerDistribution: DistributionResponse | null;
  jobDistribution: DistributionResponse | null;
  departmentDistribution: DistributionResponse | null;
  employmentTypeDistribution: DistributionResponse | null;
  loading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  message: string;
  pagination: Pagination | null;
}

