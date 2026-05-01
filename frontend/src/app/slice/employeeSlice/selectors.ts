import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../store/types/RootState';
import { EmployeeState } from './types';

const selectEmployeeState = (state: RootState): EmployeeState => state.employee || {};

export const selectEmployees = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.employees || []
);

export const selectCurrentEmployee = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.currentEmployee
);

export const selectEmployeeCount = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.employeeCount
);

export const selectEmployeeLoading = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.loading || false
);

export const selectEmployeeIsError = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.isError || false
);

export const selectEmployeeIsSuccess = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.isSuccess || false
);

export const selectEmployeeMessage = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.message || ''
);

export const selectEmployeeError = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.error
);

export const selectEmployeePagination = createSelector(
  [selectEmployeeState],
  (employeeState) => employeeState.pagination
);

