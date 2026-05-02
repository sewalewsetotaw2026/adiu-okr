import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { leaveSaga } from "./saga";
import {
  LeaveState,
  LeaveType,
  LeaveBalance,
  LeaveApplication,
  LeaveRecall,
  LeaveStatsResponse,
  ReliefOfficerOption,
  Pagination,
  GetLeaveApplicationsParams,
  CreateLeaveApplicationRequest,
  ApproveLeaveRequest,
  RejectLeaveRequest,
  CreateLeaveRecallRequest,
  RespondToRecallRequest,
  CreateLeaveTypeRequest,
  UpdateLeaveTypeRequest,
  AllocateLeaveBalanceRequest,
  BulkAllocateLeaveBalanceRequest,
  AdjustLeaveBalanceRequest,
  CarryOverLeaveRequest,
  PublicHoliday,
  CreatePublicHolidayRequest,
  UpdatePublicHolidayRequest,
  LeaveSettings,
  UpdateLeaveSettingsRequest,
  OnLeaveDetailedEmployee,
  // New types for enhanced features
  EnhancedLeaveBalance,
  AccrualSettingsInfo,
  CashOutRequest,
  CashOutCalculation,
  CreateCashOutRequest,
  RejectCashOutRequest,
  ExpiringBalance,
  NotifyExpiringRequest,
  RequestLeaveCancellationRequest,
  ApproveLeaveCancellationRequest,
  RejectLeaveCancellationRequest,
  TabCounts,
} from "./types";

export const initialState: LeaveState = {
  // Leave Types
  leaveTypes: [],
  applicableLeaveTypes: [],
  leaveTypesLoading: false,
  leaveTypesError: null,

  // Leave Balance
  leaveBalance: [],
  enhancedBalance: [],
  allLeaveBalances: [],
  leaveBalanceLoading: false,
  leaveBalanceError: null,
  accrualSettings: null,
  currentFiscalYear: null,

  // Expiring Balances
  expiringBalances: [],
  expiringBalancesLoading: false,

  // Leave Applications
  leaveApplications: [],
  currentApplication: null,
  pendingApplications: [],
  pendingCancellations: [],
  cancellableLeaves: [],
  applicationsLoading: false,
  applicationsError: null,

  // Leave Recalls
  leaveRecalls: [],
  myRecallNotifications: [],
  activeLeavesForRecall: [],
  recallsLoading: false,
  recallsError: null,

  // On Leave Employees
  onLeaveEmployees: [],
  onLeaveCount: 0,
  onLeavePagination: null,
  onLeaveLoading: false,

  // Relief Officers
  reliefOfficers: [],
  reliefOfficersLoading: false,

  // Leave Stats
  leaveStats: null,
  statsLoading: false,

  // Public Holidays
  publicHolidays: [],
  upcomingHolidays: [],
  holidaysLoading: false,
  holidaysError: null,

  // Leave Settings
  leaveSettings: null,
  settingsLoading: false,
  settingsError: null,

  // Cash-Out
  cashOutCalculation: null,
  myCashOutRequests: [],
  allCashOutRequests: [],
  cashOutLoading: false,
  cashOutError: null,

  // General
  loading: false,
  error: null,
  success: false,
  message: "",

  // Tab Counts
  tabCounts: null,
  tabCountsLoading: false,

  // Pagination
  pagination: null,
};

