import { call, put, takeLatest } from "redux-saga/effects";
import { usersActions } from ".";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";

/**
 * Saga: Fetch users with pagination
 * Calls GET /users?page={page}&limit={limit}
 */
export function* fetchUsersSaga(
  action: ReturnType<typeof usersActions.fetchUsersRequest>,
) {
  try {
    const page = action?.payload?.page ?? 1;
    const limit = action?.payload?.limit ?? 10;

    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.users,
      query: { page, limit },
      isSecureRoute: true,
    });

    const users = response?.data?.data?.users ?? [];
    const pagination = response?.data?.data?.pagination;

    const total =
      typeof pagination?.total === "number" ? pagination.total : users.length;

    yield put(
      usersActions.fetchUsersSuccess({
        users,
        total,
        page,
        limit,
      }),
    );
  } catch (error: any) {
    const message =
      error?.message || error?.data?.message || "Failed to fetch users";
    yield put(usersActions.fetchUsersFailure(message));
  }
}

export function* usersSaga() {
  yield takeLatest(usersActions.fetchUsersRequest.type, fetchUsersSaga);
}
