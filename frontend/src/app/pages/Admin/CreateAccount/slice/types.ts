export interface CreateAccountState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export interface EmploymentPayload {
  employmentType: string;
  grossSalary: number;
  basicSalary?: number;
  departmentId: number;
  jobTitleId: number;
  managerId?: string;
  startDate: string;
}

export interface EmployeePayload {
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  tinNumber?: string;
  pensionNumber?: string;
  employment?: EmploymentPayload;
}

export interface AllowancePayload {
  allowance_type_id: number;
  amount: number;
  currency?: string;
  effective_date: string;
}

export interface CreateAccountPayload {
  email: string;
  role: string;
  role_id?: number | string;
  employee: EmployeePayload;
  allowances?: AllowancePayload[];
}

export interface CreateAccountResponse {
  status: string;
  message: string;
  data: {
    user: any;
    tempPassword?: string;
  };
}
