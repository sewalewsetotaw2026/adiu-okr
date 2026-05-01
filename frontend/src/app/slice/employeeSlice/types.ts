// Employee Management Types

export interface Employee {
  id: string;
  company_id?: number;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  tin_number?: string;
  pension_number?: string;
  place_of_work?: string;
  signature_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeesResponse {
  employees: Employee[];
  pagination: Pagination;
}

export interface EmployeeResponse {
  employee: Employee;
}

export interface EmployeeCountResponse {
  count: number;
}

// Request Types
export interface GetEmployeesParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface CreateEmployeeRequest {
  id: string;
  full_name: string;
  gender: string;
  date_of_birth: string;
  tin_number?: string;
  pension_number?: string;
  place_of_work?: string;
}

export interface UpdateEmployeeRequest {
  full_name?: string;
  gender?: string;
  date_of_birth?: string;
  tin_number?: string;
  pension_number?: string;
  place_of_work?: string;
}

// State Types
export interface EmployeeState {
  employees: Employee[];
  currentEmployee: Employee | null;
  employeeCount: number | null;
  loading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  message: string;
  pagination: Pagination | null;
}

