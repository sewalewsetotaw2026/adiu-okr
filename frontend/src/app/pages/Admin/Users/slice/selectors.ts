import { createSelector } from "@reduxjs/toolkit";
import { initialState } from "./index";
import type { RootState } from "../../../../../store/types/RootState";

/**
 * Domain selector
 */
const selectUsersDomain = (state: RootState) =>
  // When reducer is not yet injected, fall back to initialState
  // This matches the pattern used across the app for lazy-injected reducers
  (state as any).users || initialState;

/**
 * Basic selectors
 */
export const selectUsersLoading = createSelector(
  [selectUsersDomain],
  (state) => state.loading,
);

export const selectUsersError = createSelector(
  [selectUsersDomain],
  (state) => state.error,
);

export const selectUsers = createSelector(
  [selectUsersDomain],
  (state) => state.users,
);

export const selectUsersPagination = createSelector(
  [selectUsersDomain],
  (state) => state.pagination,
);

/**
 * Derived pagination selectors
 */
export const selectUsersTotal = createSelector(
  [selectUsersPagination],
  (p) => p.total,
);

export const selectUsersPage = createSelector(
  [selectUsersPagination],
  (p) => p.page,
);

export const selectUsersTotalPages = createSelector(
  [selectUsersPagination],
  (p) => p.totalPages,
);

export const selectUsersLimit = createSelector(
  [selectUsersPagination],
  (p) => p.limit,
);
