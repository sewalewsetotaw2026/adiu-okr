export interface Department {
  id: number;
  name: string;
  department_code: string | null;
  head_user_id?: number | null;
  head?: {
    id: number;
    employee?: {
      full_name: string;
    };
  } | null;
}


export interface DepartmentsState {
  isLoading: boolean;
  departments: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  error: string | null;
}
