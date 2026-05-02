import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../../../store/types/RootState';
import { initialState } from '.';

const selectDomain = (state: RootState) => state.createEmployment || initialState;

export const selectCreateEmploymentLoading = createSelector(
  [selectDomain],
  (state) => state.loading,
);

export const selectCreateEmploymentError = createSelector(
  [selectDomain],
  (state) => state.error,
);

export const selectCreateEmploymentSuccess = createSelector(
  [selectDomain],
  (state) => state.success,
);
