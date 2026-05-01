import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { employeeDetailSaga } from './saga';
import { Employee } from '../../slice/types';

export interface EmployeeDetailState {
  loading: boolean;
  error: string | null;
  employee: Employee | null;
  detailsCache: Record<string, { data: Employee; lastFetched: number }>;
  approveSuccess: boolean;
  updateSuccess: boolean;
}

export const initialState: EmployeeDetailState = {
  loading: false,
  error: null,
  employee: null,
  detailsCache: {},
  approveSuccess: false,
  updateSuccess: false,
};

const slice = createSlice({
  name: 'employeeDetail',
  initialState,
  reducers: {
    fetchEmployeeRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    fetchEmployeeSuccess(state, action: PayloadAction<Employee>) {
      state.loading = false;
      state.employee = action.payload;
      state.detailsCache[action.payload.id] = {
        data: action.payload,
        lastFetched: Date.now(),
      };
    },
    fetchEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    clearEmployee(state) {
      state.employee = null;
      state.approveSuccess = false;
      state.updateSuccess = false;
    },
    updateEmployeeRequest(state, _action: PayloadAction<{ id: string; section?: string } & Partial<Employee>>) {
      state.loading = true;
      state.error = null;
      state.updateSuccess = false;
    },
    updateEmployeeSuccess(state, action: PayloadAction<Partial<Employee> | undefined>) {
      state.loading = false;
      state.updateSuccess = true;
      if (state.employee && action.payload) {
        state.employee = { ...state.employee, ...action.payload };
        // Update cache too
        state.detailsCache[state.employee.id] = {
          data: state.employee,
          lastFetched: Date.now(),
        };
      }
    },
    updateEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.updateSuccess = false;
    },
    approveEmployeeRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.approveSuccess = false;
    },
    approveEmployeeSuccess(state) {
      state.loading = false;
      state.approveSuccess = true;
    },
    approveEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.approveSuccess = false;
    },
    generateExperienceLetterRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    generateExperienceLetterSuccess(state) {
      state.loading = false;
    },
    generateExperienceLetterFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    // Certificate of Service actions
    generateCertificateOfServiceRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    generateCertificateOfServiceSuccess(state) {
      state.loading = false;
    },
    generateCertificateOfServiceFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: employeeDetailActions } = slice;

export const useEmployeeDetailSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: employeeDetailSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
