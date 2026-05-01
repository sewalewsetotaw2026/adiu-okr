import { createSelector } from "@reduxjs/toolkit";
import { NotificationState } from "./types";

interface StateWithNotifications {
  notifications?: NotificationState;
}

const initialState: NotificationState = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    pagination: {
        page: 1,
        limit: 20,
        totalPages: 1,
        total: 0,
    },
};

const selectNotificationState = (state: StateWithNotifications) => state.notifications || initialState;

export const selectNotifications = createSelector(
  [selectNotificationState],
  (state: NotificationState) => state.notifications
);

export const selectUnreadCount = createSelector(
  [selectNotificationState],
  (state: NotificationState) => state.unreadCount
);

export const selectNotificationLoading = createSelector(
  [selectNotificationState],
  (state: NotificationState) => state.loading
);

export const selectNotificationError = createSelector(
  [selectNotificationState],
  (state: NotificationState) => state.error
);

export const selectNotificationPagination = createSelector(
  [selectNotificationState],
  (state: NotificationState) => state.pagination
);
