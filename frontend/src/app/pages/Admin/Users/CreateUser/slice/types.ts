export interface CreateAccountState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export interface CreateAccountPayload {
  employee_id: string;
  email: string;
  password: string;
  role: string;
}

export interface CreateAccountResponse {
  status: string;
  message: string;
  data: {
    user: any;
    tempPassword?: string;
  };
}
