import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { BuildTeamState } from './types';

const selectSlice = (state: any) => state.buildTeam || initialState;

export const selectLoading = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.loading,
);

export const selectError = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.error,
);

export const selectEmployees = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.employees,
);

export const selectPagination = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.pagination,
);

export const selectFilters = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.filters,
);

export const selectSelectedManager = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.selectedManager,
);

export const selectSelectedSubordinateIds = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.selectedSubordinateIds,
);

export const selectAssignSuccess = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.assignSuccess,
);

export const selectExistingTeam = createSelector(
  [selectSlice],
  (state: BuildTeamState) => state.existingTeam,
);
