import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { dashboardSaga } from "./saga";
import { DashboardState, DashboardStats } from "./types";

export const initialState: DashboardState = {
  loading: false,
  error: null,
  stats: {
    totalEmployees: 0,
    totalDepartments: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    totalManagers: 0,
    genderDist: { male: 0, female: 0 },
    empTypeDist: {},
    deptDist: {},
    jobLevelDist: {},
    managerDist: {},
    departmentBreakdown: {},
    tenureDistribution: {},
    probationStatus: {},
  },
};

const slice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    fetchStatsRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchStatsSuccess(state, action: PayloadAction<DashboardStats>) {
      state.loading = false;
      state.stats = action.payload;
    },
    fetchStatsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: dashboardActions } = slice;

export const useDashboardSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: dashboardSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
