import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { AssignManagerState } from './types';

// The root state type would ideally be imported, but for local slice we assume the key exists
const selectSlice = (state: any) => state.assignManager || initialState;

export const selectLoading = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.loading,
);

export const selectError = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.error,
);

export const selectManagerSearchQuery = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.managerSearchQuery,
);

export const selectManagerSuggestions = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.managerSuggestions,
);

export const selectExistingManagers = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.existingManagers,
);

export const selectSelectedManager = createSelector(
  [selectSlice],
  (state: AssignManagerState) => state.selectedManager,
);
