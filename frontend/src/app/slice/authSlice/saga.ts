import { call, put, takeLatest } from "redux-saga/effects";
import { authActions } from "./index";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";
import {
  LoginResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  UpdatePasswordResponse,
  MeResponse,
  User,
} from "./types";

function* loginSaga(action: ReturnType<typeof authActions.loginRequest>) {
  try {
    const { email, password } = action.payload;

    const response: { data: LoginResponse } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.login,
      body: { email, password },
      isSecureRoute: false,
    });

    yield put(authActions.loginSuccess(response.data));
  } catch (error: any) {
    // makeCall throws error.response.data, so check error.message directly
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Login failed. Please check your credentials.";
    yield put(authActions.loginFailure(errorMessage));
  }
}

function* forgotPasswordSaga(
  action: ReturnType<typeof authActions.forgotPasswordRequest>
) {
  try {
    const { email } = action.payload;

    const response: { data: ForgotPasswordResponse } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.forgotPassword,
      body: { email },
      isSecureRoute: false,
    });

    yield put(authActions.forgotPasswordSuccess(response.data));
  } catch (error: any) {
    // makeCall throws error.response.data, so check error.message directly
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to send password reset email.";
    yield put(authActions.forgotPasswordFailure(errorMessage));
  }
}

function* resetPasswordSaga(
  action: ReturnType<typeof authActions.resetPasswordRequest>
) {
  try {
    const { token, password } = action.payload;

    const response: { data: ResetPasswordResponse } = yield call(makeCall, {
      method: "PATCH",
      route: apiRoutes.resetPassword.replace(":token", token),
      body: { password },
      isSecureRoute: false,
    });

    yield put(authActions.resetPasswordSuccess(response.data));
  } catch (error: any) {
    // makeCall throws error.response.data, so check error.message directly
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to reset password. Token may be invalid or expired.";
    yield put(authActions.resetPasswordFailure(errorMessage));
  }
}

function* updatePasswordSaga(
  action: ReturnType<typeof authActions.updatePasswordRequest>
) {
  try {
    const { currentPassword, newPassword } = action.payload;

    const response: { data: UpdatePasswordResponse } = yield call(makeCall, {
      method: "PATCH",
      route: apiRoutes.updateMyPassword,
      body: { currentPassword, newPassword },
      isSecureRoute: true,
    });

    yield put(authActions.updatePasswordSuccess(response.data));
  } catch (error: any) {
    // makeCall throws error.response.data, so check error.message directly
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to update password. Please check your current password.";
    yield put(authActions.updatePasswordFailure(errorMessage));
  }
}

function* getMeSaga() {
  try {
    const response: { data: MeResponse } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.me,
      isSecureRoute: true,
    });

    const payload: any = response?.data;
    const user: User | null =
      payload?.data?.user || payload?.data || payload?.user || null;

    if (!user) {
      yield put(authActions.getMeFailure("Failed to load user profile."));
      return;
    }

    yield put(authActions.getMeSuccess(user));
  } catch (error: any) {
    const status = error?.statusCode || error?.status || error?.code;
    const message =
      error?.message ||
      error?.error ||
      error?.response?.data?.message ||
      "Failed to refresh user.";

    // If token is invalid/expired, clear auth
    if (status === 401) {
      yield put(authActions.logout());
      return;
    }

    yield put(authActions.getMeFailure(message));
  }
}

export function* authSaga() {
  yield takeLatest(authActions.loginRequest.type, loginSaga);
  yield takeLatest(authActions.forgotPasswordRequest.type, forgotPasswordSaga);
  yield takeLatest(authActions.resetPasswordRequest.type, resetPasswordSaga);
  yield takeLatest(authActions.updatePasswordRequest.type, updatePasswordSaga);
  yield takeLatest(authActions.getMeRequest.type, getMeSaga);
}
