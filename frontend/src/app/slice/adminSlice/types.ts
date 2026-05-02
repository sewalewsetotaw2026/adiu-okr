// Admin Management Types (Roles, Departments, Job Titles, Statistics)

export interface Role {
  id: number;
  company_id?: number;
  name: string;
  description?: string;
}

export interface Department {
  id: number;
  company_id?: number;
  name: string;
}

export interface JobTitle {
  id: number;
  company_id?: number;
  title: string;
  level: string;
}

export interface RolesResponse {
  roles: Role[];
}

export interface DepartmentsResponse {
  departments: Department[];
}

export interface JobTitlesResponse {
  jobTitles: JobTitle[];
}

export interface DepartmentResponse {
  department: Department;
}

export interface JobTitleResponse {
  jobTitle: JobTitle;
}

export interface CountResponse {
  count: number;
}

// Request Types
export interface CreateDepartmentRequest {
  name: string;
}

export interface CreateJobTitleRequest {
  title: string;
  level: string;
}

// State Types
export interface AdminState {
  roles: Role[];
  departments: Department[];
  jobTitles: JobTitle[];
  departmentCount: number | null;
  loading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  message: string;
}

