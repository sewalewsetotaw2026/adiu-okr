import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../../../../store/types/RootState';
import { initialState } from '.';

const selectDomain = (state: RootState) => state.jobTitles || initialState;

export const selectJobTitlesLoading = createSelector(
  [selectDomain],
  (state) => state.loading,
);

export const selectJobTitlesError = createSelector(
  [selectDomain],
  (state) => state.error,
);

export const selectAllJobTitles = createSelector(
  [selectDomain],
  (state) => state.jobTitles,
);
