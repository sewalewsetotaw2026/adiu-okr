import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { cycleSaga } from "./saga";
import {
  CycleState,
  Cycle,
  CreateCyclePayload,
  UpdateCyclePayload,
  CycleIdPayload,
} from "./types";

export const initialState: CycleState = {
  loading: false,
  error: null,
  cycles: [],
  currentCycle: null,
  success: false,
};

const slice = createSlice({
  name: "cycleManagement",
  initialState,
  reducers: {
    /* ================= LIST ================= */
    fetchCyclesRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchCyclesSuccess(state, action: PayloadAction<Cycle[]>) {
      state.loading = false;
      state.cycles = action.payload;
    },
    fetchCyclesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* ================= CREATE ================= */
    createCycleRequest(state, _action: PayloadAction<CreateCyclePayload>) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    createCycleSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    createCycleFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* ================= UPDATE ================= */
    updateCycleRequest(state, _action: PayloadAction<UpdateCyclePayload>) {
      state.loading = true;
      state.error = null;
    },
    updateCycleSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    updateCycleFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* ================= OPEN ================= */
    openCycleRequest(state, _action: PayloadAction<CycleIdPayload>) {
      state.loading = true;
    },
    openCycleSuccess(state) {
      state.loading = false;
    },
    openCycleFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* ================= CLOSE ================= */
    closeCycleRequest(state, _action: PayloadAction<CycleIdPayload>) {
      state.loading = true;
    },
    closeCycleSuccess(state) {
      state.loading = false;
    },
    closeCycleFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* ================= RESET ================= */
    resetState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
});

export const { actions: cycleActions } = slice;

export const useCycleSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: cycleSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
