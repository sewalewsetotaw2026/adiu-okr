import { Employee, Pagination, EmployeeFilters } from "../../slice/types";

export interface BuildTeamState {
  loading: boolean;
  error: string | null;
  employees: Employee[]; // List of potential subordinates
  pagination: Pagination;
  filters: EmployeeFilters;

  // Manager State
  selectedManager: Employee | null;

  // Subordinate Selection State
  selectedSubordinateIds: string[];

  // UI State
  assignSuccess: boolean;

  // Cache for existing team details (to show in right panel even if not in current page)
  existingTeam: Employee[];
}
