import { Employee } from '../../slice/types';

export interface EmployeeDetailState {
  loading: boolean;
  error: string | null;
  employee: Employee | null;
  detailsCache: Record<string, { data: Employee; lastFetched: number }>;
  approveSuccess: boolean;
  updateSuccess: boolean;
}
