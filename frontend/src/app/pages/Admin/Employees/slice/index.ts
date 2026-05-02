import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { employeesSaga } from "./saga";
import { EmployeesState, Employee, EmployeeFilters } from "./types";

const defaultPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export const initialState: EmployeesState = {
  loading: false,
  error: null,
  active: {
    data: [],
    pagination: defaultPagination,
    lastFetched: null,
    pages: {},
  },
  pending: {
    data: [],
    pagination: defaultPagination,
    lastFetched: null,
    pages: {},
  },
  inprogress: {
    data: [],
    pagination: defaultPagination,
    lastFetched: null,
    pages: {},
  },
  inactive: {
    data: [],
    pagination: defaultPagination,
    lastFetched: null,
    pages: {},
  },
  probation: {
    data: [],
    pagination: defaultPagination,
    lastFetched: null,
    pages: {},
  },
  selectedEmployee: null,
  detailsCache: {},
  approveSuccess: false,
  deleteSuccess: false,
  activateSuccess: false,
  exportSuccess: false,
  filters: {
    gender: "",
    department: "",
    job_title: "",
    job_level: "",
    sort_by: "",
    search: "",
    cost_sharing_status: "",
  },
  globalTabCounts: {
    active: 0,
    pending: 0,
    inprogress: 0,
    inactive: 0,
    probation: 0,
  },
  activeTab: "active",
  lastInvalidated: null,
};

