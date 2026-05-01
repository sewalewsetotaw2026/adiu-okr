import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { RootState } from '../../../../../store/types/RootState';

const selectSlice = (state: RootState) => (state as any).submittedUsers || initialState;

export const selectSubmittedUsers = createSelector(
  [selectSlice],
  (state) => state.users,
);

export const selectSubmittedUsersLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectSubmittedUsersError = createSelector(
  [selectSlice],
  (state) => state.error,
);

export const selectSelectedSubmittedUser = createSelector(
  [selectSlice],
  (state) => state.selectedUser,
);

export const selectApproving = createSelector(
  [selectSlice],
  (state) => state.approving,
);

export const selectRejecting = createSelector(
  [selectSlice],
  (state) => state.rejecting,
);
