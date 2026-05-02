export interface User {
  id: number;
  email: string;
  company_id: number;
  company_code?: string;
  role_id: number;
  role?: {
    id: number;
    name: string;
  };
  onboarding_status?: string;
  company: {
    company_code: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
  };
  is_department_head?: boolean;

  // Optional profile fields (often present in /users/me)
  full_name?: string;
  fullName?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  name?: string;
  employee_id?: string;
  employee?: any;
  permissions?: Record<string, Record<string, string>>;
}

export interface MeResponse {
  status: string;
  data:
  | {
    user?: User;
  }
  | User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  status: string;
  token: string;
  data: {
    user: User;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  status: string;
  message: string;
  resetToken?: string;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface ResetPasswordResponse {
  status: string;
  token: string;
  data: {
    user: User;
  };
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePasswordResponse {
  status: string;
  token: string;
  data: {
    user: User;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
  message: string;
}
