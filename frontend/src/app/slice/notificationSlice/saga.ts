import { call, put, takeLatest } from "redux-saga/effects";
import { notificationActions } from "./index";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";
import { GetNotificationsResponse, NotificationState } from "./types";

function* getNotificationsSaga(
  action: ReturnType<typeof notificationActions.getNotifications>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.notifications}?${queryParams.toString()}`
      : apiRoutes.notifications;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const notifications =
      (Array.isArray(raw?.notifications) && raw.notifications) ||
      (Array.isArray(raw?.data?.notifications) && raw.data.notifications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      [];
    
    const pagination = raw?.pagination ?? raw?.data?.pagination ?? {
      page: 1, limit: 20, total: 0, totalPages: 1
    };

    yield put(
      notificationActions.getNotificationsSuccess({
        notifications,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch notifications.";
    yield put(notificationActions.getNotificationsFailure(errorMessage));
  }
}

function* getUnreadCountSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.unreadNotificationsCount,
      isSecureRoute: true,
    });
    
    const count = response?.data?.data?.count ?? response?.data?.count ?? 0;
    yield put(notificationActions.getUnreadCountSuccess(count));
  } catch (error) {
    // Silent fail for background check
    console.error("Failed to fetch unread count", error);
  }
}

function* markAsReadSaga(
  action: ReturnType<typeof notificationActions.markAsRead>
) {
  try {
    yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.markNotificationRead(action.payload),
      isSecureRoute: true,
    });
    yield put(notificationActions.markAsReadSuccess());
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to mark notification as read.";
    yield put(notificationActions.markAsReadFailure(errorMessage));
    // Could reload notifications here to ensure state consistency
  }
}

function* markAllAsReadSaga() {
  try {
    yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.markAllNotificationsRead,
      isSecureRoute: true,
    });
    yield put(notificationActions.markAllAsReadSuccess());
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to mark all as read.";
    yield put(notificationActions.markAllAsReadFailure(errorMessage));
  }
}

function* deleteNotificationSaga(
  action: ReturnType<typeof notificationActions.deleteNotification>
) {
  try {
    yield call(makeCall, {
      method: "DELETE",
      route: apiRoutes.deleteNotification(action.payload),
      isSecureRoute: true,
    });
    yield put(notificationActions.deleteNotificationSuccess());
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to delete notification.";
    yield put(notificationActions.deleteNotificationFailure(errorMessage));
  }
}

export default function* notificationSaga() {
  yield takeLatest(notificationActions.getNotifications.type, getNotificationsSaga);
  yield takeLatest(notificationActions.getUnreadCount.type, getUnreadCountSaga);
  yield takeLatest(notificationActions.markAsRead.type, markAsReadSaga);
  yield takeLatest(notificationActions.markAllAsRead.type, markAllAsReadSaga);
  yield takeLatest(notificationActions.deleteNotification.type, deleteNotificationSaga);
}
