import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { NotificationState, GetNotificationsPayload, GetNotificationsResponse } from "./types";

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

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    getNotifications(state, action: PayloadAction<GetNotificationsPayload>) {
      state.loading = true;
      state.error = null;
    },
    getNotificationsSuccess(state, action: PayloadAction<GetNotificationsResponse>) {
      state.loading = false;
      state.notifications = action.payload.notifications;
      state.pagination = action.payload.pagination;
    },
    getNotificationsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    
    getUnreadCount(state) {
      // Background fetch, don't set global loading
    },
    getUnreadCountSuccess(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    
    markAsRead(state, action: PayloadAction<number>) {
      // Optimistic update
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.is_read) {
        notification.is_read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAsReadSuccess(state) {
      // Nothing to do
    },
    markAsReadFailure(state, action: PayloadAction<string>) {
      // Revert if needed, but for now just error
      state.error = action.payload;
    },
    
    markAllAsRead(state) {
      state.loading = true;
    },
    markAllAsReadSuccess(state) {
      state.loading = false;
      state.notifications.forEach(n => {
        n.is_read = true;
      });
      state.unreadCount = 0;
    },
    markAllAsReadFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    
    deleteNotification(state, action: PayloadAction<number>) {
      // Optimistic update
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    deleteNotificationSuccess(state) {
      // Nothing to do
    },
    deleteNotificationFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },

    // Real-time updates
    addNotification(state, action: PayloadAction<any>) {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
});

export const { actions: notificationActions, reducer: notificationReducer } = notificationSlice;

import { useInjectReducer, useInjectSaga } from "redux-injectors";
import notificationSaga from "./saga";

export const useNotificationSlice = () => {
  useInjectReducer({ key: notificationSlice.name, reducer: notificationSlice.reducer });
  useInjectSaga({ key: notificationSlice.name, saga: notificationSaga });
  return { actions: notificationSlice.actions };
};
