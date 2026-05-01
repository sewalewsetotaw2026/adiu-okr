import { call, put, takeLatest } from 'redux-saga/effects';
import { employmentActions } from './index';
import makeCall from '../../API';
import apiRoutes from '../../API/apiRoutes';
import { EmploymentsResponse, EmploymentResponse, CountResponse, DistributionResponse, GetEmploymentsParams } from './types';

function* getEmploymentsSaga(action: ReturnType<typeof employmentActions.getEmploymentsRequest>) {
  try {
    const params: GetEmploymentsParams = action.payload || {};
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString() 
      ? `${apiRoutes.employments}?${queryParams.toString()}`
      : apiRoutes.employments;

    const response: { data: EmploymentsResponse } = yield call(makeCall, {
      method: 'GET',
      route,
      isSecureRoute: true,
    });

    yield put(employmentActions.getEmploymentsSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch employments.';
    yield put(employmentActions.getEmploymentsFailure(errorMessage));
  }
}

function* getEmploymentByIdSaga(action: ReturnType<typeof employmentActions.getEmploymentByIdRequest>) {
  try {
    const id = action.payload;
    const response: { data: EmploymentResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employmentById(id),
      isSecureRoute: true,
    });

    yield put(employmentActions.getEmploymentByIdSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch employment.';
    yield put(employmentActions.getEmploymentByIdFailure(errorMessage));
  }
}

function* getLatestEmploymentSaga(action: ReturnType<typeof employmentActions.getLatestEmploymentRequest>) {
  try {
    const employeeId = action.payload;
    const response: { data: EmploymentResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employmentByEmployee(employeeId),
      isSecureRoute: true,
    });

    yield put(employmentActions.getLatestEmploymentSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch latest employment.';
    yield put(employmentActions.getLatestEmploymentFailure(errorMessage));
  }
}

function* createEmploymentSaga(action: ReturnType<typeof employmentActions.createEmploymentRequest>) {
  try {
    const employmentData = action.payload;
    const response: { data: EmploymentResponse } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.employments,
      body: employmentData,
      isSecureRoute: true,
    });

    yield put(employmentActions.createEmploymentSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to create employment.';
    yield put(employmentActions.createEmploymentFailure(errorMessage));
  }
}

function* updateEmploymentSaga(action: ReturnType<typeof employmentActions.updateEmploymentRequest>) {
  try {
    const { id, data } = action.payload;
    const response: { data: EmploymentResponse } = yield call(makeCall, {
      method: 'PUT',
      route: apiRoutes.employmentById(id),
      body: data,
      isSecureRoute: true,
    });

    yield put(employmentActions.updateEmploymentSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to update employment.';
    yield put(employmentActions.updateEmploymentFailure(errorMessage));
  }
}

function* deleteEmploymentSaga(action: ReturnType<typeof employmentActions.deleteEmploymentRequest>) {
  try {
    const id = action.payload;
    yield call(makeCall, {
      method: 'DELETE',
      route: apiRoutes.employmentById(id),
      isSecureRoute: true,
    });

    yield put(employmentActions.deleteEmploymentSuccess(id));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to delete employment.';
    yield put(employmentActions.deleteEmploymentFailure(errorMessage));
  }
}

// Statistics Sagas
function* getEmploymentCountSaga() {
  try {
    const response: { data: CountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employmentsCount,
      isSecureRoute: true,
    });
    yield put(employmentActions.getEmploymentCountSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getEmploymentCountFailure());
  }
}

function* getActiveEmploymentCountSaga() {
  try {
    const response: { data: CountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.activeEmploymentsCount,
      isSecureRoute: true,
    });
    yield put(employmentActions.getActiveEmploymentCountSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getActiveEmploymentCountFailure());
  }
}

function* getInactiveEmploymentCountSaga() {
  try {
    const response: { data: CountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.inactiveEmploymentsCount,
      isSecureRoute: true,
    });
    yield put(employmentActions.getInactiveEmploymentCountSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getInactiveEmploymentCountFailure());
  }
}

function* getManagersCountSaga() {
  try {
    const response: { data: CountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.managersCount,
      isSecureRoute: true,
    });
    yield put(employmentActions.getManagersCountSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getManagersCountFailure());
  }
}

function* getGenderDistributionSaga() {
  try {
    const response: { data: DistributionResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.genderDistribution,
      isSecureRoute: true,
    });
    yield put(employmentActions.getGenderDistributionSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getGenderDistributionFailure());
  }
}

function* getManagerDistributionSaga() {
  try {
    const response: { data: DistributionResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.managerDistribution,
      isSecureRoute: true,
    });
    yield put(employmentActions.getManagerDistributionSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getManagerDistributionFailure());
  }
}

function* getJobDistributionSaga() {
  try {
    const response: { data: DistributionResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.jobDistribution,
      isSecureRoute: true,
    });
    yield put(employmentActions.getJobDistributionSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getJobDistributionFailure());
  }
}

function* getDepartmentDistributionSaga() {
  try {
    const response: { data: DistributionResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.departmentDistribution,
      isSecureRoute: true,
    });
    yield put(employmentActions.getDepartmentDistributionSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getDepartmentDistributionFailure());
  }
}

function* getEmploymentTypeDistributionSaga() {
  try {
    const response: { data: DistributionResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employmentTypeDistribution,
      isSecureRoute: true,
    });
    yield put(employmentActions.getEmploymentTypeDistributionSuccess(response.data));
  } catch (error: any) {
    yield put(employmentActions.getEmploymentTypeDistributionFailure());
  }
}

export function* employmentSaga() {
  yield takeLatest(employmentActions.getEmploymentsRequest.type, getEmploymentsSaga);
  yield takeLatest(employmentActions.getEmploymentByIdRequest.type, getEmploymentByIdSaga);
  yield takeLatest(employmentActions.getLatestEmploymentRequest.type, getLatestEmploymentSaga);
  yield takeLatest(employmentActions.createEmploymentRequest.type, createEmploymentSaga);
  yield takeLatest(employmentActions.updateEmploymentRequest.type, updateEmploymentSaga);
  yield takeLatest(employmentActions.deleteEmploymentRequest.type, deleteEmploymentSaga);
  yield takeLatest(employmentActions.getEmploymentCountRequest.type, getEmploymentCountSaga);
  yield takeLatest(employmentActions.getActiveEmploymentCountRequest.type, getActiveEmploymentCountSaga);
  yield takeLatest(employmentActions.getInactiveEmploymentCountRequest.type, getInactiveEmploymentCountSaga);
  yield takeLatest(employmentActions.getManagersCountRequest.type, getManagersCountSaga);
  yield takeLatest(employmentActions.getGenderDistributionRequest.type, getGenderDistributionSaga);
  yield takeLatest(employmentActions.getManagerDistributionRequest.type, getManagerDistributionSaga);
  yield takeLatest(employmentActions.getJobDistributionRequest.type, getJobDistributionSaga);
  yield takeLatest(employmentActions.getDepartmentDistributionRequest.type, getDepartmentDistributionSaga);
  yield takeLatest(employmentActions.getEmploymentTypeDistributionRequest.type, getEmploymentTypeDistributionSaga);
}

