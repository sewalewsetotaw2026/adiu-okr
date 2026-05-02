import { createSelector } from '@reduxjs/toolkit';
import { initialState } from '.';
import { RootState } from '../../../../../store/types/RootState';

const selectSlice = (state: RootState) => state.managerList || initialState;

export const selectManagers = createSelector([selectSlice], state => state.managers);
export const selectLoading = createSelector([selectSlice], state => state.loading);
export const selectFilter = createSelector([selectSlice], state => state.filters);
export const selectPagination = createSelector([selectSlice], state => state.pagination);
export const selectSelectedManager = createSelector([selectSlice], state => state.selectedManager);
export const selectDirectReports = createSelector([selectSlice], state => state.directReports);
export const selectDirectReportsCache = createSelector([selectSlice], state => state.directReportsCache);
export const selectLastFetched = createSelector([selectSlice], state => state.lastFetched);
export const selectPages = createSelector([selectSlice], state => state.pages);
