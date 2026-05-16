import { useInjectReducer } from "redux-injectors";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CreateEmployeeState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: CreateEmployeeState = {
  loading: false,
  error: null,
  success: false,
};

const slice = createSlice({
  name: "createEmployee",
  initialState,
  reducers: {
    createEmployeeRequest(state, _action: PayloadAction<Record<string, string>>) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    createEmployeeSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    createEmployeeFailure(state, action: PayloadAction<string>) {
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

export const { actions: createEmployeeActions, reducer } = slice;

export const useCreateEmployeeSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  return { actions: slice.actions };
};
