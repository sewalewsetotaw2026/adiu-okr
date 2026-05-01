import { createSelector } from "@reduxjs/toolkit";
import { ManagerState } from "./types";

interface StateWithManager {
  manager?: ManagerState;
}

const initialState: ManagerState = {
    isManager: false,
    teamMembers: [],
    teamLeaveApplications: [],
    teamOnLeaveToday: [],
    loading: false,
    error: null,
    pagination: {
        page: 1,
        limit: 10,
        totalPages: 1,
        total: 0,
    },
};

const selectManagerState = (state: StateWithManager) => state.manager || initialState;

export const selectIsManager = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.isManager
);

export const selectTeamMembers = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.teamMembers
);

export const selectTeamLeaveApplications = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.teamLeaveApplications
);

export const selectTeamOnLeaveToday = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.teamOnLeaveToday
);

export const selectManagerLoading = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.loading
);

export const selectManagerError = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.error
);

export const selectManagerPagination = createSelector(
  [selectManagerState],
  (state: ManagerState) => state.pagination
);
