import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { createAccountSaga } from './saga';
import { CreateAccountState, CreateAccountPayload } from './types';

export const initialState: CreateAccountState = {
  loading: false,
  error: null,
  success: false,
};

const slice = createSlice({
  name: 'createAccount',
  initialState,
  reducers: {
    createAccountRequest(state: CreateAccountState, _action: PayloadAction<CreateAccountPayload>) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    createAccountSuccess(state: CreateAccountState) {
      state.loading = false;
      state.success = true;
    },
    createAccountFailure(state: CreateAccountState, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    resetState(state: CreateAccountState) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
});

export const { actions: createAccountActions } = slice;

export const useCreateAccountSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: createAccountSaga });
  return { actions: slice.actions };
};

export const createAccountReducer = slice.reducer;
