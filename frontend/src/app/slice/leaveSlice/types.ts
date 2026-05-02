// Leave Management Types - Updated to match backend API

// ==========================================
// Leave Type
// ==========================================
export type ApplicableGender = "Male" | "Female" | "All";

export interface LeaveType {
  id: number;
  company_id?: number;
  name: string;
  code: string;
  default_allowance_days: number;
  incremental_days_per_year?: number;
  incremental_period_years?: number;
  max_accrual_limit?: number;
  is_carry_over_allowed?: boolean;
  carry_over_expiry_months?: number;
  applicable_gender: ApplicableGender;
  requires_attachment: boolean;
  is_paid: boolean;
  is_calendar_days?: boolean;
  // Accrual configuration
  is_accrual_based?: boolean;
  accrual_frequency?: "DAILY" | "MONTHLY";
  accrual_divisor?: number;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// Leave Balance
// ==========================================
export interface LeaveBalance {
  id: number;
  employee_id: string;
  leave_type_id: number;
  fiscal_year: number;
  total_entitlement: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  expiry_date?: string;
  leaveType?: LeaveType;
  employee?: EmployeeRef;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// Employee Reference (for nested data)
// ==========================================
export interface EmployeeRef {
  id: string;
  full_name: string;
  profile_picture_url?: string;
  department?: string;
  job_title?: string;
  employments?: Array<{
    department?: { name: string };
    job_title?: { name: string };
  }>;
}

// ==========================================
// Leave Application
// ==========================================
export type LeaveStatus =
  | "PENDING_SUPERVISOR"
  | "PENDING_MANAGER_APPROVAL"
  | "PENDING_HR"
  | "PENDING_CEO"
  | "APPROVED"
  | "APPROVED_BY_MANAGER"
  | "REJECTED"
  | "CANCELLED";

export interface ApprovalLog {
  id: number;
  leave_application_id: number;
  action: "APPROVED" | "REJECTED";
  action_by: string;
  action_at: string;
  comments?: string;
  from_status: LeaveStatus;
  to_status: LeaveStatus;
  actionBy?: EmployeeRef;
  approver?: EmployeeRef; // Added to match backend response
}

export interface LeaveApplication {
  id: number;
  employee_id: string;
  company_id?: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  return_date: string;
  requested_days: number;
  reason?: string;
  attachment_url?: string;
  is_start_half_day?: boolean;
  is_end_half_day?: boolean;
  relief_officer_id?: string;
  current_status: LeaveStatus;
  rejection_reason?: string;
  cancellation_status?: string;
  requested_return_date?: string;
  cancellation_reason?: string;
  created_at?: string;
  updated_at?: string;
  // Nested relations
  employee?: EmployeeRef;
  leaveType?: LeaveType;
  reliefOfficer?: EmployeeRef;
  approvalLogs?: ApprovalLog[];
}

// ==========================================
// Leave Recall
// ==========================================
export type RecallStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface LeaveRecall {
  id: number;
  leave_application_id: number;
  recalled_by: string;
  reason: string;
  recall_date: string;
  status: RecallStatus;
  employee_response?: string;
  actual_return_date?: string;
  responded_at?: string;
  created_at?: string;
  updated_at?: string;
  // Nested relations
  leaveApplication?: LeaveApplication;
  recalledBy?: EmployeeRef;
}

// ==========================================
// Public Holiday
// ==========================================
export interface PublicHoliday {
  id: number;
  company_id?: number;
  name: string;
  holiday_date: string;
  is_recurring: boolean;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// Leave Settings
// ==========================================
export type AccrualBasis = "ANNIVERSARY" | "CALENDAR_YEAR";
export type AccrualFrequency = "DAILY" | "MONTHLY";
export type EncashmentRounding = "ROUND" | "FLOOR" | "CEIL";

export interface LeaveSettings {
  id: number;
  company_id: number;
  // Work Week Configuration
  saturday_half_day: boolean;
  sunday_off: boolean;
  fiscal_year_start_month: number;
  accrual_basis: AccrualBasis;
  require_ceo_approval_for_managers: boolean;
  auto_approve_after_days?: number;
  // Accrual Configuration
  annual_leave_base_days: number;
  accrual_frequency: AccrualFrequency;
  accrual_divisor: number;
  increment_period_years: number;
  increment_amount: number;
  max_annual_leave_cap?: number;
  // Encashment Configuration
  enable_encashment: boolean;
  encashment_salary_divisor: number;
  max_encashment_days: number;
  encashment_rounding: EncashmentRounding;
  // Notification Configuration
  enable_leave_expiry: boolean;
  expiry_notification_days: number;
  balance_notification_enabled: boolean;
  notification_channels: string;
  // Policy Versioning
  policy_effective_date?: string;
  policy_version: number;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// Request Types
// ==========================================
export interface GetLeaveApplicationsParams {
  page?: number;
  limit?: number;
  status?: LeaveStatus | "ALL";
  leave_type_id?: number;
  employee_id?: string;
  start_date?: string;
  end_date?: string;
  year?: number;
  sortBy?: string;
  order?: "asc" | "desc";
  // Advanced filters
  department_id?: number;
  job_title_id?: number;
  gender?: string;
  manager_id?: string;
  search?: string;
}

export interface CreateLeaveApplicationRequest {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  relief_officer_id?: string;
  attachment_url?: string;
  is_start_half_day?: boolean;
  is_end_half_day?: boolean;
}

export interface ApproveLeaveRequest {
  id: number;
  comments?: string;
  status?: LeaveStatus;
}

export interface RejectLeaveRequest {
  id: number;
  rejection_reason: string;
  comments?: string;
}

export interface RequestLeaveCancellationRequest {
  id: number;
  requested_return_date: string;
  reason: string;
}

export interface ApproveLeaveCancellationRequest {
  id: number;
  comments?: string;
}

export interface RejectLeaveCancellationRequest {
  id: number;
  reason: string;
}

export interface CreateLeaveRecallRequest {
  leave_application_id: number;
  reason: string;
  recall_date: string;
}

export interface RespondToRecallRequest {
  id: number;
  response: "ACCEPTED" | "DECLINED";
  employee_response?: string;
  actual_return_date?: string;
}

export interface CreateLeaveTypeRequest {
  name: string;
  code: string;
  default_allowance_days: number;
  incremental_days_per_year?: number;
  incremental_period_years?: number;
  max_accrual_limit?: number | null;
  is_carry_over_allowed?: boolean;
  carry_over_expiry_months?: number | null;
  applicable_gender?: ApplicableGender;
  requires_attachment?: boolean;
  is_paid?: boolean;
  is_calendar_days?: boolean;
  // Accrual configuration
  is_accrual_based?: boolean;
  accrual_frequency?: "DAILY" | "MONTHLY";
  accrual_divisor?: number;
}

export interface UpdateLeaveTypeRequest {
  id: number;
  name?: string;
  code?: string;
  default_allowance_days?: number;
  incremental_days_per_year?: number;
  incremental_period_years?: number;
  max_accrual_limit?: number | null;
  is_carry_over_allowed?: boolean;
  carry_over_expiry_months?: number | null;
  applicable_gender?: ApplicableGender;
  requires_attachment?: boolean;
  is_paid?: boolean;
  is_calendar_days?: boolean;
  // Accrual configuration
  is_accrual_based?: boolean;
  accrual_frequency?: "DAILY" | "MONTHLY";
  accrual_divisor?: number;
}

export interface AllocateLeaveBalanceRequest {
  employee_id: string;
  fiscal_year: number;
  leave_type_id?: number;
  total_entitlement?: number;
  expiry_date?: string;
}

export interface BulkAllocateLeaveBalanceRequest {
  fiscal_year: number;
  leave_type_id?: number;
}

export interface AdjustLeaveBalanceRequest {
  id: number;
  adjustment_days?: number;
  adjustment_type?: "add" | "subtract" | "set"; // "set" = Option B: set target balance
  used_days_adjustment?: number;
  used_days_adjustment_type?: "add" | "subtract" | "set";
  reason?: string;
}

export interface CarryOverLeaveRequest {
  from_year: number;
  to_year: number;
  leave_type_id?: number;
}

export interface CreatePublicHolidayRequest {
  name: string;
  holiday_date: string;
  is_recurring?: boolean;
}

export interface UpdatePublicHolidayRequest {
  id: number;
  name?: string;
  holiday_date?: string;
  is_recurring?: boolean;
}

export interface UpdateLeaveSettingsRequest {
  // Work Week Configuration
  saturday_half_day?: boolean;
  sunday_off?: boolean;
  fiscal_year_start_month?: number;
  accrual_basis?: AccrualBasis;
  require_ceo_approval_for_managers?: boolean;
  auto_approve_after_days?: number | null;
  // Accrual Configuration
  annual_leave_base_days?: number;
  accrual_frequency?: AccrualFrequency;
  accrual_divisor?: number;
  increment_period_years?: number;
  increment_amount?: number;
  max_annual_leave_cap?: number | null;
  // Encashment Configuration
  enable_encashment?: boolean;
  encashment_salary_divisor?: number;
  max_encashment_days?: number;
  encashment_rounding?: EncashmentRounding;
  // Notification Configuration
  enable_leave_expiry?: boolean;
  expiry_notification_days?: number;
  balance_notification_enabled?: boolean;
  notification_channels?: string;
  // Policy Versioning
  policy_effective_date?: string;
}

// ==========================================
// Response Types
// ==========================================
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeaveTypesResponse {
  leaveTypes: LeaveType[];
}

export interface LeaveBalanceResponse {
  fiscal_year: number;
  balances: LeaveBalance[];
}

export interface LeaveApplicationsResponse {
  applications: LeaveApplication[];
  pagination?: Pagination;
}

export interface LeaveApplicationResponse {
  application: LeaveApplication;
}

export interface LeaveRecallsResponse {
  recalls: LeaveRecall[];
  pagination?: Pagination;
}

export interface LeaveStatsResponse {
  totalEmployees: number;
  onLeaveToday: number;
  pendingApplications: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  byLeaveType?: Array<{
    leaveType: string;
    count: number;
    totalDays: number;
  }>;
}

export interface OnLeaveDetailedEmployee {
  id: number;
  application_id: number;
  employee_id: string;
  full_name: string;
  gender: string;
  phone: string;
  profile_picture_url?: string;
  department: string;
  job_title: string;
  job_level: string;
  leave_type: string;
  leave_code: string;
  is_paid: boolean;
  start_date: string;
  end_date: string;
  return_date: string;
  requested_days: number;
  reason?: string;
}

export interface OnLeaveResponse {
  count: number;
  employees: OnLeaveDetailedEmployee[];
}

export interface ReliefOfficerOption {
  id: string;
  full_name: string;
  department?: string;
  job_title?: string;
}

export interface PublicHolidaysResponse {
  holidays: PublicHoliday[];
}

// ==========================================
// Enhanced Leave Balance (with accrual details)
// ==========================================
export interface AccrualDetails {
  is_gradual_accrual: boolean;
  daily_rate: number;
  days_worked: number;
  base_entitlement: number;
  tenure_bonus_days: number;
  accrued_days_current_year: number;
  carried_over_days: number;
  fiscal_year_start: string;
  years_of_service?: number;
  total_service_days?: number;
  months_worked?: number; // For monthly accrual frequency display
  accrual_frequency?: "DAILY" | "MONTHLY"; // Accrual mode indicator
}

export interface CashOutInfo {
  eligible_days: number;
  daily_rate: number;
  cash_value: number;
  currency: string;
}

export interface EnhancedLeaveBalance extends LeaveBalance {
  accrued_entitlement: number;
  annual_entitlement: number;
  accrual_details?: AccrualDetails;
  cash_out?: CashOutInfo;
}

export interface AccrualSettingsInfo {
  base_days: number;
  divisor: number;
  frequency: AccrualFrequency;
  increment_period_years: number;
  increment_amount: number;
  max_cap?: number;
  encashment_enabled: boolean;
  daily_rate?: number;
}

export interface MyBalanceResponse {
  fiscal_year: number;
  accrual_settings: AccrualSettingsInfo;
  balances: EnhancedLeaveBalance[];
}

// ==========================================
// Leave Cash-Out
// ==========================================
export type CashOutStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface CashOutRequest {
  id: number;
  employee_id: string;
  company_id: number;
  leave_type_id: number;
  fiscal_year: number;
  days_cashed_out: number;
  cash_value: number;
  monthly_salary: number;
  salary_divisor: number;
  status: CashOutStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at?: string;
  employee?: EmployeeRef;
  leaveType?: LeaveType;
}

export interface CashOutCalculation {
  employee_id: string;
  fiscal_year: number;
  accrued_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  eligible_days: number;
  monthly_salary: number;
  daily_rate: number;
  cash_value: number;
  eligible: boolean;
  reason?: string;
  max_amount?: number;
  settings: {
    salary_divisor: number;
    max_days: number;
    rounding: string;
  };
}

export interface CreateCashOutRequest {
  days_to_cash_out: number;
}

export interface RejectCashOutRequest {
  id: number;
  rejection_reason: string;
}

// ==========================================
// Expiring Balance Types
// ==========================================
export interface ExpiringBalance {
  id: number;
  employee: EmployeeRef;
  leaveType: LeaveType;
  remaining_days: number;
  expiry_date: string;
}

export interface NotifyExpiringRequest {
  days_threshold?: number;
}

// ==========================================
// Dashboard / Tab Counts
// ==========================================
export interface TabCounts {
  on_leave: number;
  pending: number;
  cancellations: number;
  cash_out: number;
  expiring: number;
}

// ==========================================
// State
// ==========================================
export interface LeaveState {
  // Leave Types
  leaveTypes: LeaveType[];
  applicableLeaveTypes: LeaveType[];
  leaveTypesLoading: boolean;
  leaveTypesError: string | null;

