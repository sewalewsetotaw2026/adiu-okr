import { Employee } from "../../slice/types";

export interface AssignManagerState {
  loading: boolean;
  error: string | null;

  // Manager Selection State
  managerSearchQuery: string;
  managerSuggestions: Employee[];
  existingManagers: Employee[];
  selectedManager: Employee | null;
}
