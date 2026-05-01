import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { pendingUsersSaga } from './saga';
import { PendingUsersState, PendingUser } from './types';

export const initialState: PendingUsersState = {
  loading: false,
  error: null,
  users: [],
};

const slice = createSlice({
  name: 'pendingUsers',
  initialState,
  reducers: {
    fetchPendingUsersRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchPendingUsersSuccess(state, action: PayloadAction<PendingUser[]>) {
      state.loading = false;
      state.users = action.payload;
    },
    fetchPendingUsersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: pendingUsersActions } = slice;

export const usePendingUsersSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: pendingUsersSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
