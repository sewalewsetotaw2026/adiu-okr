import { LeaveState } from "./types";

// Empty arrays as stable references
const EMPTY_ARRAY: never[] = [];

// Type for state with optional leave
interface StateWithLeave {
  leave?: LeaveState;
}

// ==========================================
// Leave Types Selectors
// ==========================================
export const selectLeaveTypes = (state: StateWithLeave) =>
  Array.isArray(state.leave?.leaveTypes)
    ? state.leave!.leaveTypes
    : EMPTY_ARRAY;

export const selectApplicableLeaveTypes = (state: StateWithLeave) =>
  Array.isArray(state.leave?.applicableLeaveTypes)
    ? state.leave!.applicableLeaveTypes
    : EMPTY_ARRAY;

export const selectLeaveTypesLoading = (state: StateWithLeave) =>
  state.leave?.leaveTypesLoading ?? false;

export const selectLeaveTypesError = (state: StateWithLeave) =>
  state.leave?.leaveTypesError ?? null;

export const selectLeaveTypeById = (id: number) => (state: StateWithLeave) =>
  state.leave?.leaveTypes?.find((lt) => lt.id === id);

// ==========================================
// Leave Balance Selectors
// ==========================================
export const selectLeaveBalance = (state: StateWithLeave) =>
  Array.isArray(state.leave?.leaveBalance)
    ? state.leave!.leaveBalance
    : EMPTY_ARRAY;

export const selectAllLeaveBalances = (state: StateWithLeave) =>
  Array.isArray(state.leave?.allLeaveBalances)
    ? state.leave!.allLeaveBalances
    : EMPTY_ARRAY;

export const selectLeaveBalanceLoading = (state: StateWithLeave) =>
  state.leave?.leaveBalanceLoading ?? false;

export const selectLeaveBalanceError = (state: StateWithLeave) =>
  state.leave?.leaveBalanceError ?? null;

export const selectLeaveBalanceByType =
  (leaveTypeId: number) => (state: StateWithLeave) =>
    (Array.isArray(state.leave?.leaveBalance)
      ? state.leave!.leaveBalance
      : EMPTY_ARRAY
    ).find((b: any) => b.leave_type_id === leaveTypeId);

export const selectTotalRemainingDays = (state: StateWithLeave) =>
  (Array.isArray(state.leave?.leaveBalance)
    ? state.leave!.leaveBalance
    : EMPTY_ARRAY
  ).reduce((sum, b) => sum + (b.remaining_days || 0), 0);

export const selectTotalUsedDays = (state: StateWithLeave) =>
  (Array.isArray(state.leave?.leaveBalance)
    ? state.leave!.leaveBalance
    : EMPTY_ARRAY
  ).reduce((sum, b) => sum + (b.used_days || 0), 0);

export const selectTotalPendingDays = (state: StateWithLeave) =>
  (Array.isArray(state.leave?.leaveBalance)
    ? state.leave!.leaveBalance
    : EMPTY_ARRAY
  ).reduce((sum, b) => sum + (b.pending_days || 0), 0);

// ==========================================
// Leave Applications Selectors
// ==========================================
export const selectLeaveApplications = (state: StateWithLeave) =>
  Array.isArray(state.leave?.leaveApplications)
    ? state.leave!.leaveApplications
    : EMPTY_ARRAY;

export const selectCurrentApplication = (state: StateWithLeave) =>
  state.leave?.currentApplication ?? null;

export const selectPendingApplications = (state: StateWithLeave) =>
  Array.isArray(state.leave?.pendingApplications)
    ? state.leave!.pendingApplications
    : EMPTY_ARRAY;

export const selectPendingCancellations = (state: StateWithLeave) =>
  Array.isArray(state.leave?.pendingCancellations)
    ? state.leave!.pendingCancellations
    : EMPTY_ARRAY;

export const selectCancellableLeaves = (state: StateWithLeave) =>
  Array.isArray(state.leave?.cancellableLeaves)
    ? state.leave!.cancellableLeaves
    : EMPTY_ARRAY;

export const selectApplicationsLoading = (state: StateWithLeave) =>
  state.leave?.applicationsLoading ?? false;

export const selectApplicationsError = (state: StateWithLeave) =>
  state.leave?.applicationsError ?? null;

export const selectApplicationsByStatus =
  (status: string) => (state: StateWithLeave) => {
    const applications = Array.isArray(state.leave?.leaveApplications)
      ? state.leave!.leaveApplications
      : EMPTY_ARRAY;
    return status === "ALL"
      ? applications
      : applications.filter((app) => app.current_status === status);
  };

export const selectPendingCount = (state: StateWithLeave) =>
  (Array.isArray(state.leave?.pendingApplications)
    ? state.leave!.pendingApplications
    : EMPTY_ARRAY
  ).length;

// ==========================================
// On Leave Employees Selectors
// ==========================================
export const selectOnLeaveEmployees = (state: StateWithLeave) =>
  state.leave?.onLeaveEmployees ?? EMPTY_ARRAY;

export const selectOnLeaveCount = (state: StateWithLeave) =>
  state.leave?.onLeaveCount ?? 0;

// ==========================================
// Leave Recalls Selectors
// ==========================================
export const selectLeaveRecalls = (state: StateWithLeave) =>
  state.leave?.leaveRecalls ?? EMPTY_ARRAY;

export const selectMyRecallNotifications = (state: StateWithLeave) =>
  Array.isArray(state.leave?.myRecallNotifications)
    ? state.leave!.myRecallNotifications
    : EMPTY_ARRAY;

