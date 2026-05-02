import { createSelector } from '@reduxjs/toolkit';
import { initialState } from './index';
import { RootState } from '../../../../../store/types/RootState';

const selectSlice = (state: RootState) => state.employeeDashboard || initialState;

export const selectDashboardStats = createSelector(
  [selectSlice],
  (state) => state.stats,
);

export const selectDashboardLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectDashboardError = createSelector(
  [selectSlice],
  (state) => state.error,
);
