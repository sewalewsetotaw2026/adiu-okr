import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { RootState } from 'types';

const selectSlice = (state: RootState) => state.promotion || initialState;

export const selectPromotionEmployee = createSelector(
  [selectSlice],
  state => state.employee,
);

export const selectPromotionLoading = createSelector(
  [selectSlice],
  state => state.loading,
);

export const selectPromotionError = createSelector(
  [selectSlice],
  state => state.error,
);

export const selectPromotionSuccess = createSelector(
  [selectSlice],
  state => state.success,
);