export const selectActiveLeavesForRecall = (state: StateWithLeave) =>
  state.leave?.activeLeavesForRecall ?? EMPTY_ARRAY;

export const selectRecallsLoading = (state: StateWithLeave) =>
  state.leave?.recallsLoading ?? false;

export const selectRecallsError = (state: StateWithLeave) =>
  state.leave?.recallsError ?? null;

export const selectPendingRecallsCount = (state: StateWithLeave) =>
  (state.leave?.myRecallNotifications ?? EMPTY_ARRAY).filter(
    (r) => r.status === "PENDING",
  ).length;

// ==========================================
// Relief Officers Selectors
// ==========================================
export const selectReliefOfficers = (state: StateWithLeave) =>
  state.leave?.reliefOfficers ?? EMPTY_ARRAY;

export const selectReliefOfficersLoading = (state: StateWithLeave) =>
  state.leave?.reliefOfficersLoading ?? false;

// ==========================================
// Leave Stats Selectors
// ==========================================
export const selectLeaveStats = (state: StateWithLeave) =>
  state.leave?.leaveStats ?? null;

export const selectStatsLoading = (state: StateWithLeave) =>
  state.leave?.statsLoading ?? false;

// ==========================================
// Tab Counts Selectors
// ==========================================
export const selectTabCounts = (state: StateWithLeave) =>
  state.leave?.tabCounts ?? null;

export const selectTabCountsLoading = (state: StateWithLeave) =>
  state.leave?.tabCountsLoading ?? false;

export const selectOnLeaveTodayCount = (state: StateWithLeave) =>
  state.leave?.leaveStats?.onLeaveToday ?? 0;

// ==========================================
// Public Holidays Selectors
// ==========================================
export const selectPublicHolidays = (state: StateWithLeave) =>
  Array.isArray(state.leave?.publicHolidays)
    ? state.leave!.publicHolidays
    : EMPTY_ARRAY;

export const selectUpcomingHolidays = (state: StateWithLeave) =>
  Array.isArray(state.leave?.upcomingHolidays)
    ? state.leave!.upcomingHolidays
    : EMPTY_ARRAY;

export const selectHolidaysLoading = (state: StateWithLeave) =>
  state.leave?.holidaysLoading ?? false;

export const selectHolidaysError = (state: StateWithLeave) =>
  state.leave?.holidaysError ?? null;

// ==========================================
// Leave Settings Selectors
// ==========================================
export const selectLeaveSettings = (state: StateWithLeave) =>
  state.leave?.leaveSettings ?? null;

export const selectSettingsLoading = (state: StateWithLeave) =>
  state.leave?.settingsLoading ?? false;

export const selectSettingsError = (state: StateWithLeave) =>
  state.leave?.settingsError ?? null;

// ==========================================
// Enhanced Balance Selectors
// ==========================================
export const selectEnhancedBalance = (state: StateWithLeave) =>
  Array.isArray(state.leave?.enhancedBalance)
    ? state.leave!.enhancedBalance
    : EMPTY_ARRAY;

export const selectAccrualSettings = (state: StateWithLeave) =>
  state.leave?.accrualSettings ?? null;

export const selectCurrentFiscalYear = (state: StateWithLeave) =>
  state.leave?.currentFiscalYear ?? null;

// ==========================================
// Expiring Balances Selectors
// ==========================================
export const selectExpiringBalances = (state: StateWithLeave) =>
  Array.isArray(state.leave?.expiringBalances)
    ? state.leave!.expiringBalances
    : EMPTY_ARRAY;

export const selectExpiringBalancesLoading = (state: StateWithLeave) =>
  state.leave?.expiringBalancesLoading ?? false;

// ==========================================
// Cash-Out Selectors
// ==========================================
export const selectCashOutCalculation = (state: StateWithLeave) =>
  state.leave?.cashOutCalculation ?? null;

export const selectMyCashOutRequests = (state: StateWithLeave) =>
  Array.isArray(state.leave?.myCashOutRequests)
    ? state.leave!.myCashOutRequests
    : EMPTY_ARRAY;

export const selectAllCashOutRequests = (state: StateWithLeave) =>
  Array.isArray(state.leave?.allCashOutRequests)
    ? state.leave!.allCashOutRequests
    : EMPTY_ARRAY;

export const selectCashOutLoading = (state: StateWithLeave) =>
  state.leave?.cashOutLoading ?? false;

export const selectCashOutError = (state: StateWithLeave) =>
  state.leave?.cashOutError ?? null;

export const selectPendingCashOutCount = (state: StateWithLeave) =>
  (Array.isArray(state.leave?.allCashOutRequests)
    ? state.leave!.allCashOutRequests
    : EMPTY_ARRAY
  ).filter((r) => r.status === "PENDING").length;

// ==========================================
// General Selectors
// ==========================================
export const selectLeaveLoading = (state: StateWithLeave) =>
  state.leave?.loading ?? false;

export const selectLeaveError = (state: StateWithLeave) =>
  state.leave?.error ?? null;

export const selectLeaveSuccess = (state: StateWithLeave) =>
  state.leave?.success ?? false;

export const selectLeaveMessage = (state: StateWithLeave) =>
  state.leave?.message ?? "";

export const selectLeavePagination = (state: StateWithLeave) =>
  state.leave?.pagination ?? null;

export const selectOnLeavePagination = (state: StateWithLeave) =>
  state.leave?.onLeavePagination ?? null;

// Loading flag for on-leave employees list
export const selectOnLeaveLoading = (state: StateWithLeave) =>
  state.leave?.onLeaveLoading ?? false;
