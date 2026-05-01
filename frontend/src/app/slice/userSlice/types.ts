// User Management Types

export interface Employee {
  id: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  tin_number?: string;
  pension_number?: string;
  place_of_work?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  action: string;
  resource: {
    id: number;
    code: string;
    name: string;
  };
}

export interface Company {
  id: number;
  name: string;
  company_code: string;
}

export interface User {
  id: number;
  email: string;
  role_id: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  employee?: Employee;
  role?: Role;
  company?: Company;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsersResponse {
  users: User[];
  pagination: Pagination;
}

export interface UserResponse {
  user: User;
}

export interface UserCountResponse {
  count: number;
}

// Request Types
export interface GetUsersParams {
  page?: number;
  limit?: number;
  role_id?: number;
  is_active?: boolean;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role_id: number;
  employee_id?: string;
  employee?: {
    employeeId: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
    tinNumber?: string;
    pensionNumber?: string;
    placeOfWork?: string;
  };
}

export interface UpdateUserRequest {
  email?: string;
  role_id?: number;
  is_active?: boolean;
}

export interface ChangePasswordRequest {
  new_password: string;
}

// State Types
export interface UserState {
  users: User[];
  currentUser: User | null;
  userCount: number | null;
  loading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  message: string;
  pagination: Pagination | null;
}

