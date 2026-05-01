import { call, put, takeLatest } from 'redux-saga/effects';
import { pendingUsersActions } from '.';
import makeCall from '../../../../API';
import apiRoutes from '../../../../API/apiRoutes';

export function* fetchPendingUsers() {
  try {
    const response: any = yield call(makeCall, { 
      method: 'GET', 
      route: apiRoutes.pendingUsers, 
      isSecureRoute: true 
    });

    const users = response?.data?.data?.users || [];
    yield put(pendingUsersActions.fetchPendingUsersSuccess(users));
  } catch (error: any) {
    yield put(pendingUsersActions.fetchPendingUsersFailure(error.message || 'Failed to fetch pending users'));
  }
}

export function* pendingUsersSaga() {
  yield takeLatest(pendingUsersActions.fetchPendingUsersRequest.type, fetchPendingUsers);
}
