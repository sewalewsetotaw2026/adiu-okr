import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { dashboardSaga } from './saga';
import { DashboardState } from './types';

export const initialState: DashboardState = {
  stats: null,
  loading: false,
  error: null,
};

const slice = createSlice({
  name: 'employeeDashboard',
  initialState,
  reducers: {
    fetchStatsRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchStatsSuccess(state, action: PayloadAction<any>) {
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

export const useEmployeeDashboardSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: dashboardSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
