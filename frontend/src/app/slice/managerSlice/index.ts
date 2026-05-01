import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ManagerState, GetTeamLeaveApplicationsPayload } from "./types";

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

const managerSlice = createSlice({
  name: "manager",
  initialState,
  reducers: {
    checkIsManager(_state) {
      // Background check
    },
    checkIsManagerSuccess(state, action: PayloadAction<boolean>) {
      state.isManager = action.payload;
    },
    checkIsManagerFailure(state, action: PayloadAction<string>) {
      // Silent fail
      state.error = action.payload;
    },

    getMyTeam(state, _action: PayloadAction<{ recursive?: boolean } | undefined>) {
      state.loading = true;
      state.error = null;
    },
    getMyTeamSuccess(state, action: PayloadAction<any[]>) {
      state.loading = false;
      state.teamMembers = action.payload;
    },
    getMyTeamFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    getTeamLeaveApplications(state, action: PayloadAction<GetTeamLeaveApplicationsPayload>) {
      state.loading = true;
      state.error = null;
    },
    getTeamLeaveApplicationsSuccess(state, action: PayloadAction<any>) {
      state.loading = false;
      state.teamLeaveApplications = action.payload.applications;
      state.pagination = {
        page: action.payload.page,
        limit: 10, // Assuming fixed or from payload if available
        total: action.payload.total,
        totalPages: action.payload.totalPages,
      };
    },
    getTeamLeaveApplicationsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    getTeamOnLeaveToday(state) {
      state.loading = true;
      state.error = null;
    },
    getTeamOnLeaveTodaySuccess(state, action: PayloadAction<any[]>) {
      state.loading = false;
      state.teamOnLeaveToday = action.payload;
    },
    getTeamOnLeaveTodayFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: managerActions, reducer: managerReducer } = managerSlice;

import { useInjectReducer, useInjectSaga } from "redux-injectors";
import managerSaga from "./saga";

export const useManagerSlice = () => {
  useInjectReducer({ key: managerSlice.name, reducer: managerSlice.reducer });
  useInjectSaga({ key: managerSlice.name, saga: managerSaga });
  return { actions: managerSlice.actions };
};
