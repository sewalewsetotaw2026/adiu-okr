import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { jobTitlesSaga } from './saga';
import { JobTitlesState, JobTitle } from './types';

export const initialState: JobTitlesState = {
  loading: false,
  error: null,
  jobTitles: [],
};

const slice = createSlice({
  name: 'jobTitles',
  initialState,
  reducers: {
    fetchAllJobTitlesRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchAllJobTitlesSuccess(state, action: PayloadAction<JobTitle[]>) {
      state.loading = false;
      state.jobTitles = action.payload;
    },
    fetchAllJobTitlesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: jobTitlesActions } = slice;

export const useJobTitlesSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: jobTitlesSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
