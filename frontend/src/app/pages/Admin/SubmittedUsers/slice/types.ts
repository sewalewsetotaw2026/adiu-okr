// Types for submitted users API response
import { EmployeeDetails, Role } from "../../Employees/slice/types";

export interface SubmittedUser {
  id: number;
  company_id: number;
  employee_id: string;
  email: string;
  role_id: number;
  is_active: boolean;
  onboarding_status: 'SUBMITTED';
  created_at: string;
  updated_at: string;
  employee: EmployeeDetails;
  role: Role;
}

export interface SubmittedUsersState {
  loading: boolean;
  error: string | null;
  users: SubmittedUser[];
  selectedUser: SubmittedUser | null;
  approving: boolean;
  rejecting: boolean;
}
