import { call, put, takeLatest } from 'redux-saga/effects';
import { submittedUsersActions } from '.';
import makeCall from '../../../../API';
import apiRoutes from '../../../../API/apiRoutes';
import ToastService from '../../../../../utils/ToastService';

export function* fetchSubmittedUsers(): Generator<any, void, any> {
  try {
    const response: any = yield call(makeCall, { 
      method: 'GET', 
      route: apiRoutes.submittedUsers, 
      isSecureRoute: true 
    });
    
    const users = response?.data?.data?.users || [];
    yield put(submittedUsersActions.fetchSubmittedUsersSuccess(users));
  } catch (error: any) {
    yield put(submittedUsersActions.fetchSubmittedUsersFailure(error.message || 'Failed to fetch submitted users'));
  }
}

export function* approveUser(action: ReturnType<typeof submittedUsersActions.approveUserRequest>) {
  try {
    const { userId, employeeId } = action.payload;
    
    // Call approve endpoint
    yield call(makeCall, { 
      method: 'POST', 
      route: apiRoutes.approveUser(employeeId), 
      isSecureRoute: true 
    });

    yield put(submittedUsersActions.approveUserSuccess(userId));
    ToastService.success('User approved successfully');
  } catch (error: any) {
    yield put(submittedUsersActions.approveUserFailure(error.message || 'Failed to approve user'));
    ToastService.error('Failed to approve user');
  }
}

export function* rejectUser(action: ReturnType<typeof submittedUsersActions.rejectUserRequest>) {
  try {
    const { userId, employeeId } = action.payload;
    
    // Call reject endpoint - adjust based on actual API
    yield call(makeCall, { 
      method: 'POST', 
      route: `${apiRoutes.users}/${employeeId}/reject`, 
      isSecureRoute: true 
    });

    yield put(submittedUsersActions.rejectUserSuccess(userId));
    ToastService.success('User rejected');
  } catch (error: any) {
    yield put(submittedUsersActions.rejectUserFailure(error.message || 'Failed to reject user'));
    ToastService.error('Failed to reject user');
  }
}

export function* submittedUsersSaga() {
  yield takeLatest(submittedUsersActions.fetchSubmittedUsersRequest.type, fetchSubmittedUsers);
  yield takeLatest(submittedUsersActions.approveUserRequest.type, approveUser);
  yield takeLatest(submittedUsersActions.rejectUserRequest.type, rejectUser);
}
