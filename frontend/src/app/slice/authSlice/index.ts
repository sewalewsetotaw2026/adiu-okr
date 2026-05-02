import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { authSaga } from "./saga";
import {
  AuthState,
  User,
  LoginResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  UpdatePasswordResponse,
} from "./types";

// Get initial state from localStorage if available
const getInitialState = (): AuthState => {
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  return {
    user:
      storedUser && storedUser !== "undefined" ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    loading: false,
    error: null,
    isSuccess: false,
    isError: false,
    message: "",
  };
};

export const initialState: AuthState = getInitialState();

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginRequest(
      state,
      action: PayloadAction<{ email: string; password: string }>
    ) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = "";
    },
    loginSuccess(state, action: PayloadAction<LoginResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.token = action.payload.token;
      state.user = action.payload.data.user;
      state.message = "Login successful";

      // Store in localStorage
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.data.user));
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
      state.token = null;
      state.user = null;
    },
    forgotPasswordRequest(state, action: PayloadAction<{ email: string }>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = "";
    },
    forgotPasswordSuccess(
      state,
      action: PayloadAction<ForgotPasswordResponse>
    ) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.message = action.payload.message;
    },
    forgotPasswordFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },
    resetPasswordRequest(
      state,
      action: PayloadAction<{ token: string; password: string }>
    ) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = "";
    },
    resetPasswordSuccess(state, action: PayloadAction<ResetPasswordResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.token = action.payload.token;
      state.user = action.payload.data.user;
      state.message = "Password reset successful";

      // Store in localStorage
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.data.user));
    },
    resetPasswordFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },
    updatePasswordRequest(
      state,
      action: PayloadAction<{ currentPassword: string; newPassword: string }>
    ) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = "";
    },
    updatePasswordSuccess(
      state,
      action: PayloadAction<UpdatePasswordResponse>
    ) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.token = action.payload.token;
      state.user = action.payload.data.user;
      state.message = "Password updated successfully";

      // Store in localStorage
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.data.user));
    },
    updatePasswordFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    getMeRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = "";
    },
    getMeSuccess(state, action: PayloadAction<User>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.user = action.payload;
      state.message = "User refreshed";

      localStorage.setItem("user", JSON.stringify(action.payload));
    },
    getMeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isSuccess = false;
      state.isError = false;
      state.message = "";
      state.error = null;

      // Clear localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
    reset(state) {
      state.loading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = "";
      state.error = null;
    },
  },
});

export const { actions: authActions } = slice;

export const useAuthSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: authSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
