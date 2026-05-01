import { call, put, takeLatest } from 'redux-saga/effects';
import { employeeActions } from './index';
import makeCall from '../../API';
import apiRoutes from '../../API/apiRoutes';
import { EmployeesResponse, EmployeeResponse, EmployeeCountResponse, GetEmployeesParams } from './types';

function* getEmployeesSaga(action: ReturnType<typeof employeeActions.getEmployeesRequest>) {
  try {
    const params: GetEmployeesParams = action.payload || {};
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString() 
      ? `${apiRoutes.employees}?${queryParams.toString()}`
      : apiRoutes.employees;

    const response: { data: EmployeesResponse } = yield call(makeCall, {
      method: 'GET',
      route,
      isSecureRoute: true,
    });

    yield put(employeeActions.getEmployeesSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch employees.';
    yield put(employeeActions.getEmployeesFailure(errorMessage));
  }
}

function* getEmployeeByIdSaga(action: ReturnType<typeof employeeActions.getEmployeeByIdRequest>) {
  try {
    const id = action.payload;
    const response: { data: EmployeeResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employeeById(id),
      isSecureRoute: true,
    });

    yield put(employeeActions.getEmployeeByIdSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch employee.';
    yield put(employeeActions.getEmployeeByIdFailure(errorMessage));
  }
}

function* createEmployeeSaga(action: ReturnType<typeof employeeActions.createEmployeeRequest>) {
  try {
    const employeeData = action.payload;
    const response: { data: EmployeeResponse } = yield call(makeCall, {
      method: 'POST',
      route: apiRoutes.employees,
      body: employeeData,
      isSecureRoute: true,
    });

    yield put(employeeActions.createEmployeeSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to create employee.';
    yield put(employeeActions.createEmployeeFailure(errorMessage));
  }
}

function* updateEmployeeSaga(action: ReturnType<typeof employeeActions.updateEmployeeRequest>) {
  try {
    const { id, data } = action.payload;
    const response: { data: EmployeeResponse } = yield call(makeCall, {
      method: 'PUT',
      route: apiRoutes.employeeById(id),
      body: data,
      isSecureRoute: true,
    });

    yield put(employeeActions.updateEmployeeSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to update employee.';
    yield put(employeeActions.updateEmployeeFailure(errorMessage));
  }
}

function* deleteEmployeeSaga(action: ReturnType<typeof employeeActions.deleteEmployeeRequest>) {
  try {
    const id = action.payload;
    yield call(makeCall, {
      method: 'DELETE',
      route: apiRoutes.employeeById(id),
      isSecureRoute: true,
    });

    yield put(employeeActions.deleteEmployeeSuccess(id));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to delete employee.';
    yield put(employeeActions.deleteEmployeeFailure(errorMessage));
  }
}

function* getEmployeeCountSaga() {
  try {
    const response: { data: EmployeeCountResponse } = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.employeesCount,
      isSecureRoute: true,
    });

    yield put(employeeActions.getEmployeeCountSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      'Failed to fetch employee count.';
    yield put(employeeActions.getEmployeeCountFailure(errorMessage));
  }
}

export function* employeeSaga() {
  yield takeLatest(employeeActions.getEmployeesRequest.type, getEmployeesSaga);
  yield takeLatest(employeeActions.getEmployeeByIdRequest.type, getEmployeeByIdSaga);
  yield takeLatest(employeeActions.createEmployeeRequest.type, createEmployeeSaga);
  yield takeLatest(employeeActions.updateEmployeeRequest.type, updateEmployeeSaga);
  yield takeLatest(employeeActions.deleteEmployeeRequest.type, deleteEmployeeSaga);
  yield takeLatest(employeeActions.getEmployeeCountRequest.type, getEmployeeCountSaga);
}

