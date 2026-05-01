import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../store/types/RootState';
import { AdminState } from './types';

const selectAdminState = (state: RootState): AdminState => state.admin || {};

export const selectRoles = createSelector(
  [selectAdminState],
  (adminState) => adminState.roles || []
);

export const selectDepartments = createSelector(
  [selectAdminState],
  (adminState) => adminState.departments || []
);

export const selectJobTitles = createSelector(
  [selectAdminState],
  (adminState) => adminState.jobTitles || []
);

export const selectDepartmentCount = createSelector(
  [selectAdminState],
  (adminState) => adminState.departmentCount
);

export const selectAdminLoading = createSelector(
  [selectAdminState],
  (adminState) => adminState.loading || false
);

export const selectAdminIsError = createSelector(
  [selectAdminState],
  (adminState) => adminState.isError || false
);

export const selectAdminIsSuccess = createSelector(
  [selectAdminState],
  (adminState) => adminState.isSuccess || false
);

export const selectAdminMessage = createSelector(
  [selectAdminState],
  (adminState) => adminState.message || ''
);

export const selectAdminError = createSelector(
  [selectAdminState],
  (adminState) => adminState.error
);

