import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../../../../store/types/RootState';
import { initialState } from '.';

const selectDomain = (state: RootState) => state.createAccount || initialState;

export const selectCreateAccountLoading = createSelector(
  [selectDomain],
  (createAccountState) => createAccountState.loading,
);

export const selectCreateAccountError = createSelector(
  [selectDomain],
  (createAccountState) => createAccountState.error,
);

export const selectCreateAccountSuccess = createSelector(
  [selectDomain],
  (createAccountState) => createAccountState.success,
);
