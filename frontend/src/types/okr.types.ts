/**
 * Central type definitions for the new OKR Execution module.
 *
 * IMPORTANT: These types intentionally mirror the new backend contracts.
 */

export type PlanStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

export type DailyStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type AdoptionMode = "direct" | "decomposed";

export interface ParentKRSummary {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  unit?: string;
}

export interface ParentMonthlySummary {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  month_number: 1 | 2 | 3;
}

export interface MonthlyPlan {
  id: string;
  parent_key_result_id: string;
  employee_kr_id?: string | number;
  owner_id: string;
  cycle_id: string;
  month_number: 1 | 2 | 3;
  title: string;
  description?: string;
  adoption_mode: AdoptionMode;
  weight_pct: number;
  start_value: number;
  target_value: number;
  current_value: number;
  progress_pct: number;
  final_score?: number;
  indirect_score?: number;
  contribute_to_score: boolean;
  contribute_to_value: boolean;
  plan_status: PlanStatus;
  submitted_at?: string;
  approved_at?: string;
  published_at?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  feedback_note?: string;
  rejection_reason?: string;
  reviewer_note?: string;
  metric_definition_id?: number;
  metricDefinition?: MetricDefinition;
  parent_key_result: ParentKRSummary;
  aligned_manager_plan_id?: string | number;
}

export interface WeeklyPlan {
  id: string;
  parent_monthly_id: string;
  owner_id: string;
  week_number: 1 | 2 | 3 | 4 | 5;
  title: string;
  adoption_mode: AdoptionMode;
  weight_pct: number;
  start_value: number;
  target_value: number;
  current_value: number;
  progress_pct: number;
  final_score?: number;
  indirect_score?: number;
  contribute_to_score: boolean;
  contribute_to_value: boolean;
  plan_status: PlanStatus;
  submitted_at?: string;
  approved_at?: string;
  published_at?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  feedback_note?: string;
  rejection_reason?: string;
  reviewer_note?: string;
  metric_definition_id?: number;
  metricDefinition?: MetricDefinition;
  parent_monthly_plan: ParentMonthlySummary;
  aligned_manager_plan_id?: string | number;
}

export interface DailyPlan {
  id: string;
  weekly_plan_id: string; // ONLY parent ref.
  owner_id: string;
  completion_day: DayOfWeek;
  title: string;
  start_value: number;
  target_value: number;
  current_value: number;
  progress_pct: number;
  final_score?: number;
  indirect_score?: number;
  status: DailyStatus;
  contribute_to_score: boolean;
  contribute_to_value: boolean;
  metric_definition_id?: number;
  metricDefinition?: MetricDefinition;
  notes?: string;
}

export interface AvailableWeight {
  allocated_pct: number;
  remaining_pct: number;
  parent_target_value?: number;
  allocated_target_value?: number;
  remaining_target_value?: number;
  months: {
    month_number: 1 | 2 | 3;
    allocated_pct: number;
    plan_id: string | null;
  }[];
  weeks?: {
    week_number: number;
    allocated_pct: number;
    plan_id: string | null;
  }[];
}

export type MetricCategory =
  | "NUMERIC"
  | "PERCENTAGE"
  | "CURRENCY"
  | "MILESTONE"
  | "RATING"
  | "CUSTOM";

export interface MetricDefinition {
  id: number;
  name: string;
  code: string;
  unit: string;
  unit_of_measure?: string;
  description?: string;
  category?: MetricCategory;
  allows_binary_completion?: boolean;
  requires_target_value?: boolean;
  value_based_progress?: boolean;
  supports_value_rollup?: boolean;
  supports_weighted_score?: boolean;
}

// ── Create DTOs ──────────────────────────────────────────────────────────

export interface CreateMonthlyPlanDTO {
  month_number: 1 | 2 | 3;
  adoption_mode: AdoptionMode;
  weight_pct: number;
  title: string;
  description?: string;
  metric_definition_id?: number;
  start_value?: number;
  target_value?: number;
  contribute_to_score?: boolean;
  contribute_to_value?: boolean;
  aligned_manager_plan_id?: string | number;
}

export interface CreateWeeklyPlanDTO {
  week_number: 1 | 2 | 3 | 4 | 5;
  adoption_mode: AdoptionMode;
  weight_pct: number;
  title: string;
  metric_definition_id?: number;
  start_value?: number;
  target_value?: number;
  contribute_to_score?: boolean;
  contribute_to_value?: boolean;
  aligned_manager_plan_id?: string | number;
}

export interface CreateDailyPlanDTO {
  completion_day: DayOfWeek;
  title: string;
  target_value?: number;
  start_value?: number;
  metric_definition_id?: number;
  contribute_to_score?: boolean;
  contribute_to_value?: boolean;
  description?: string;
}

export interface PlanSubmission {
  id: number;
  plan_type: "MONTHLY" | "WEEKLY";
  status: PlanStatus;
  employee_id: string;
  employee_name: string;
  avatar_url?: string;
  cycle_name?: string;
  week_number?: number;
  item_count: number;
  submitted_at: string;
  items: any[];
}

export interface SubmissionComment {
  id: number;
  submission_id?: number;
  item_id?: string;
  item_type?: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  comment: string;
  created_at: string;
}
