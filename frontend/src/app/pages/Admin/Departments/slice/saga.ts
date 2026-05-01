import { call, put, takeLatest } from 'redux-saga/effects';
import { departmentsActions } from '.';
import { Department } from './types';
import makeCall from '../../../../API';
import apiRoutes from '../../../../API/apiRoutes';

export function* fetchDepartments(action: ReturnType<typeof departmentsActions.fetchDepartmentsStart>) {
  try {
    const params = action.payload || { page: 1, limit: 1000 };
    const response: { data: { data: { department: Department[]; pagination: any } } } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.departments,
      query: params,
      isSecureRoute: true,
    });

    const { department, pagination } = response?.data?.data || { department: [], pagination: null };
    yield put(departmentsActions.fetchDepartmentsSuccess({ department, pagination }));
  } catch (error: any) {
    yield put(departmentsActions.fetchDepartmentsFailure(error.message || 'Failed to fetch departments'));
  }
}

export function* createDepartment(action: ReturnType<typeof departmentsActions.createDepartmentRequest>) {
  try {
    const response: { data: { data: { department: Department } } } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.departments,
      body: action.payload,
      isSecureRoute: true,
    });

    if (response?.data?.data?.department) {
      yield put(departmentsActions.createDepartmentSuccess(response.data.data.department));
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error: any) {
    yield put(departmentsActions.createDepartmentFailure(error.message || 'Failed to create department'));
  }
}

export function* deleteDepartment(action: ReturnType<typeof departmentsActions.deleteDepartmentRequest>) {
  try {
    yield call(makeCall, {
      method: 'DELETE',
      route: `${apiRoutes.departments}/${action.payload}`,
      isSecureRoute: true,
    });
    yield put(departmentsActions.deleteDepartmentSuccess(action.payload));
  } catch (error: any) {
    yield put(departmentsActions.deleteDepartmentFailure(error.message || 'Failed to delete department'));
  }
}

export function* assignHead(action: ReturnType<typeof departmentsActions.assignHeadRequest>) {
  try {
    const { departmentId, headUserId } = action.payload;
    const response: { data: { data: { department: Department } } } = yield call(makeCall, {
      method: 'PATCH',
      route: apiRoutes.assignDepartmentHead(departmentId),
      body: { head_user_id: headUserId },
      isSecureRoute: true,
    });

    if (response?.data?.data?.department) {
      yield put(departmentsActions.assignHeadSuccess({
        departmentId,
        head: response.data.data.department.head,
      }));
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error: any) {
    yield put(departmentsActions.assignHeadFailure(error.message || 'Failed to assign department head'));
  }
}


export function* departmentsSaga() {
  yield takeLatest(departmentsActions.fetchDepartmentsStart.type, fetchDepartments);
  yield takeLatest(departmentsActions.createDepartmentRequest.type, createDepartment);
  yield takeLatest(departmentsActions.deleteDepartmentRequest.type, deleteDepartment);
  yield takeLatest(departmentsActions.assignHeadRequest.type, assignHead);
}

