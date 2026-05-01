import { createSelector } from '@reduxjs/toolkit';
import { initialState } from './index';
import { RootState } from '../../../../store/types/RootState';

const selectSlice = (state: RootState) => state.auth || initialState;

export const selectAuthUser = createSelector(
  [selectSlice],
  (state) => state.user,
);

export const selectAuthToken = createSelector(
  [selectSlice],
  (state) => state.token,
);

export const selectAuthLoading = createSelector(
  [selectSlice],
  (state) => state.loading,
);

export const selectAuthError = createSelector(
  [selectSlice],
  (state) => state.error,
);

export const selectAuthIsSuccess = createSelector(
  [selectSlice],
  (state) => state.isSuccess,
);

export const selectAuthIsError = createSelector(
  [selectSlice],
  (state) => state.isError,
);

export const selectAuthMessage = createSelector(
  [selectSlice],
  (state) => state.message,
);

export const selectIsAuthenticated = createSelector(
  [selectSlice],
  (state) => !!state.token && !!state.user,
);

