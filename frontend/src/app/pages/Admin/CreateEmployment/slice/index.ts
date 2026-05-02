import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { createEmploymentSaga } from './saga';
import { CreateEmploymentState, CreateEmploymentPayload } from './types';

export const initialState: CreateEmploymentState = {
  loading: false,
  error: null,
  success: false,
};

const slice = createSlice({
  name: 'createEmployment',
  initialState,
  reducers: {
    createEmploymentRequest(state, _action: PayloadAction<CreateEmploymentPayload>) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    createEmploymentSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    createEmploymentFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    resetState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
});

export const { actions: createEmploymentActions } = slice;

export const useCreateEmploymentSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: createEmploymentSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
