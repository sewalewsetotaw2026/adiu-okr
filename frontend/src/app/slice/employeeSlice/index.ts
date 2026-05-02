import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { employeeSaga } from './saga';
import { EmployeeState, Employee, EmployeesResponse, EmployeeResponse, EmployeeCountResponse } from './types';

export const initialState: EmployeeState = {
  employees: [],
  currentEmployee: null,
  employeeCount: null,
  loading: false,
  error: null,
  isSuccess: false,
  isError: false,
  message: '',
  pagination: null,
};

const slice = createSlice({
  name: 'employee',
  initialState,
  reducers: {
    // Get Employees
    getEmployeesRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getEmployeesSuccess(state, action: PayloadAction<EmployeesResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employees = action.payload.employees;
      state.pagination = action.payload.pagination;
      state.message = 'Employees fetched successfully';
    },
    getEmployeesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Employee by ID
    getEmployeeByIdRequest(state, action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getEmployeeByIdSuccess(state, action: PayloadAction<EmployeeResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.currentEmployee = action.payload.employee;
      state.message = 'Employee fetched successfully';
    },
    getEmployeeByIdFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Create Employee
    createEmployeeRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    createEmployeeSuccess(state, action: PayloadAction<EmployeeResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employees = [action.payload.employee, ...state.employees];
      state.message = 'Employee created successfully';
    },
    createEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Update Employee
    updateEmployeeRequest(state, action: PayloadAction<{ id: string; data: any }>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    updateEmployeeSuccess(state, action: PayloadAction<EmployeeResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employees = state.employees.map((employee) =>
        employee.id === action.payload.employee.id ? action.payload.employee : employee
      );
      if (state.currentEmployee?.id === action.payload.employee.id) {
        state.currentEmployee = action.payload.employee;
      }
      state.message = 'Employee updated successfully';
    },
    updateEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Delete Employee
    deleteEmployeeRequest(state, action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    deleteEmployeeSuccess(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employees = state.employees.filter((employee) => employee.id !== action.payload);
      if (state.currentEmployee?.id === action.payload) {
        state.currentEmployee = null;
      }
      state.message = 'Employee deleted successfully';
    },
    deleteEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Employee Count
    getEmployeeCountRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getEmployeeCountSuccess(state, action: PayloadAction<EmployeeCountResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employeeCount = action.payload.count;
    },
    getEmployeeCountFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Reset
    reset(state) {
      state.loading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
      state.error = null;
    },

    // Clear Current Employee
    clearCurrentEmployee(state) {
      state.currentEmployee = null;
    },
  },
});

export const { actions: employeeActions } = slice;

export const useEmployeeSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: employeeSaga });
  return { actions: slice.actions };
};

export default slice.reducer;

