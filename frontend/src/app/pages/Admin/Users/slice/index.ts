import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { usersSaga } from "./saga";
import { UsersState, User } from "./types";

export const initialState: UsersState = {
  loading: false,
  error: null,
  users: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

const slice = createSlice({
  name: "users",
  initialState,
  reducers: {
    fetchUsersRequest(
      state,
      action: PayloadAction<{ page?: number; limit?: number } | undefined>,
    ) {
      state.loading = true;
      state.error = null;

      if (action?.payload?.page) {
        state.pagination.page = action.payload.page;
      }
      if (action?.payload?.limit) {
        state.pagination.limit = action.payload.limit;
      }
    },

    fetchUsersSuccess(
      state,
      action: PayloadAction<{
        users: User[];
        total: number;
        page: number;
        limit: number;
      }>,
    ) {
      const { users, total, page, limit } = action.payload;
      state.loading = false;
      state.users = users;
      state.pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil((total || 0) / (limit || 1)),
      };
    },

    fetchUsersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload || "Failed to fetch users";
    },

    resetState() {
      return initialState;
    },
  },
});

export const { actions: usersActions } = slice;

export const useUsersSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: usersSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
