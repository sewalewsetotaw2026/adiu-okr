import { createSelector } from "@reduxjs/toolkit";

const selectDomain = (state: any) => state?.createEmployee || {};

export const selectCreateEmployeeLoading = createSelector(
  selectDomain,
  (s) => s.loading as boolean,
);

export const selectCreateEmployeeError = createSelector(
  selectDomain,
  (s) => s.error as string | null,
);

export const selectCreateEmployeeSuccess = createSelector(
  selectDomain,
  (s) => s.success as boolean,
);
