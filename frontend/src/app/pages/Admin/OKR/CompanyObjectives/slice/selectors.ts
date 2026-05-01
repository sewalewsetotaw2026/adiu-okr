import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../../../../../../store/types/RootState";
import { initialState } from ".";

const selectDomain = (state: RootState) =>
  state.companyObjectives || initialState;

export const selectObjectives = createSelector(
  [selectDomain],
  (state) => state.objectives,
);

export const selectObjectivesLoading = createSelector(
  [selectDomain],
  (state) => state.loading,
);

export const selectObjectivesError = createSelector(
  [selectDomain],
  (state) => state.error,
);
