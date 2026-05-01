import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { employmentSaga } from './saga';
import { EmploymentState, Employment, EmploymentsResponse, EmploymentResponse, CountResponse, DistributionResponse } from './types';

export const initialState: EmploymentState = {
  employments: [],
  currentEmployment: null,
  employmentCount: null,
  activeEmploymentCount: null,
  inactiveEmploymentCount: null,
  managersCount: null,
  genderDistribution: null,
  managerDistribution: null,
  jobDistribution: null,
  departmentDistribution: null,
  employmentTypeDistribution: null,
  loading: false,
  error: null,
  isSuccess: false,
  isError: false,
  message: '',
  pagination: null,
};

const slice = createSlice({
  name: 'employment',
  initialState,
  reducers: {
    // Get Employments
    getEmploymentsRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getEmploymentsSuccess(state, action: PayloadAction<EmploymentsResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employments = action.payload.employments;
      state.pagination = action.payload.pagination;
      state.message = 'Employments fetched successfully';
    },
    getEmploymentsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Employment by ID
    getEmploymentByIdRequest(state, action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getEmploymentByIdSuccess(state, action: PayloadAction<EmploymentResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.currentEmployment = action.payload.employment;
      state.message = 'Employment fetched successfully';
    },
    getEmploymentByIdFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get Latest Employment for Employee
    getLatestEmploymentRequest(state, action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getLatestEmploymentSuccess(state, action: PayloadAction<EmploymentResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.currentEmployment = action.payload.employment;
      state.message = 'Latest employment fetched successfully';
    },
    getLatestEmploymentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Create Employment
    createEmploymentRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    createEmploymentSuccess(state, action: PayloadAction<EmploymentResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employments = [action.payload.employment, ...state.employments];
      state.message = 'Employment created successfully';
    },
    createEmploymentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Update Employment
    updateEmploymentRequest(state, action: PayloadAction<{ id: number; data: any }>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    updateEmploymentSuccess(state, action: PayloadAction<EmploymentResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employments = state.employments.map((employment) =>
        employment.id === action.payload.employment.id ? action.payload.employment : employment
      );
      if (state.currentEmployment?.id === action.payload.employment.id) {
        state.currentEmployment = action.payload.employment;
      }
      state.message = 'Employment updated successfully';
    },
    updateEmploymentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Delete Employment
    deleteEmploymentRequest(state, action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    deleteEmploymentSuccess(state, action: PayloadAction<number>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.employments = state.employments.filter((employment) => employment.id !== action.payload);
      if (state.currentEmployment?.id === action.payload) {
        state.currentEmployment = null;
      }
      state.message = 'Employment deleted successfully';
    },
    deleteEmploymentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Statistics
    getEmploymentCountRequest(state) {
      state.loading = true;
    },
    getEmploymentCountSuccess(state, action: PayloadAction<CountResponse>) {
      state.loading = false;
      state.employmentCount = action.payload.count;
    },
    getEmploymentCountFailure(state) {
      state.loading = false;
    },

    getActiveEmploymentCountRequest(state) {
      state.loading = true;
    },
    getActiveEmploymentCountSuccess(state, action: PayloadAction<CountResponse>) {
      state.loading = false;
      state.activeEmploymentCount = action.payload.count;
    },
    getActiveEmploymentCountFailure(state) {
      state.loading = false;
    },

    getInactiveEmploymentCountRequest(state) {
      state.loading = true;
    },
    getInactiveEmploymentCountSuccess(state, action: PayloadAction<CountResponse>) {
      state.loading = false;
      state.inactiveEmploymentCount = action.payload.count;
    },
    getInactiveEmploymentCountFailure(state) {
      state.loading = false;
    },

    getManagersCountRequest(state) {
      state.loading = true;
    },
    getManagersCountSuccess(state, action: PayloadAction<CountResponse>) {
      state.loading = false;
      state.managersCount = action.payload.count;
    },
    getManagersCountFailure(state) {
      state.loading = false;
    },

    getGenderDistributionRequest(state) {
      state.loading = true;
    },
    getGenderDistributionSuccess(state, action: PayloadAction<DistributionResponse>) {
      state.loading = false;
      state.genderDistribution = action.payload;
    },
    getGenderDistributionFailure(state) {
      state.loading = false;
    },

    getManagerDistributionRequest(state) {
      state.loading = true;
    },
    getManagerDistributionSuccess(state, action: PayloadAction<DistributionResponse>) {
      state.loading = false;
      state.managerDistribution = action.payload;
    },
    getManagerDistributionFailure(state) {
      state.loading = false;
    },

    getJobDistributionRequest(state) {
      state.loading = true;
    },
    getJobDistributionSuccess(state, action: PayloadAction<DistributionResponse>) {
      state.loading = false;
      state.jobDistribution = action.payload;
    },
    getJobDistributionFailure(state) {
      state.loading = false;
    },

    getDepartmentDistributionRequest(state) {
      state.loading = true;
    },
    getDepartmentDistributionSuccess(state, action: PayloadAction<DistributionResponse>) {
      state.loading = false;
      state.departmentDistribution = action.payload;
    },
    getDepartmentDistributionFailure(state) {
      state.loading = false;
    },

    getEmploymentTypeDistributionRequest(state) {
      state.loading = true;
    },
    getEmploymentTypeDistributionSuccess(state, action: PayloadAction<DistributionResponse>) {
      state.loading = false;
      state.employmentTypeDistribution = action.payload;
    },
    getEmploymentTypeDistributionFailure(state) {
      state.loading = false;
    },

    // Reset
    reset(state) {
      state.loading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
      state.error = null;
    },

    // Clear Current Employment
    clearCurrentEmployment(state) {
      state.currentEmployment = null;
    },
  },
});

export const { actions: employmentActions } = slice;

export const useEmploymentSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: employmentSaga });
  return { actions: slice.actions };
};

export default slice.reducer;

