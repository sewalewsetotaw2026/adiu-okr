import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../store/types/RootState';
import { EmploymentState } from './types';

const selectEmploymentState = (state: RootState): EmploymentState => state.employment || {};

export const selectEmployments = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.employments || []
);

export const selectCurrentEmployment = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.currentEmployment
);

export const selectEmploymentCount = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.employmentCount
);

export const selectActiveEmploymentCount = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.activeEmploymentCount
);

export const selectInactiveEmploymentCount = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.inactiveEmploymentCount
);

export const selectManagersCount = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.managersCount
);

export const selectGenderDistribution = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.genderDistribution
);

export const selectManagerDistribution = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.managerDistribution
);

export const selectJobDistribution = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.jobDistribution
);

export const selectDepartmentDistribution = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.departmentDistribution
);

export const selectEmploymentTypeDistribution = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.employmentTypeDistribution
);

export const selectEmploymentLoading = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.loading || false
);

export const selectEmploymentIsError = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.isError || false
);

export const selectEmploymentIsSuccess = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.isSuccess || false
);

export const selectEmploymentMessage = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.message || ''
);

export const selectEmploymentError = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.error
);

export const selectEmploymentPagination = createSelector(
  [selectEmploymentState],
  (employmentState) => employmentState.pagination
);

