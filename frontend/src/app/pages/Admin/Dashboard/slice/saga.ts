import { call, put, takeLatest } from "redux-saga/effects";
import { dashboardActions } from "./index";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";

function* fetchDashboardStats() {
  try {
    const response: {
      data: {
        status: string;
        data: any;
      };
    } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.analytics.advancedStats,
      isSecureRoute: true,
    });

    if (response?.data?.status === "success") {
      yield put(dashboardActions.fetchStatsSuccess(response.data.data));
    } else {
      yield put(
        dashboardActions.fetchStatsFailure(
          "Failed to fetch dashboard stats: Invalid response",
        ),
      );
    }
  } catch (error: any) {
    yield put(
      dashboardActions.fetchStatsFailure(
        error.message || "Failed to fetch dashboard stats",
      ),
    );
  }
}

export function* dashboardSaga() {
  yield takeLatest(
    dashboardActions.fetchStatsRequest.type,
    fetchDashboardStats,
  );
}
