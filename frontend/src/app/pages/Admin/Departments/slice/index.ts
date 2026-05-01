import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { departmentsSaga } from './saga';
import { Department, DepartmentsState } from './types';

export const initialState: DepartmentsState = {
  isLoading: false,
  departments: [],
  pagination: null,
  error: null,
};

const slice = createSlice({
  name: 'departments',
  initialState,
  reducers: {
    fetchDepartmentsStart(state, _action: PayloadAction<{ page?: number; limit?: number } | undefined>) {
      state.isLoading = true;
      state.error = null;
    },
    fetchDepartmentsSuccess(state, action: PayloadAction<{ department: Department[]; pagination: DepartmentsState['pagination'] }>) {
      state.isLoading = false;
      state.departments = action.payload.department;
      state.pagination = action.payload.pagination;
    },
    fetchDepartmentsFailure(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
    createDepartmentRequest(state, _action: PayloadAction<{ name: string }>) {
      state.isLoading = true;
      state.error = null;
    },
    createDepartmentSuccess(state, action: PayloadAction<Department>) {
      state.isLoading = false;
      state.departments.push(action.payload);
    },
    createDepartmentFailure(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
    deleteDepartmentRequest(state, _action: PayloadAction<number>) {
      state.isLoading = true;
      state.error = null;
    },
    deleteDepartmentSuccess(state, action: PayloadAction<number>) {
      state.isLoading = false;
      state.departments = state.departments.filter(d => d.id !== action.payload);
    },
    deleteDepartmentFailure(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
    assignHeadRequest(state, _action: PayloadAction<{ departmentId: number; headUserId: number }>) {
      state.isLoading = true;
      state.error = null;
    },
    assignHeadSuccess(state, action: PayloadAction<{ departmentId: number; head: Department['head'] }>) {
      state.isLoading = false;
      const dept = state.departments.find(d => d.id === action.payload.departmentId);
      if (dept) {
        dept.head_user_id = action.payload.head?.id;
        dept.head = action.payload.head;
      }
    },
    assignHeadFailure(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },

  },
});

export const { actions: departmentsActions } = slice;

export const useDepartments = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: departmentsSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