const slice = createSlice({
  name: "leave",
  initialState,
  reducers: {
    // ==========================================
    // Reset State
    // ==========================================
    resetState(state) {
      state.error = null;
      state.success = false;
      state.message = "";
    },

    resetLeaveForm(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.message = "";
    },

    // ==========================================
    // Leave Types
    // ==========================================
    getLeaveTypesRequest(state) {
      state.leaveTypesLoading = true;
      state.leaveTypesError = null;
    },
    getLeaveTypesSuccess(state, action: PayloadAction<LeaveType[]>) {
      state.leaveTypesLoading = false;
      state.leaveTypes = Array.isArray(action.payload) ? action.payload : [];
    },
    getLeaveTypesFailure(state, action: PayloadAction<string>) {
      state.leaveTypesLoading = false;
      state.leaveTypesError = action.payload;
    },

    getApplicableLeaveTypesRequest(state) {
      state.leaveTypesLoading = true;
      state.leaveTypesError = null;
    },
    getApplicableLeaveTypesSuccess(state, action: PayloadAction<LeaveType[]>) {
      state.leaveTypesLoading = false;
      state.applicableLeaveTypes = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    getApplicableLeaveTypesFailure(state, action: PayloadAction<string>) {
      state.leaveTypesLoading = false;
      state.leaveTypesError = action.payload;
    },

    createLeaveTypeRequest(
      state,
      _action: PayloadAction<CreateLeaveTypeRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    createLeaveTypeSuccess(state, action: PayloadAction<LeaveType>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave type created successfully";
      state.leaveTypes = [...state.leaveTypes, action.payload];
    },
    createLeaveTypeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    updateLeaveTypeRequest(
      state,
      _action: PayloadAction<UpdateLeaveTypeRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    updateLeaveTypeSuccess(state, action: PayloadAction<LeaveType>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave type updated successfully";
      state.leaveTypes = state.leaveTypes.map((lt) =>
        lt.id === action.payload.id ? action.payload : lt
      );
    },
    updateLeaveTypeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    deleteLeaveTypeRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    deleteLeaveTypeSuccess(state, action: PayloadAction<number>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave type deleted successfully";
      state.leaveTypes = state.leaveTypes.filter(
        (lt) => lt.id !== action.payload
      );
    },
    deleteLeaveTypeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    seedDefaultLeaveTypesRequest(state) {
      state.loading = true;
      state.error = null;
    },
    seedDefaultLeaveTypesSuccess(state, action: PayloadAction<LeaveType[]>) {
      state.loading = false;
      state.success = true;
      state.message = "Default leave types created successfully";
      state.leaveTypes = Array.isArray(action.payload) ? action.payload : [];
    },
    seedDefaultLeaveTypesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Balance
    // ==========================================
    getMyLeaveBalanceRequest(state) {
      state.leaveBalanceLoading = true;
      state.leaveBalanceError = null;
    },
    getMyLeaveBalanceSuccess(state, action: PayloadAction<LeaveBalance[]>) {
      state.leaveBalanceLoading = false;
      state.leaveBalance = Array.isArray(action.payload) ? action.payload : [];
    },
    getMyLeaveBalanceFailure(state, action: PayloadAction<string>) {
      state.leaveBalanceLoading = false;
      state.leaveBalanceError = action.payload;
    },

    getEmployeeLeaveBalanceRequest(
      state,
      _action: PayloadAction<{ employeeId: string; year?: number }>
    ) {
      state.leaveBalanceLoading = true;
      state.leaveBalanceError = null;
    },
    getEmployeeLeaveBalanceSuccess(
      state,
      action: PayloadAction<LeaveBalance[]>
    ) {
      state.leaveBalanceLoading = false;
      state.leaveBalance = Array.isArray(action.payload) ? action.payload : [];
    },
    getEmployeeLeaveBalanceFailure(state, action: PayloadAction<string>) {
      state.leaveBalanceLoading = false;
      state.leaveBalanceError = action.payload;
    },

    getAllLeaveBalancesRequest(
      state,
      _action: PayloadAction<
        {
          page?: number;
          limit?: number;
          year?: number;
          leave_type_id?: number;
          department_id?: number;
        } | undefined
      >
    ) {
      state.leaveBalanceLoading = true;
      state.leaveBalanceError = null;
    },
    getAllLeaveBalancesSuccess(
      state,
      action: PayloadAction<{
        balances: LeaveBalance[];
        pagination?: Pagination;
      }>
    ) {
      state.leaveBalanceLoading = false;
      state.allLeaveBalances = Array.isArray(action.payload.balances)
        ? action.payload.balances
        : [];
      state.pagination = action.payload.pagination || null;
    },
    getAllLeaveBalancesFailure(state, action: PayloadAction<string>) {
      state.leaveBalanceLoading = false;
      state.leaveBalanceError = action.payload;
    },

    allocateLeaveBalanceRequest(
      state,
      _action: PayloadAction<AllocateLeaveBalanceRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    allocateLeaveBalanceSuccess(state, action: PayloadAction<LeaveBalance>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave balance allocated successfully";
      if (!Array.isArray(state.allLeaveBalances)) {
        state.allLeaveBalances = [];
      }
      const existingIndex = state.allLeaveBalances.findIndex(
        (b) => b.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.allLeaveBalances[existingIndex] = action.payload;
      } else {
        state.allLeaveBalances = [...state.allLeaveBalances, action.payload];
      }
    },
    allocateLeaveBalanceFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    bulkAllocateLeaveBalanceRequest(
      state,
      _action: PayloadAction<BulkAllocateLeaveBalanceRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    bulkAllocateLeaveBalanceSuccess(
      state,
      action: PayloadAction<{ created: number; updated: number }>
    ) {
      state.loading = false;
      state.success = true;
      state.message = `Leave allocated: ${action.payload.created} created, ${action.payload.updated} updated`;
    },
    bulkAllocateLeaveBalanceFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    adjustLeaveBalanceRequest(
      state,
      _action: PayloadAction<AdjustLeaveBalanceRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    adjustLeaveBalanceSuccess(state, action: PayloadAction<LeaveBalance>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave balance adjusted successfully";
      state.leaveBalance = state.leaveBalance.map((lb) =>
        lb.id === action.payload.id ? action.payload : lb
      );
      state.allLeaveBalances = state.allLeaveBalances.map((lb) =>
        lb.id === action.payload.id ? action.payload : lb
      );
    },
    adjustLeaveBalanceFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    carryOverLeaveRequest(
      state,
      _action: PayloadAction<CarryOverLeaveRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    carryOverLeaveSuccess(state, action: PayloadAction<string>) {
      state.loading = false;
      state.success = true;
      state.message = action.payload;
    },
    carryOverLeaveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Applications - Employee
    // ==========================================
    getMyLeavesRequest(
      state,
      _action: PayloadAction<GetLeaveApplicationsParams | undefined>
    ) {
      state.applicationsLoading = true;
      state.applicationsError = null;
    },
    getMyLeavesSuccess(
      state,
      action: PayloadAction<{
        applications: LeaveApplication[];
        pagination?: Pagination;
      }>
    ) {
      state.applicationsLoading = false;
      state.leaveApplications = Array.isArray(action.payload.applications)
        ? action.payload.applications
        : [];
      state.pagination = action.payload.pagination || null;
    },
    getMyLeavesFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },

    getCancellableLeavesRequest(state) {
      state.applicationsLoading = true;
    },
    getCancellableLeavesSuccess(
      state,
      action: PayloadAction<LeaveApplication[]>
    ) {
      state.applicationsLoading = false;
      state.cancellableLeaves = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    getCancellableLeavesFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },

    createLeaveApplicationRequest(
      state,
      _action: PayloadAction<CreateLeaveApplicationRequest>
    ) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    createLeaveApplicationSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.success = true;
      state.message = "Leave application submitted successfully";
      if (!Array.isArray(state.leaveApplications)) {
        state.leaveApplications = [];
      }
      state.leaveApplications = [action.payload, ...state.leaveApplications];
    },
    createLeaveApplicationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    cancelLeaveApplicationRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    cancelLeaveApplicationSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.success = true;
      state.message = "Leave application cancelled successfully";
      const apps = Array.isArray(state.leaveApplications)
        ? state.leaveApplications
        : [];
      const cancellable = Array.isArray(state.cancellableLeaves)
        ? state.cancellableLeaves
        : [];

      state.leaveApplications = apps.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
      state.cancellableLeaves = cancellable.filter(
        (app) => app.id !== action.payload.id
      );
    },
    cancelLeaveApplicationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Applications - Admin/Manager
    // ==========================================
    getAllLeavesRequest(
      state,
      _action: PayloadAction<GetLeaveApplicationsParams | undefined>
    ) {
      state.applicationsLoading = true;
      state.applicationsError = null;
    },
    getAllLeavesSuccess(
      state,
      action: PayloadAction<{
        applications: LeaveApplication[];
        pagination?: Pagination;
      }>
    ) {
      state.applicationsLoading = false;
      state.leaveApplications = Array.isArray(action.payload.applications)
        ? action.payload.applications
        : [];
      state.pagination = action.payload.pagination || null;
    },
    getAllLeavesFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },

    getPendingLeavesRequest(
      state,
      _action: PayloadAction<GetLeaveApplicationsParams | undefined>
    ) {
      state.applicationsLoading = true;
      state.applicationsError = null;
    },
    getPendingLeavesSuccess(
      state,
      action: PayloadAction<{
        applications: LeaveApplication[];
        pagination?: Pagination;
      }>
    ) {
      state.applicationsLoading = false;
      state.pendingApplications = Array.isArray(action.payload.applications)
        ? action.payload.applications
        : [];
      state.pagination = action.payload.pagination || null;
    },
    getPendingLeavesFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },
    
    getPendingCancellationsRequest(
      state,
      _action: PayloadAction<GetLeaveApplicationsParams | undefined>
    ) {
      state.applicationsLoading = true;
      state.applicationsError = null;
    },
    getPendingCancellationsSuccess(
      state,
      action: PayloadAction<{
        applications: LeaveApplication[];
        pagination?: Pagination;
      }>
    ) {
      state.applicationsLoading = false;
      state.pendingCancellations = Array.isArray(action.payload.applications)
        ? action.payload.applications
        : [];
      state.pagination = action.payload.pagination || null;
    },
    getPendingCancellationsFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },

    getLeaveApplicationByIdRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    getLeaveApplicationByIdSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.currentApplication = action.payload;
    },
    getLeaveApplicationByIdFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    approveLeaveRequest(state, _action: PayloadAction<ApproveLeaveRequest>) {
      state.loading = true;
      state.error = null;
    },
    approveLeaveSuccess(state, action: PayloadAction<LeaveApplication>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave application approved";
      // Remove from pending if fully approved or moved to next stage
      state.pendingApplications = state.pendingApplications.filter(
        (app) => app.id !== action.payload.id
      );
      state.leaveApplications = state.leaveApplications.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
    },
    approveLeaveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    rejectLeaveRequest(state, _action: PayloadAction<RejectLeaveRequest>) {
      state.loading = true;
      state.error = null;
    },
    rejectLeaveSuccess(state, action: PayloadAction<LeaveApplication>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave application rejected";
      state.pendingApplications = state.pendingApplications.filter(
        (app) => app.id !== action.payload.id
      );
      state.leaveApplications = state.leaveApplications.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
    },
    rejectLeaveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Cancellation Request Flow
    // ==========================================
    requestLeaveCancellationRequest(
      state,
      _action: PayloadAction<RequestLeaveCancellationRequest>
    ) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    requestLeaveCancellationSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.success = true;
      state.message = "Leave cancellation request submitted successfully";
      state.leaveApplications = state.leaveApplications.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
    },
    requestLeaveCancellationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    approveLeaveCancellationRequest(
      state,
      _action: PayloadAction<ApproveLeaveCancellationRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    approveLeaveCancellationSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.success = true;
      state.message = "Leave cancellation approved";
      state.pendingCancellations = state.pendingCancellations.filter(
        (app) => app.id !== action.payload.id
      );
      state.leaveApplications = state.leaveApplications.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
    },
    approveLeaveCancellationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    rejectLeaveCancellationRequest(
      state,
      _action: PayloadAction<RejectLeaveCancellationRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    rejectLeaveCancellationSuccess(
      state,
      action: PayloadAction<LeaveApplication>
    ) {
      state.loading = false;
      state.success = true;
      state.message = "Leave cancellation rejected";
      state.pendingCancellations = state.pendingCancellations.filter(
        (app) => app.id !== action.payload.id
      );
      state.leaveApplications = state.leaveApplications.map((app) =>
        app.id === action.payload.id ? action.payload : app
      );
    },
    rejectLeaveCancellationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // On Leave Employees
    // ==========================================
    getOnLeaveEmployeesRequest(
      state,
      _action: PayloadAction<GetLeaveApplicationsParams | undefined>
    ) {
      state.applicationsLoading = true;
    },
    getOnLeaveEmployeesSuccess(
      state,
      action: PayloadAction<{ 
          count: number; 
          employees: OnLeaveDetailedEmployee[];
          total: number;
          page: number;
          totalPages: number;
     }>
    ) {
      state.applicationsLoading = false;
      state.onLeaveCount = action.payload.count;
      state.onLeaveEmployees = action.payload.employees;
      state.onLeavePagination = {
          total: action.payload.total,
          page: action.payload.page,
          totalPages: action.payload.totalPages,
          limit: 10 // Default hardcoded or we can pass it if available
      };
    },
    getOnLeaveEmployeesFailure(state, action: PayloadAction<string>) {
      state.applicationsLoading = false;
      state.applicationsError = action.payload;
    },

    // ==========================================
    // Leave Recalls
    // ==========================================
    getMyRecallNotificationsRequest(state) {
      state.recallsLoading = true;
      state.recallsError = null;
    },
    getMyRecallNotificationsSuccess(
      state,
      action: PayloadAction<LeaveRecall[]>
    ) {
      state.recallsLoading = false;
      state.myRecallNotifications = action.payload;
    },
    getMyRecallNotificationsFailure(state, action: PayloadAction<string>) {
      state.recallsLoading = false;
      state.recallsError = action.payload;
    },

    getAllRecallsRequest(
      state,
      _action: PayloadAction<
        {
          page?: number;
          limit?: number;
          status?: string;
        } | undefined
      >
    ) {
      state.recallsLoading = true;
      state.recallsError = null;
    },
    getAllRecallsSuccess(
      state,
      action: PayloadAction<{
        recalls: LeaveRecall[];
        pagination?: Pagination;
      }>
    ) {
      state.recallsLoading = false;
      state.leaveRecalls = action.payload.recalls;
      state.pagination = action.payload.pagination || null;
    },
    getAllRecallsFailure(state, action: PayloadAction<string>) {
      state.recallsLoading = false;
      state.recallsError = action.payload;
    },

    getActiveLeavesForRecallRequest(state) {
      state.recallsLoading = true;
      state.recallsError = null;
    },
    getActiveLeavesForRecallSuccess(
      state,
      action: PayloadAction<LeaveApplication[]>
    ) {
      state.recallsLoading = false;
      state.activeLeavesForRecall = action.payload;
    },
    getActiveLeavesForRecallFailure(state, action: PayloadAction<string>) {
      state.recallsLoading = false;
      state.recallsError = action.payload;
    },

    createRecallRequest(
      state,
      _action: PayloadAction<CreateLeaveRecallRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    createRecallSuccess(state, action: PayloadAction<LeaveRecall>) {
      state.loading = false;
      state.success = true;
      state.message = "Recall request sent successfully";
      state.leaveRecalls = [action.payload, ...state.leaveRecalls];
      // Remove from active leaves
      if (Array.isArray(state.activeLeavesForRecall)) {
        state.activeLeavesForRecall = state.activeLeavesForRecall.filter(
          (al) => al.id !== action.payload.leave_application_id
        );
      }
    },
    createRecallFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    respondToRecallRequest(
      state,
      _action: PayloadAction<RespondToRecallRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    respondToRecallSuccess(state, action: PayloadAction<LeaveRecall>) {
      state.loading = false;
      state.success = true;
      state.message =
        action.payload.status === "ACCEPTED"
          ? "You have accepted the recall. Please report to work."
          : "Your decline has been submitted to your manager.";
      state.myRecallNotifications = state.myRecallNotifications.filter(
        (recall) => recall.id !== action.payload.id
      );
    },
    respondToRecallFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    cancelRecallRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    cancelRecallSuccess(state, action: PayloadAction<number>) {
      state.loading = false;
      state.success = true;
      state.message = "Recall request cancelled";
      state.leaveRecalls = state.leaveRecalls.filter(
        (r) => r.id !== action.payload
      );
    },
    cancelRecallFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Relief Officers
    // ==========================================
    getReliefOfficersRequest(state) {
      state.reliefOfficersLoading = true;
    },
    getReliefOfficersSuccess(
      state,
      action: PayloadAction<ReliefOfficerOption[]>
    ) {
      state.reliefOfficersLoading = false;
      state.reliefOfficers = action.payload;
    },
    getReliefOfficersFailure(state, action: PayloadAction<string>) {
      state.reliefOfficersLoading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Statistics
    // ==========================================
    getLeaveStatsRequest(state) {
      state.statsLoading = true;
    },
    getLeaveStatsSuccess(state, action: PayloadAction<LeaveStatsResponse>) {
      state.statsLoading = false;
      state.leaveStats = action.payload;
    },
    getLeaveStatsFailure(state, action: PayloadAction<string>) {
      state.statsLoading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Tab Counts
    // ==========================================
    getTabCountsRequest(state, _action: PayloadAction<any>) {
      state.tabCountsLoading = true;
    },
    getTabCountsSuccess(state, action: PayloadAction<TabCounts>) {
      state.tabCountsLoading = false;
      state.tabCounts = action.payload;
    },
    getTabCountsFailure(state, _action: PayloadAction<string>) {
      state.tabCountsLoading = false;
    },

    // ==========================================
    // Public Holidays
    // ==========================================
    getPublicHolidaysRequest(
      state,
      _action: PayloadAction<{ year?: number } | undefined>
    ) {
      state.holidaysLoading = true;
      state.holidaysError = null;
    },
    getPublicHolidaysSuccess(state, action: PayloadAction<PublicHoliday[]>) {
      state.holidaysLoading = false;
      state.publicHolidays = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    getPublicHolidaysFailure(state, action: PayloadAction<string>) {
      state.holidaysLoading = false;
      state.holidaysError = action.payload;
    },

    getUpcomingHolidaysRequest(
      state,
      _action?: PayloadAction<{ limit?: number }>
    ) {
      state.holidaysLoading = true;
    },
    getUpcomingHolidaysSuccess(state, action: PayloadAction<PublicHoliday[]>) {
      state.holidaysLoading = false;
      state.upcomingHolidays = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    getUpcomingHolidaysFailure(state, action: PayloadAction<string>) {
      state.holidaysLoading = false;
      state.holidaysError = action.payload;
    },

    createPublicHolidayRequest(
      state,
      _action: PayloadAction<CreatePublicHolidayRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    createPublicHolidaySuccess(state, action: PayloadAction<PublicHoliday>) {
      state.loading = false;
      state.success = true;
      state.message = "Public holiday created successfully";
      const current = Array.isArray(state.publicHolidays)
        ? state.publicHolidays
        : [];
      state.publicHolidays = [...current, action.payload];
    },
    createPublicHolidayFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    updatePublicHolidayRequest(
      state,
      _action: PayloadAction<UpdatePublicHolidayRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    updatePublicHolidaySuccess(state, action: PayloadAction<PublicHoliday>) {
      state.loading = false;
      state.success = true;
      state.message = "Public holiday updated successfully";
      const current = Array.isArray(state.publicHolidays)
        ? state.publicHolidays
        : [];
      // Create a completely new array with a new holiday object to ensure React detects the change
      state.publicHolidays = current.map((h) => {
        if (h.id === action.payload.id) {
          // Return a completely new object with all fields from the API response
          return {
            ...action.payload,
            // Ensure holiday_date is preserved (API uses this field)
            holiday_date:
              action.payload.holiday_date ||
              (action.payload as any).date ||
              (h as any).holiday_date,
          } as PublicHoliday;
        }
        // Return existing holidays as-is to maintain references
        return h;
      });
    },
    updatePublicHolidayFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    deletePublicHolidayRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    deletePublicHolidaySuccess(state, action: PayloadAction<number>) {
      state.loading = false;
      state.success = true;
      state.message = "Public holiday deleted successfully";
      const current = Array.isArray(state.publicHolidays)
        ? state.publicHolidays
        : [];
      state.publicHolidays = current.filter((h) => h.id !== action.payload);
    },
    deletePublicHolidayFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    seedDefaultHolidaysRequest(state) {
      state.loading = true;
      state.error = null;
    },
    seedDefaultHolidaysSuccess(state, action: PayloadAction<PublicHoliday[]>) {
      state.loading = false;
      state.success = true;
      state.message = "Default Ethiopian holidays created successfully";
      state.publicHolidays = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    seedDefaultHolidaysFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Settings
    // ==========================================
    getLeaveSettingsRequest(state) {
      state.settingsLoading = true;
      state.settingsError = null;
    },
    getLeaveSettingsSuccess(state, action: PayloadAction<LeaveSettings>) {
      state.settingsLoading = false;
      state.leaveSettings = action.payload;
    },
    getLeaveSettingsFailure(state, action: PayloadAction<string>) {
      state.settingsLoading = false;
      state.settingsError = action.payload;
    },

    updateLeaveSettingsRequest(
      state,
      _action: PayloadAction<UpdateLeaveSettingsRequest>
    ) {
      state.loading = true;
      state.error = null;
    },
    updateLeaveSettingsSuccess(state, action: PayloadAction<LeaveSettings>) {
      state.loading = false;
      state.success = true;
      state.message = "Leave settings updated successfully";
      state.leaveSettings = action.payload;
    },
    updateLeaveSettingsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Enhanced Leave Balance
    // ==========================================
    getEnhancedBalanceRequest(state) {
      state.leaveBalanceLoading = true;
      state.leaveBalanceError = null;
    },
    getEnhancedBalanceSuccess(
      state,
      action: PayloadAction<{
        fiscal_year: number;
        accrual_settings: AccrualSettingsInfo;
        balances: EnhancedLeaveBalance[];
      }>
    ) {
      state.leaveBalanceLoading = false;
      state.currentFiscalYear = action.payload.fiscal_year;
      state.accrualSettings = action.payload.accrual_settings;
      state.enhancedBalance = action.payload.balances;
      // Also update the regular leaveBalance for backward compatibility
      state.leaveBalance = action.payload.balances;
    },
    getEnhancedBalanceFailure(state, action: PayloadAction<string>) {
      state.leaveBalanceLoading = false;
      state.leaveBalanceError = action.payload;
    },

    // ==========================================
    // Expiring Leave Balances
    // ==========================================
    getExpiringBalancesRequest(
      state,
      _action: PayloadAction<
        { days_threshold?: number; page?: number; limit?: number } | undefined
      >
    ) {
      state.expiringBalancesLoading = true;
    },
    getExpiringBalancesSuccess(state, action: PayloadAction<ExpiringBalance[]>) {
      state.expiringBalancesLoading = false;
      state.expiringBalances = action.payload;
    },
    getExpiringBalancesFailure(state, action: PayloadAction<string>) {
      state.expiringBalancesLoading = false;
      state.error = action.payload;
    },

    notifyExpiringBalancesRequest(state, _action: PayloadAction<NotifyExpiringRequest | undefined>) {
      state.loading = true;
      state.error = null;
    },
    notifyExpiringBalancesSuccess(state, action: PayloadAction<{ notified: number }>) {
      state.loading = false;
      state.success = true;
      state.message = `Expiry notifications sent to ${action.payload.notified} employees`;
    },
    notifyExpiringBalancesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // ==========================================
    // Leave Cash-Out
    // ==========================================
    calculateCashOutRequest(state) {
      state.cashOutLoading = true;
      state.cashOutError = null;
    },
    calculateCashOutSuccess(state, action: PayloadAction<CashOutCalculation>) {
      state.cashOutLoading = false;
      state.cashOutCalculation = action.payload;
    },
    calculateCashOutFailure(state, action: PayloadAction<string>) {
      state.cashOutLoading = false;
      state.cashOutError = action.payload;
    },

    requestCashOutRequest(state, _action: PayloadAction<CreateCashOutRequest>) {
      state.cashOutLoading = true;
      state.cashOutError = null;
    },
    requestCashOutSuccess(state, action: PayloadAction<CashOutRequest>) {
      state.cashOutLoading = false;
      state.success = true;
      state.message = "Cash-out request submitted successfully";
      state.myCashOutRequests = [action.payload, ...state.myCashOutRequests];
    },
    requestCashOutFailure(state, action: PayloadAction<string>) {
      state.cashOutLoading = false;
      state.cashOutError = action.payload;
    },

    getMyCashOutRequestsRequest(state) {
      state.cashOutLoading = true;
      state.cashOutError = null;
    },
    getMyCashOutRequestsSuccess(state, action: PayloadAction<CashOutRequest[]>) {
      state.cashOutLoading = false;
      state.myCashOutRequests = action.payload;
    },
    getMyCashOutRequestsFailure(state, action: PayloadAction<string>) {
      state.cashOutLoading = false;
      state.cashOutError = action.payload;
    },

    getAllCashOutRequestsRequest(
      state,
      _action: PayloadAction<{ status?: string; page?: number; limit?: number } | undefined>
    ) {
      state.cashOutLoading = true;
      state.cashOutError = null;
    },
    getAllCashOutRequestsSuccess(
      state,
      action: PayloadAction<{ requests: CashOutRequest[]; pagination?: Pagination }>
    ) {
      state.cashOutLoading = false;
      state.allCashOutRequests = action.payload.requests;
      state.pagination = action.payload.pagination || null;
    },
    getAllCashOutRequestsFailure(state, action: PayloadAction<string>) {
      state.cashOutLoading = false;
      state.cashOutError = action.payload;
    },

    approveCashOutRequest(state, _action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
    },
    approveCashOutSuccess(state, action: PayloadAction<CashOutRequest>) {
      state.loading = false;
      state.success = true;
      state.message = "Cash-out request approved";
      state.allCashOutRequests = state.allCashOutRequests.map((req) =>
        req.id === action.payload.id ? action.payload : req
      );
    },
    approveCashOutFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    rejectCashOutRequest(state, _action: PayloadAction<RejectCashOutRequest>) {
      state.loading = true;
      state.error = null;
    },
    rejectCashOutSuccess(state, action: PayloadAction<CashOutRequest>) {
      state.loading = false;
      state.success = true;
      state.message = "Cash-out request rejected";
      state.allCashOutRequests = state.allCashOutRequests.map((req) =>
        req.id === action.payload.id ? action.payload : req
      );
    },
    rejectCashOutFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: leaveActions } = slice;

export const useLeaveSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: leaveSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
