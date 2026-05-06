/**
 * Centralized OKR Execution API client.
 *
 * Wraps the new backend planning endpoints (mounted at /api/v1/okr).
 * The legacy department/employee plan endpoints are NOT used here.
 * Anything in this file is the single source of truth for monthly,
 * weekly, and daily plan calls.
 */

import makeCall from "../API";

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL.",
  );
}

const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
const OKR = `${BASE_URL}/okr`;

import type {
  AdoptionMode,
  AvailableWeight,
  CreateDailyPlanDTO,
  CreateMonthlyPlanDTO,
  CreateWeeklyPlanDTO,
  DailyPlan,
  DailyStatus,
  DayOfWeek,
  MonthlyPlan,
  WeeklyPlan,
  PlanSubmission,
  SubmissionComment,
  MetricDefinition,
} from "../../types/okr.types";

// Backend wraps payloads as { status: "success", data: T }. Unwrap here.
async function unwrap<T>(promise: Promise<{ data: any }>): Promise<T> {
  const res = await promise;
  // Backend convention: res.data is the axios body. Some endpoints
  // return { data: T } directly, others wrap as { status, data: T }.
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeAdoptionMode = (value: unknown): AdoptionMode => {
  return String(value || "DECOMPOSED").toUpperCase() === "DIRECT"
    ? "direct"
    : "decomposed";
};

const normalizeMonthlyPlan = (plan: any): MonthlyPlan => ({
  ...plan,
  id: String(plan.id),
  parent_key_result_id: String(
    plan.parent_key_result_id ?? plan.employee_kr_id ?? "",
  ),
  cycle_id: String(plan.cycle_id ?? ""),
  month_number: Number(plan.month_number) as MonthlyPlan["month_number"],
  adoption_mode: normalizeAdoptionMode(plan.adoption_mode),
  weight_pct: toNumber(plan.weight_pct),
  start_value: toNumber(plan.start_value),
  target_value: toNumber(plan.target_value),
  current_value: toNumber(plan.current_value),
  progress_pct: toNumber(plan.progress_pct),
  indirect_score: toNumber(plan.indirect_score),
  parent_key_result: plan.parent_key_result ?? plan.employeeKr,
});

const normalizeWeeklyPlan = (plan: any): WeeklyPlan => ({
  ...plan,
  id: String(plan.id),
  parent_monthly_id: String(
    plan.parent_monthly_id ?? plan.employee_month_plan_id ?? "",
  ),
  week_number: Number(plan.week_number) as WeeklyPlan["week_number"],
  adoption_mode: normalizeAdoptionMode(plan.adoption_mode),
  weight_pct: toNumber(plan.weight_pct),
  start_value: toNumber(plan.start_value),
  target_value: toNumber(plan.target_value),
  current_value: toNumber(plan.current_value),
  progress_pct: toNumber(plan.progress_pct),
  indirect_score: toNumber(plan.indirect_score),
  parent_monthly_plan: plan.parent_monthly_plan ?? plan.monthPlan,
});

const normalizeAvailableWeight = (data: any): AvailableWeight => ({
  allocated_pct: toNumber(data?.allocated_pct ?? data?.allocatedPct),
  remaining_pct: toNumber(data?.remaining_pct ?? data?.remainingPct),
  parent_target_value: data?.parent_target_value != null ? toNumber(data.parent_target_value) : undefined,
  allocated_target_value: data?.allocated_target_value != null ? toNumber(data.allocated_target_value) : undefined,
  remaining_target_value: data?.remaining_target_value != null ? toNumber(data.remaining_target_value) : undefined,
  months: Array.isArray(data?.months)
    ? data.months.map((month: any) => ({
        month_number: Number(month.month_number) as 1 | 2 | 3,
        allocated_pct: toNumber(month.allocated_pct ?? month.weight_pct),
        plan_id:
          month.plan_id !== null && month.plan_id !== undefined
            ? String(month.plan_id)
            : month.id !== null && month.id !== undefined
              ? String(month.id)
              : null,
      }))
    : [],
});

// ── MONTHLY ─────────────────────────────────────────────────────────────

export async function fetchMonthlyPlans(krId: string): Promise<MonthlyPlan[]> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/key-results/${krId}/monthly-plans`,
      method: "GET",
    }),
  );
  const plans = Array.isArray(data) ? data : data?.plans ?? [];
  return plans.map(normalizeMonthlyPlan);
}

export async function fetchMonthlyAvailableWeight(
  krId: string,
): Promise<AvailableWeight> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/key-results/${krId}/monthly-plans/available-weight`,
      method: "GET",
    }),
  );
  return normalizeAvailableWeight(data);
}

