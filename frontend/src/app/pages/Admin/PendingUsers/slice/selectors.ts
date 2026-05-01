import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { RootState } from '../../../../../store/types/RootState';

const selectSlice = (state: RootState) => (state as any).pendingUsers || initialState;

export const selectPendingUsers = createSelector(
  [selectSlice],
  (state) => state.users,
);

export const selectPendingUsersLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectPendingUsersError = createSelector(
  [selectSlice],
  (state) => state.error,
);
