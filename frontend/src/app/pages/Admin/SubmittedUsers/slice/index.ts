import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { submittedUsersSaga } from './saga';
import { SubmittedUsersState, SubmittedUser } from './types';

export const initialState: SubmittedUsersState = {
  loading: false,
  error: null,
  users: [],
  selectedUser: null,
  approving: false,
  rejecting: false,
};

const slice = createSlice({
  name: 'submittedUsers',
  initialState,
  reducers: {
    fetchSubmittedUsersRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchSubmittedUsersSuccess(state, action: PayloadAction<SubmittedUser[]>) {
      state.loading = false;
      state.users = action.payload;
    },
    fetchSubmittedUsersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setSelectedUser(state, action: PayloadAction<SubmittedUser | null>) {
      state.selectedUser = action.payload;
    },
    approveUserRequest(state, _action: PayloadAction<{ userId: number; employeeId: string }>) {
      state.approving = true;
    },
    approveUserSuccess(state, action: PayloadAction<number>) {
      state.approving = false;
      state.users = state.users.filter(u => u.id !== action.payload);
    },
    approveUserFailure(state, action: PayloadAction<string>) {
      state.approving = false;
      state.error = action.payload;
    },
    rejectUserRequest(state, _action: PayloadAction<{ userId: number; employeeId: string }>) {
      state.rejecting = true;
    },
    rejectUserSuccess(state, action: PayloadAction<number>) {
      state.rejecting = false;
      state.users = state.users.filter(u => u.id !== action.payload);
    },
    rejectUserFailure(state, action: PayloadAction<string>) {
      state.rejecting = false;
      state.error = action.payload;
    },
  },
});

export const { actions: submittedUsersActions } = slice;

export const useSubmittedUsersSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: submittedUsersSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