export async function fetchManagerMonthlyPlans(
  monthNumber: number,
  cycleId: string,
): Promise<MonthlyPlan[]> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/manager/monthly-plans`,
      method: "GET",
      query: { monthNumber, cycleId },
    }),
  );
  return (Array.isArray(data) ? data : []).map(normalizeMonthlyPlan);
}

export async function createMonthlyPlan(
  krId: string,
  dto: CreateMonthlyPlanDTO,
): Promise<MonthlyPlan> {
  const plan = await unwrap<any>(
    makeCall({
      route: `${OKR}/key-results/${krId}/monthly-plans`,
      method: "POST",
      body: dto,
    }),
  );
  return normalizeMonthlyPlan(plan);
}

export async function updateMonthlyPlan(
  id: string,
  dto: { 
    title?: string; 
    description?: string;
    metric_definition_id?: number;
    start_value?: number;
    target_value?: number;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
  },
): Promise<MonthlyPlan> {
  const plan = await unwrap<any>(
    makeCall({
      route: `${OKR}/monthly-plans/${id}`,
      method: "PUT",
      body: dto,
    }),
  );
  return normalizeMonthlyPlan(plan);
}

export async function deleteMonthlyPlan(id: string): Promise<void> {
  await makeCall({
    route: `${OKR}/monthly-plans/${id}`,
    method: "DELETE",
  });
}

export async function submitMonthlyPeriod(
  monthNumber: number,
  cycleId: string,
): Promise<void> {
  await makeCall({
    route: `${OKR}/monthly-plans/submit-period`,
    method: "POST",
    body: { month_number: monthNumber, cycle_id: cycleId },
  });
}

export async function approveMonthlyPeriod(payload: object): Promise<void> {
  await makeCall({
    route: `${OKR}/monthly-plans/approve-period`,
    method: "POST",
    body: payload,
  });
}

export async function rejectMonthlyPeriod(payload: object): Promise<void> {
  await makeCall({
    route: `${OKR}/monthly-plans/reject-period`,
    method: "POST",
    body: payload,
  });
}

export async function publishMonthlyPeriod(
  monthNumber: number,
  cycleId: string,
): Promise<void> {
  await makeCall({
    route: `${OKR}/monthly-plans/publish-period`,
    method: "POST",
    body: { month_number: monthNumber, cycle_id: cycleId },
  });
}

// ── WEEKLY ──────────────────────────────────────────────────────────────

export async function fetchWeeklyPlans(monthlyId: string): Promise<WeeklyPlan[]> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/monthly-plans/${monthlyId}/weekly-plans`,
      method: "GET",
    }),
  );
  const plans = Array.isArray(data) ? data : data?.plans ?? [];
  return plans.map(normalizeWeeklyPlan);
}

