// Types for pending users API response
import { EmployeeDetails, Role } from "../../Employees/slice/types";

export interface PendingUser {
  id: number;
  company_id: number;
  employee_id: string;
  email: string;
  role_id: number;
  is_active: boolean;
  onboarding_status: 'PENDING' | 'IN_PROGRESS';
  created_at: string;
  updated_at: string;
  employee: EmployeeDetails;
  role: Role;
}

export interface PendingUsersState {
  loading: boolean;
  error: string | null;
  users: PendingUser[];
}
