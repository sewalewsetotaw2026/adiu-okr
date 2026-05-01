import { createSelector } from "@reduxjs/toolkit";
import { initialState } from ".";
import { RootState } from "../../../../../store/types/RootState";

export const selectEmployeesState = (state: RootState) =>
  state.employees || initialState;
const selectSlice = selectEmployeesState;

export const selectAllEmployees = createSelector(
  [selectSlice],
  (state) => {
    const tabName = state.activeTab;
    return state[tabName]?.data || [];
  },
);

export const selectEmployeesLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectEmployeesError = createSelector(
  [selectSlice],
  (state) => state.error,
);

export const selectEmployeesPagination = createSelector(
  [selectSlice],
  (state) => {
    const tabName = state.activeTab;
    return state[tabName]?.pagination || {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    };
  },
);

export const selectLastFetched = createSelector(
  [selectSlice],
  (state) => {
    const tabName = state.activeTab;
    return state[tabName]?.lastFetched || null;
  },
);

export const selectSelectedEmployee = createSelector(
  [selectSlice],
  (state) => state.selectedEmployee,
);

export const selectEmployeeDetails = createSelector(
  [selectSlice],
  (state) => state.detailsCache,
);

export const selectApproveSuccess = createSelector(
  [selectSlice],
  (state) => state.approveSuccess,
);

export const selectDeleteSuccess = createSelector(
  [selectSlice],
  (state) => state.deleteSuccess,
);

export const selectActivateSuccess = createSelector(
  [selectSlice],
  (state) => state.activateSuccess,
);

export const selectEmployeeFilters = createSelector(
  [selectSlice],
  (state) => state.filters,
);

export const selectActiveTab = createSelector(
  [selectSlice],
  (state) => state.activeTab,
);

export const selectExportSuccess = createSelector(
  [selectSlice],
  (state) => state.exportSuccess,
);

export const selectLastInvalidated = createSelector(
  [selectSlice],
  (state) => state.lastInvalidated,
);

export const selectEmployeeStatusCounts = createSelector(
  [selectSlice],
  (state) => state.globalTabCounts,
);