export async function fetchWeeklyAvailableWeight(
  monthlyId: string,
): Promise<AvailableWeight> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/monthly-plans/${monthlyId}/weekly-plans/available-weight`,
      method: "GET",
    }),
  );
  return {
    allocated_pct: toNumber(data?.allocated_pct ?? data?.allocatedPct),
    remaining_pct: toNumber(data?.remaining_pct ?? data?.remainingPct),
    parent_target_value: data?.parent_target_value != null ? toNumber(data.parent_target_value) : undefined,
    allocated_target_value: data?.allocated_target_value != null ? toNumber(data.allocated_target_value) : undefined,
    remaining_target_value: data?.remaining_target_value != null ? toNumber(data.remaining_target_value) : undefined,
    weeks: Array.isArray(data?.weeks)
      ? data.weeks.map((w: any) => ({
          week_number: Number(w.week_number),
          allocated_pct: toNumber(w.allocated_pct ?? w.weight_pct),
          plan_id: w.plan_id ? String(w.plan_id) : null,
        }))
      : [],
    months: [],
  };
}

export async function fetchManagerWeeklyPlans(
  monthlyId: string,
  weekNumber: number,
): Promise<WeeklyPlan[]> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/manager/weekly-plans`,
      method: "GET",
      query: { monthlyId, weekNumber },
    }),
  );
  return (Array.isArray(data) ? data : []).map(normalizeWeeklyPlan);
}

export async function createWeeklyPlan(
  monthlyId: string,
  dto: CreateWeeklyPlanDTO,
): Promise<WeeklyPlan> {
  const plan = await unwrap<any>(
    makeCall({
      route: `${OKR}/monthly-plans/${monthlyId}/weekly-plans`,
      method: "POST",
      body: dto,
    }),
  );
  return normalizeWeeklyPlan(plan);
}

export async function updateWeeklyPlan(
  id: string,
  dto: { 
    title?: string;
    metric_definition_id?: number;
    start_value?: number;
    target_value?: number;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
  },
): Promise<WeeklyPlan> {
  const plan = await unwrap<any>(
    makeCall({
      route: `${OKR}/weekly-plans/${id}`,
      method: "PUT",
      body: dto,
    }),
  );
  return normalizeWeeklyPlan(plan);
}

export async function deleteWeeklyPlan(id: string): Promise<void> {
  await makeCall({
    route: `${OKR}/weekly-plans/${id}`,
    method: "DELETE",
  });
}

export async function submitWeeklyPeriod(
  weekNumber: number,
  monthlyPlanId: string,
): Promise<void> {
  await makeCall({
    route: `${OKR}/weekly-plans/submit-period`,
    method: "POST",
    body: { week_number: weekNumber, monthly_plan_id: monthlyPlanId },
  });
}

export async function approveWeeklyPeriod(payload: object): Promise<void> {
  await makeCall({
    route: `${OKR}/weekly-plans/approve-period`,
    method: "POST",
    body: payload,
  });
}

export async function rejectWeeklyPeriod(payload: object): Promise<void> {
  await makeCall({
    route: `${OKR}/weekly-plans/reject-period`,
    method: "POST",
    body: payload,
  });
}

export async function publishWeeklyPeriod(
  weekNumber: number,
  monthlyPlanId: string,
): Promise<void> {
  await makeCall({
    route: `${OKR}/weekly-plans/publish-period`,
    method: "POST",
    body: { week_number: weekNumber, monthly_plan_id: monthlyPlanId },
  });
}

// ── DAILY ───────────────────────────────────────────────────────────────

export function fetchDailyPlans(weeklyId: string): Promise<DailyPlan[]> {
  return unwrap<DailyPlan[]>(
    makeCall({
      route: `${OKR}/weekly-plans/${weeklyId}/daily-plans`,
      method: "GET",
    }),
  );
}

export function createDailyPlan(
  weeklyId: string,
  dto: CreateDailyPlanDTO,
): Promise<DailyPlan> {
  return unwrap<DailyPlan>(
    makeCall({
      route: `${OKR}/weekly-plans/${weeklyId}/daily-plans`,
      method: "POST",
      body: dto,
    }),
  );
}

export function updateDailyPlan(
  id: string,
  dto: {
    title?: string;
    target_value?: number;
    current_value?: number;
    completion_day?: DayOfWeek;
    notes?: string;
    start_value?: number;
    metric_definition_id?: number;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
    description?: string;
  },
): Promise<DailyPlan> {
  return unwrap<DailyPlan>(
    makeCall({
      route: `${OKR}/daily-plans/${id}`,
      method: "PUT",
      body: dto,
    }),
  );
}

