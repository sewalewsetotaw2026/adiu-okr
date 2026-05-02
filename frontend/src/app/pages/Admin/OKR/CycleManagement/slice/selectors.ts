import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../../../../../../store/types/RootState";
import { initialState } from ".";

const selectDomain = (state: RootState) =>
  state.cycleManagement || initialState;

export const selectCycles = createSelector(
  [selectDomain],
  (state) => state.cycles,
);

export const selectCycleLoading = createSelector(
  [selectDomain],
  (state) => state.loading,
);

export const selectCycleError = createSelector(
  [selectDomain],
  (state) => state.error,
);

export const selectCycleSuccess = createSelector(
  [selectDomain],
  (state) => state.success,
);
