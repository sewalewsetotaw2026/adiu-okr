import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../store/types/RootState';
import { UserState } from './types';

const selectUserState = (state: RootState): UserState => state.user || {};

export const selectUsers = createSelector(
  [selectUserState],
  (userState) => userState.users || []
);

export const selectCurrentUser = createSelector(
  [selectUserState],
  (userState) => userState.currentUser
);

export const selectUserCount = createSelector(
  [selectUserState],
  (userState) => userState.userCount
);

export const selectUserLoading = createSelector(
  [selectUserState],
  (userState) => userState.loading || false
);

export const selectUserIsError = createSelector(
  [selectUserState],
  (userState) => userState.isError || false
);

export const selectUserIsSuccess = createSelector(
  [selectUserState],
  (userState) => userState.isSuccess || false
);

export const selectUserMessage = createSelector(
  [selectUserState],
  (userState) => userState.message || ''
);

export const selectUserError = createSelector(
  [selectUserState],
  (userState) => userState.error
);

export const selectUserPagination = createSelector(
  [selectUserState],
  (userState) => userState.pagination
);