const slice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    setEmployeeFilters(
      state,
      action: PayloadAction<Partial<import("./types").EmployeeFilters>>,
    ) {
      state.filters = { ...state.filters, ...action.payload };
      // When filters change, invalidate cache completely
      state.active.lastFetched = null;
      state.active.pages = {};
      state.pending.lastFetched = null;
      state.pending.pages = {};
      state.inprogress.lastFetched = null;
      state.inprogress.pages = {};
      state.inactive.lastFetched = null;
      state.inactive.pages = {};
      state.probation.lastFetched = null;
      state.probation.pages = {};
    },
    setEmployeeTab(
      state,
      action: PayloadAction<
        "active" | "pending" | "inprogress" | "inactive" | "probation"
      >,
    ) {
      state.activeTab = action.payload;
    },
    setPage(state, action: PayloadAction<number>) {
      const target = state.activeTab;
      state[target].pagination.page = action.payload;
      // Do NOT invalidate lastFetched or pages here to allow caching
    },
    resetEmployeeFilters(state) {
      state.filters = initialState.filters;
      state.active.lastFetched = null;
      state.active.pages = {};
      state.pending.lastFetched = null;
      state.pending.pages = {};
      state.inprogress.lastFetched = null;
      state.inprogress.pages = {};
      state.inactive.lastFetched = null;
      state.inactive.pages = {};
      state.probation.lastFetched = null;
      state.probation.pages = {};
      state.active.pagination.page = 1;
      state.pending.pagination.page = 1;
      state.inprogress.pagination.page = 1;
      state.inactive.pagination.page = 1;
      state.probation.pagination.page = 1;
    },
    fetchAllEmployeesRequest(
      state,
      _action: PayloadAction<
        | {
            page: number;
            limit: number;
            status?: string;
            is_active?: boolean;
            gender?: string;
            department?: string;
            job_title?: string;
            job_level?: string;
            sort_by?: string;
            search?: string;
            cost_sharing_status?: string;
            probation_status?: string;
            refresh?: boolean;
          }
        | undefined
      >,
    ) {
      state.loading = true;
      state.error = null;
    },
    fetchEmployeeTabCountsRequest(_state) {
      // Background fetch, so don't necessarily need to set loading=true
      // unless we want a dedicated spinner for the tabs themselves
    },
    fetchEmployeeTabCountsSuccess(
      state,
      action: PayloadAction<{
        active: number;
        pending: number;
        inprogress: number;
        inactive: number;
        probation: number;
      }>,
    ) {
      state.globalTabCounts = action.payload;
    },
    fetchEmployeeTabCountsFailure(_state, _action: PayloadAction<string>) {
      // Silent fail or toast, no need to break the UI
    },
    fetchAllEmployeesSuccess(
      state,
      action: PayloadAction<{
        employees: Employee[];
        total: number;
        page: number;
        limit: number;
      }>,
    ) {
      state.loading = false;
      const target = state.activeTab;

      // Update cache for this page
      state[target].pages[action.payload.page] = action.payload.employees;

      // Update current view data
      state[target].data = action.payload.employees;

      state[target].pagination = {
        page: action.payload.page,
        limit: action.payload.limit,
        total: action.payload.total,
        totalPages: Math.ceil(action.payload.total / action.payload.limit),
      };
      state[target].lastFetched = Date.now();
    },
    fetchAllEmployeesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    fetchEmployeeRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    fetchEmployeeSuccess(state, action: PayloadAction<Employee>) {
      state.loading = false;
      state.selectedEmployee = action.payload;
      state.detailsCache[action.payload.id] = {
        data: action.payload,
        lastFetched: Date.now(),
      };
    },
    fetchEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    clearSelectedEmployee(state) {
      state.selectedEmployee = null;
    },
    updateEmployeeRequest(
      state,
      _action: PayloadAction<{ id: string } & Partial<Employee>>,
    ) {
      state.loading = true;
      state.error = null;
    },
    updateEmployeeSuccess(state, action: PayloadAction<Employee>) {
      state.loading = false;
      state.selectedEmployee = action.payload;
      state.detailsCache[action.payload.id] = {
        data: action.payload,
        lastFetched: Date.now(),
      };
    },
    updateEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    approveEmployeeRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.approveSuccess = false;
    },
    approveEmployeeSuccess(state) {
      state.loading = false;
      state.approveSuccess = true;
      state.lastInvalidated = Date.now();
      // Invalidate pending cache to force refresh list
      state.pending.pages = {};
      state.active.pages = {}; // Also active since new employee moves there
    },
    approveEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.approveSuccess = false;
    },
    deleteEmployeeRequest(
      state,
      _action: PayloadAction<{ id: string; hard_delete?: boolean } | string>,
    ) {
      state.loading = true;
      state.error = null;
      state.deleteSuccess = false;
    },
    deleteEmployeeSuccess(state) {
      state.loading = false;
      state.deleteSuccess = true;
      state.lastInvalidated = Date.now();
      // Invalidate all caches to be safe
      state.active.pages = {};
      state.pending.pages = {};
      state.inprogress.pages = {};
      state.inactive.pages = {};
      state.probation.pages = {};
    },
    deleteEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.deleteSuccess = false;
    },
    activateEmployeeRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.activateSuccess = false;
    },
    activateEmployeeSuccess(state) {
      state.loading = false;
      state.activateSuccess = true;
      state.lastInvalidated = Date.now();
      // Invalidate inactive cache (source) and active cache (dest)
      state.inactive.pages = {};
      state.active.pages = {};
      state.probation.pages = {};
    },
    activateEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.activateSuccess = false;
    },
    assignManagerRequest(
      state,
      _action: PayloadAction<{ managerId: string; employeeIds: string[] }>,
    ) {
      state.loading = true;
      state.error = null;
    },
    assignManagerSuccess(state) {
      state.loading = false;
    },
    assignManagerFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    // Export Actions
    exportEmployeesRequest(
      state,
      _action: PayloadAction<{
        scope: {
          type: "SINGLE" | "BULK";
          employee_id?: string;
          employee_ids?: string[];
          export_all?: boolean;
        };
        modules: Record<string, string[]>;
        format: "csv" | "excel" | "pdf";
        filters?: EmployeeFilters;
      }>,
    ) {
      state.loading = true; // Or use a separate exportLoading if we want to avoid blocking the table
      state.error = null;
    },
    exportEmployeesSuccess(state) {
      state.loading = false;
      state.exportSuccess = true;
      // We don't necessarily need to store the file, saga handles download
    },
    exportEmployeesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    resetSuccessStates(state) {
      state.approveSuccess = false;
      state.deleteSuccess = false;
      state.activateSuccess = false;
      state.exportSuccess = false;
      state.error = null;
    },
    invalidateCache(state) {
      state.lastInvalidated = Date.now();
      state.active.lastFetched = null;
      state.active.pages = {};
      state.pending.lastFetched = null;
      state.pending.pages = {};
      state.inprogress.lastFetched = null;
      state.inprogress.pages = {};
      state.inactive.lastFetched = null;
      state.inactive.pages = {};
      state.probation.lastFetched = null;
      state.probation.pages = {};
    },
  },
});

export const { actions: employeesActions } = slice;

export const useEmployeesSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: employeesSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