export function updateDailyStatus(
  id: string,
  status: DailyStatus,
): Promise<DailyPlan> {
  return unwrap<DailyPlan>(
    makeCall({
      route: `${OKR}/daily-plans/${id}/status`,
      method: "PATCH",
      body: { status },
    }),
  );
}

export async function deleteDailyPlan(id: string): Promise<void> {
  await makeCall({
    route: `${OKR}/daily-plans/${id}`,
    method: "DELETE",
  });
}


// ── METRICS ─────────────────────────────────────────────────────────────

export async function fetchMetricDefinitions(): Promise<MetricDefinition[]> {
  const data = await unwrap<any>(
    makeCall({
      route: `${OKR}/metrics`,
      method: "GET",
    }),
  );
  return Array.isArray(data) ? data : [];
}

// ── UTIL ────────────────────────────────────────────────────────────────

export async function triggerRecalculate(
  entityType: string,
  entityId: string,
): Promise<void> {
  await makeCall({
    route: `${OKR}/recalculate/${entityType}/${entityId}`,
    method: "POST",
  });
}

// ── SUBMISSIONS / APPROVALS ──────────────────────────────────────────

export async function fetchManagerSubmissions(
  cycleId: string | number,
): Promise<PlanSubmission[]> {
  return unwrap<PlanSubmission[]>(
    makeCall({
      route: `${BASE_URL}/okr/approvals/manager/submissions`,
      method: "GET",
      query: { cycle_id: cycleId },
    }),
  );
}

export async function fetchSubmissionById(id: string): Promise<PlanSubmission> {
  return unwrap<PlanSubmission>(
    makeCall({
      route: `${BASE_URL}/okr/approvals/submissions/${id}`,
      method: "GET",
    }),
  );
}

export async function fetchSubmissionComments(
  id: string,
): Promise<SubmissionComment[]> {
  return unwrap<SubmissionComment[]>(
    makeCall({
      route: `${BASE_URL}/okr/approvals/submissions/${id}/comments`,
      method: "GET",
    }),
  );
}

export async function approveSubmission(id: string): Promise<void> {
  await makeCall({
    route: `${BASE_URL}/okr/approvals/${id}/approve`,
    method: "POST",
  });
}

export async function rejectSubmission(id: string): Promise<void> {
  await makeCall({
    route: `${BASE_URL}/okr/approvals/${id}/reject`,
    method: "POST",
  });
}

export async function postSubmissionComment(dto: {
  submission_id?: number;
  item_id?: string;
  item_type?: string;
  comment: string;
}): Promise<SubmissionComment> {
  return unwrap<SubmissionComment>(
    makeCall({
      route: `${BASE_URL}/okr/approvals/comment`,
      method: "POST",
      body: dto,
    }),
  );
}

const okrExecutionApi = {
  fetchMonthlyPlans,
  fetchMonthlyAvailableWeight,
  createMonthlyPlan,
  updateMonthlyPlan,
  deleteMonthlyPlan,
  submitMonthlyPeriod,
  approveMonthlyPeriod,
  rejectMonthlyPeriod,
  fetchWeeklyPlans,
  fetchWeeklyAvailableWeight,
  createWeeklyPlan,
  updateWeeklyPlan,
  deleteWeeklyPlan,
  submitWeeklyPeriod,
  approveWeeklyPeriod,
  rejectWeeklyPeriod,
  fetchDailyPlans,
  createDailyPlan,
  updateDailyPlan,
  updateDailyStatus,
  deleteDailyPlan,
  triggerRecalculate,
  fetchManagerSubmissions,
  fetchSubmissionById,
  fetchSubmissionComments,
  approveSubmission,
  rejectSubmission,
  postSubmissionComment,
  fetchMetricDefinitions,
  fetchTeamHealthSummary: async (): Promise<{ hasUnsubmittedPlans: boolean }> => {
    return unwrap<{ hasUnsubmittedPlans: boolean }>(
      makeCall({
        route: `${BASE_URL}/okr/manager/team-health-summary`,
        method: "GET",
      }),
    );
  },
  fetchManagerMonthlyPlans,
  fetchManagerWeeklyPlans,
};

export default okrExecutionApi;
