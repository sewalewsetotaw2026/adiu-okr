import { call, put, takeLatest } from 'redux-saga/effects';
import { userActions } from './index';
import makeCall from '../../API';
import apiRoutes from '../../API/apiRoutes';
import { UsersResponse, UserResponse, UserCountResponse, GetUsersParams } from './types';

function* getUsersSaga(action: ReturnType<typeof userActions.getUsersRequest>) {
  try {
    const params: GetUsersParams = action.payload || {};
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString() 
      ? `${apiRoutes.users}?${queryParams.toString()}`
      : apiRoutes.users;

    const response: { data: UsersResponse } = yield call(makeCall, {
      method: 'GET',
      route,
      isSecureRoute: true,
    });

    yield put(userActions.getUsersSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch users.';
    yield put(userActions.getUsersFailure(errorMessage));
  }
}

function* getUserByIdSaga(action: ReturnType<typeof userActions.getUserByIdRequest>) {
  try {
    const id = action.payload;
    const response: { data: UserResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.userById(id),
      isSecureRoute: true,
    });

    yield put(userActions.getUserByIdSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch user.';
    yield put(userActions.getUserByIdFailure(errorMessage));
  }
}

function* createUserSaga(action: ReturnType<typeof userActions.createUserRequest>) {
  try {
    const userData = action.payload;
    const response: { data: UserResponse } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.users,
      body: userData,
      isSecureRoute: true,
    });

    yield put(userActions.createUserSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to create user.';
    yield put(userActions.createUserFailure(errorMessage));
  }
}

function* updateUserSaga(action: ReturnType<typeof userActions.updateUserRequest>) {
  try {
    const { id, data } = action.payload;
    const response: { data: UserResponse } = yield call(makeCall, {
      method: 'PUT',
      route: apiRoutes.userById(id),
      body: data,
      isSecureRoute: true,
    });

    yield put(userActions.updateUserSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to update user.';
    yield put(userActions.updateUserFailure(errorMessage));
  }
}

function* changePasswordSaga(action: ReturnType<typeof userActions.changePasswordRequest>) {
  try {
    const { id, newPassword } = action.payload;
    yield call(makeCall, {
      method: 'PUT',
      route: apiRoutes.userPassword(id),
      body: { new_password: newPassword },
      isSecureRoute: true,
    });

    yield put(userActions.changePasswordSuccess());
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to change password.';
    yield put(userActions.changePasswordFailure(errorMessage));
  }
}

function* deleteUserSaga(action: ReturnType<typeof userActions.deleteUserRequest>) {
  try {
    const id = action.payload;
    yield call(makeCall, {
      method: 'DELETE',
      route: apiRoutes.userById(id),
      isSecureRoute: true,
    });

    yield put(userActions.deleteUserSuccess(id));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to deactivate user.';
    yield put(userActions.deleteUserFailure(errorMessage));
  }
}

function* getUserCountSaga() {
  try {
    const response: { data: UserCountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.usersCount,
      isSecureRoute: true,
    });

    yield put(userActions.getUserCountSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch user count.';
    yield put(userActions.getUserCountFailure(errorMessage));
  }
}

export function* userSaga() {
  yield takeLatest(userActions.getUsersRequest.type, getUsersSaga);
  yield takeLatest(userActions.getUserByIdRequest.type, getUserByIdSaga);
  yield takeLatest(userActions.createUserRequest.type, createUserSaga);
  yield takeLatest(userActions.updateUserRequest.type, updateUserSaga);
  yield takeLatest(userActions.changePasswordRequest.type, changePasswordSaga);
  yield takeLatest(userActions.deleteUserRequest.type, deleteUserSaga);
  yield takeLatest(userActions.getUserCountRequest.type, getUserCountSaga);
}