  // Leave Balance
  leaveBalance: LeaveBalance[];
  enhancedBalance: EnhancedLeaveBalance[];
  allLeaveBalances: LeaveBalance[];
  leaveBalanceLoading: boolean;
  leaveBalanceError: string | null;
  accrualSettings: AccrualSettingsInfo | null;
  currentFiscalYear: number | null;

  // Expiring Balances
  expiringBalances: ExpiringBalance[];
  expiringBalancesLoading: boolean;

  // Leave Applications
  leaveApplications: LeaveApplication[];
  currentApplication: LeaveApplication | null;
  pendingApplications: LeaveApplication[];
  pendingCancellations: LeaveApplication[];
  cancellableLeaves: LeaveApplication[];
  applicationsLoading: boolean;
  applicationsError: string | null;

  // Leave Recalls
  leaveRecalls: LeaveRecall[];
  myRecallNotifications: LeaveRecall[];
  activeLeavesForRecall: LeaveApplication[];
  recallsLoading: boolean;
  recallsError: string | null;

  // On Leave Employees
  onLeaveEmployees: OnLeaveDetailedEmployee[];
  onLeaveCount: number;
  onLeavePagination: Pagination | null;
  onLeaveLoading: boolean;

  // Relief Officers
  reliefOfficers: ReliefOfficerOption[];
  reliefOfficersLoading: boolean;

  // Leave Stats
  leaveStats: LeaveStatsResponse | null;
  statsLoading: boolean;

  // Public Holidays
  publicHolidays: PublicHoliday[];
  upcomingHolidays: PublicHoliday[];
  holidaysLoading: boolean;
  holidaysError: string | null;

  // Leave Settings
  leaveSettings: LeaveSettings | null;
  settingsLoading: boolean;
  settingsError: string | null;

  // Cash-Out
  cashOutCalculation: CashOutCalculation | null;
  myCashOutRequests: CashOutRequest[];
  allCashOutRequests: CashOutRequest[];
  cashOutLoading: boolean;
  cashOutError: string | null;

  // General
  loading: boolean;
  error: string | null;
  success: boolean;
  message: string | null;

  // Tab Counts
  tabCounts: TabCounts | null;
  tabCountsLoading: boolean;

  // Pagination
  pagination: Pagination | null;
}
