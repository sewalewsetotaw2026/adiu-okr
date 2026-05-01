import { Employee } from "../../Employees/slice/types";

export interface ManagerListState {
  loading: boolean;
  error: string | null;
  managers: Employee[];
  selectedManager: Employee | null;
  directReports: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string;
    department: string;
    job_title: string;
    job_level: string;
  };
  lastFetched: number | null;
  pages: Record<number, Employee[]>;
  directReportsCache: Record<string, { data: Employee[]; lastFetched: number }>;
}
