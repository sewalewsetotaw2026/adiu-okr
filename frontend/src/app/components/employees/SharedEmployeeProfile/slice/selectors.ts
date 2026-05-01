import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { EmployeeDetailState } from './types';
import { RootState } from '../../../../../../store/types/RootState';

const selectSlice = (state: RootState): EmployeeDetailState => (state as any).employeeDetail || initialState;

export const selectEmployee = createSelector(
  [selectSlice],
  (state) => state.employee,
);

export const selectEmployeeLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectEmployeeError = createSelector(
  [selectSlice],
  (state) => state.error,
);

export const selectApproveSuccess = createSelector(
  [selectSlice],
  (state) => state.approveSuccess,
);

export const selectUpdateSuccess = createSelector(
  [selectSlice],
  (state) => state.updateSuccess,
);

export const selectDetailsCache = createSelector(
  [selectSlice],
  (state) => state.detailsCache,
);
