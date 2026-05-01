import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { userSaga } from './saga';
import { UserState, User, UsersResponse, UserResponse, UserCountResponse } from './types';

export const initialState: UserState = {
  users: [],
  currentUser: null,
  userCount: null,
  loading: false,
  error: null,
  isSuccess: false,
  isError: false,
  message: '',
  pagination: null,
};

const slice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // Get Users
    getUsersRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getUsersSuccess(state, action: PayloadAction<UsersResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.users = action.payload.users;
      state.pagination = action.payload.pagination;
      state.message = 'Users fetched successfully';
    },
    getUsersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get User by ID
    getUserByIdRequest(state, action: PayloadAction<number | string>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getUserByIdSuccess(state, action: PayloadAction<UserResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.currentUser = action.payload.user;
      state.message = 'User fetched successfully';
    },
    getUserByIdFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Create User
    createUserRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    createUserSuccess(state, action: PayloadAction<UserResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.users = [action.payload.user, ...state.users];
      state.message = 'User created successfully';
    },
    createUserFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Update User
    updateUserRequest(state, action: PayloadAction<{ id: number; data: any }>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    updateUserSuccess(state, action: PayloadAction<UserResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.users = state.users.map((user) =>
        user.id === action.payload.user.id ? action.payload.user : user
      );
      if (state.currentUser?.id === action.payload.user.id) {
        state.currentUser = action.payload.user;
      }
      state.message = 'User updated successfully';
    },
    updateUserFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Change Password
    changePasswordRequest(state, action: PayloadAction<{ id: number; newPassword: string }>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    changePasswordSuccess(state) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.message = 'Password changed successfully';
    },
    changePasswordFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Delete User
    deleteUserRequest(state, action: PayloadAction<number>) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    deleteUserSuccess(state, action: PayloadAction<number>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.users = state.users.filter((user) => user.id !== action.payload);
      if (state.currentUser?.id === action.payload) {
        state.currentUser = null;
      }
      state.message = 'User deactivated successfully';
    },
    deleteUserFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isError = true;
      state.isSuccess = false;
      state.error = action.payload;
      state.message = action.payload;
    },

    // Get User Count
    getUserCountRequest(state) {
      state.loading = true;
      state.error = null;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
    getUserCountSuccess(state, action: PayloadAction<UserCountResponse>) {
      state.loading = false;
      state.isSuccess = true;
      state.isError = false;
      state.userCount = action.payload.count;
    },
    getUserCountFailure(state, action: PayloadAction<string>) {
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

    // Clear Current User
    clearCurrentUser(state) {
      state.currentUser = null;
    },
  },
});

export const { actions: userActions } = slice;

export const useUserSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: userSaga });
  return { actions: slice.actions };
};

export default slice.reducer;

