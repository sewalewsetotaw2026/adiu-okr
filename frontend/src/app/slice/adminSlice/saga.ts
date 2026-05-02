import { call, put, takeLatest } from 'redux-saga/effects';
import { adminActions } from './index';
import makeCall from '../../API';
import apiRoutes from '../../API/apiRoutes';
import { RolesResponse, DepartmentsResponse, JobTitlesResponse, DepartmentResponse, JobTitleResponse, CountResponse } from './types';

function* getRolesSaga() {
  try {
    const response: { data: RolesResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.roles,
      isSecureRoute: true,
    });

    yield put(adminActions.getRolesSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch roles.';
    yield put(adminActions.getRolesFailure(errorMessage));
  }
}

function* getDepartmentsSaga() {
  try {
    const response: { data: DepartmentsResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.departments,
      isSecureRoute: true,
    });

    yield put(adminActions.getDepartmentsSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch departments.';
    yield put(adminActions.getDepartmentsFailure(errorMessage));
  }
}

function* createDepartmentSaga(action: ReturnType<typeof adminActions.createDepartmentRequest>) {
  try {
    const departmentData = action.payload;
    const response: { data: DepartmentResponse } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.departments,
      body: departmentData,
      isSecureRoute: true,
    });

    yield put(adminActions.createDepartmentSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to create department.';
    yield put(adminActions.createDepartmentFailure(errorMessage));
  }
}

function* getDepartmentCountSaga() {
  try {
    const response: { data: CountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.departmentsCount,
      isSecureRoute: true,
    });
    yield put(adminActions.getDepartmentCountSuccess(response.data));
  } catch (error: any) {
    yield put(adminActions.getDepartmentCountFailure());
  }
}

function* getJobTitlesSaga() {
  try {
    const response: { data: JobTitlesResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.jobTitles,
      isSecureRoute: true,
    });

    yield put(adminActions.getJobTitlesSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch job titles.';
    yield put(adminActions.getJobTitlesFailure(errorMessage));
  }
}

function* createJobTitleSaga(action: ReturnType<typeof adminActions.createJobTitleRequest>) {
  try {
    const jobTitleData = action.payload;
    const response: { data: JobTitleResponse } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.jobTitles,
      body: jobTitleData,
      isSecureRoute: true,
    });

    yield put(adminActions.createJobTitleSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to create job title.';
    yield put(adminActions.createJobTitleFailure(errorMessage));
  }
}

export function* adminSaga() {
  yield takeLatest(adminActions.getRolesRequest.type, getRolesSaga);
  yield takeLatest(adminActions.getDepartmentsRequest.type, getDepartmentsSaga);
  yield takeLatest(adminActions.createDepartmentRequest.type, createDepartmentSaga);
  yield takeLatest(adminActions.getDepartmentCountRequest.type, getDepartmentCountSaga);
  yield takeLatest(adminActions.getJobTitlesRequest.type, getJobTitlesSaga);
  yield takeLatest(adminActions.createJobTitleRequest.type, createJobTitleSaga);
}

