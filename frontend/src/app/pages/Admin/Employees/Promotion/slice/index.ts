import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { promotionSaga } from './saga';
import { PromotionState } from './types';
import { Employee } from '../../slice/types';

export const initialState: PromotionState = {
  loading: false,
  error: null,
  success: false,
  employee: null,
};

const slice = createSlice({
  name: 'promotion',
  initialState,
  reducers: {
    setEmployee(state, action: PayloadAction<Employee>) {
      state.employee = action.payload;
    },
    fetchEmployeeRequest(state, action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    fetchEmployeeSuccess(state, action: PayloadAction<Employee>) {
      state.loading = false;
      state.employee = action.payload;
    },
    fetchEmployeeFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    promoteRequest(state, action: PayloadAction<any>) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    promoteSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    promoteFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    resetPromotion(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
});

export const { actions: promotionActions } = slice;

export const usePromotionSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: promotionSaga });
  return { actions: slice.actions };
};

/**
 * For usage inside functional components
 */
export const promotionReducer = slice.reducer;
