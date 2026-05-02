export type ObjectiveStatus = "draft" | "published";

export interface CompanyObjective {
  id: number;
  title: string;
  description?: string;
  cycle_id: number;
  status: ObjectiveStatus;
  created_at?: string;
}

export interface CompanyObjectivesState {
  loading: boolean;
  error: string | null;
  objectives: CompanyObjective[];
  success: boolean;
}

export interface CreateCompanyObjectivePayload {
  title: string;
  description?: string;
  cycle_id: number;
  metric_definition_id: number;
  unit_of_measure: string;
  target_value: number;
}

export interface UpdateCompanyObjectivePayload {
  id: number;
  data: Partial<CreateCompanyObjectivePayload>;
  cycle_id: number;
}

export interface ObjectiveIdPayload {
  id: number;
  cycle_id: number;
}
