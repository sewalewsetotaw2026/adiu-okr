import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { RootState } from '../../../../../store/types/RootState';

const selectSlice = (state: RootState) => state.dashboard || initialState;

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
