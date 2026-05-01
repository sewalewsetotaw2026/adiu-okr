import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { DepartmentsState } from './types';

// Define RootState interface or import it if it exists
interface RootState {
  departments?: DepartmentsState;
}

const selectSlice = (state: RootState) => state.departments || initialState;

export const selectDepartments = createSelector(
  [selectSlice],
  (state) => state.departments,
);

export const selectDepartmentsLoading = createSelector(
  [selectSlice],
  (state) => state.isLoading,
);

export const selectDepartmentsError = createSelector(
  [selectSlice],
  (state) => state.error,
);

export const selectDepartmentsPagination = createSelector(
  [selectSlice],
  (state) => state.pagination,
);
