import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { managerListSaga } from "./saga";
import { Employee } from "../../Employees/slice/types";

import { ManagerListState } from "./types";

export const initialState: ManagerListState = {
  loading: false,
  error: null,
  managers: [],
  selectedManager: null,
  directReports: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    department: "",
    job_title: "",
    job_level: "",
  },
  lastFetched: null,
  pages: {},
  directReportsCache: {},
};

const slice = createSlice({
  name: "managerList",
  initialState,
  reducers: {
    fetchManagersRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchManagersSuccess(
      state,
      action: PayloadAction<{
        managers: Employee[];
        total: number;
        page: number;
      }>,
    ) {
      state.loading = false;
      state.managers = action.payload.managers;
      state.pagination.total = action.payload.total;
      state.pagination.totalPages = Math.ceil(
        action.payload.total / state.pagination.limit,
      );
      state.lastFetched = Date.now();
      state.pages[action.payload.page] = action.payload.managers;
    },
    fetchManagersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setFilters(
      state,
      action: PayloadAction<Partial<typeof initialState.filters>>,
    ) {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1;
      state.lastFetched = null;
      state.pages = {}; // Invalidate cache on filter change
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.pagination.page = 1;
      state.lastFetched = null;
      state.pages = {}; // Invalidate cache on reset
    },
    setPage(state, action: PayloadAction<number>) {
      state.pagination.page = action.payload;
    },
    refresh(state) {
      state.pages = {};
      state.lastFetched = null;
    },
    // Manager Detail Actions
    fetchDirectReportsRequest(state, _action: PayloadAction<string>) {
      // payload is managerId
      state.loading = true;
      state.error = null;
    },
    fetchDirectReportsSuccess(
      state,
      action: PayloadAction<{ managerId: string; reports: Employee[] }>,
    ) {
      state.loading = false;
      state.directReports = action.payload.reports;
      state.directReportsCache[action.payload.managerId] = {
        data: action.payload.reports,
        lastFetched: Date.now(),
      };
    },
    fetchDirectReportsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setSelectedManager(state, action: PayloadAction<Employee | null>) {
      state.selectedManager = action.payload;
    },
    removeTeamMemberRequest(
      state,
      _action: PayloadAction<{ employee_id: string; manager_id: string }>,
    ) {
      state.loading = true;
      state.error = null;
    },
    removeTeamMemberSuccess(state, _action: PayloadAction<string>) {
      state.loading = false;
    },
    removeTeamMemberFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: managerListActions } = slice;

export const useManagerListSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: managerListSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
