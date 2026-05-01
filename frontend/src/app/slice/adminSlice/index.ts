import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { adminSaga } from './saga';
import { AdminState, Role, Department, JobTitle, RolesResponse, DepartmentsResponse, JobTitlesResponse, DepartmentResponse, JobTitleResponse, CountResponse } from './types';

export const initialState: AdminState = {
  roles: [],
  departments: [],
  jobTitles: [],
  departmentCount: null,
  loading: false,
  error: null,
  isSuccess: false,
  isError: false,
  message: '',
};

const slice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    // Get Roles
    getRolesRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getRolesSuccess(state, action: PayloadAction<RolesResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.roles = action.payload.roles;
      state.message = 'Roles fetched successfully';
    },
    getRolesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Departments
    getDepartmentsRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getDepartmentsSuccess(state, action: PayloadAction<DepartmentsResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.departments = action.payload.departments;
      state.message = 'Departments fetched successfully';
    },
    getDepartmentsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Create Department
    createDepartmentRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    createDepartmentSuccess(state, action: PayloadAction<DepartmentResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.departments = [action.payload.department, ...state.departments];
      state.message = 'Department created successfully';
    },
    createDepartmentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Department Count
    getDepartmentCountRequest(state) {
      state.loading = true;
    },
    getDepartmentCountSuccess(state, action: PayloadAction<CountResponse>) {
      state.loading = false;
      state.departmentCount = action.payload.count;
    },
    getDepartmentCountFailure(state) {
      state.loading = false;
    },

    // Get Job Titles
    getJobTitlesRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getJobTitlesSuccess(state, action: PayloadAction<JobTitlesResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.jobTitles = action.payload.jobTitles;
      state.message = 'Job titles fetched successfully';
    },
    getJobTitlesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Create Job Title
    createJobTitleRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    createJobTitleSuccess(state, action: PayloadAction<JobTitleResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.jobTitles = [action.payload.jobTitle, ...state.jobTitles];
      state.message = 'Job title created successfully';
    },
    createJobTitleFailure(state, action: PayloadAction<string>) {
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
  },
});

export const { actions: adminActions } = slice;

export const useAdminSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: adminSaga });
  return { actions: slice.actions };
};

export default slice.reducer;

