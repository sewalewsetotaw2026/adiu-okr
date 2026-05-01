import { call, put, takeLatest } from "redux-saga/effects";
import { cycleActions } from ".";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";
import { PayloadAction } from "@reduxjs/toolkit";
import {
  CreateCyclePayload,
  UpdateCyclePayload,
  CycleIdPayload,
} from "./types";

/* ================= ERROR HANDLER ================= */
const extractErrorMessage = (error: any): string => {
  const data = error?.response?.data || error;

  return (
    data?.error || data?.message || data?.data?.error || "Something went wrong"
  );
};

/* ================= FETCH ================= */
function* fetchCycles() {
  try {
    const response = yield call(makeCall as any, {
      method: "GET",
      route: apiRoutes.okr.cycles,
      isSecureRoute: true,
    });

    const cycles =
      response?.data?.data || response?.data?.cycles || response?.data || [];

    yield put(cycleActions.fetchCyclesSuccess(cycles));
  } catch (error: any) {
    yield put(cycleActions.fetchCyclesFailure(extractErrorMessage(error)));
  }
}

/* ================= CREATE ================= */
function* createCycle(action: PayloadAction<CreateCyclePayload>) {
  try {
    yield call(makeCall as any, {
      method: "POST",
      route: apiRoutes.okr.cycles,
      body: action.payload,
      isSecureRoute: true,
    });

    yield put(cycleActions.createCycleSuccess());
    yield put(cycleActions.fetchCyclesRequest());
  } catch (error: any) {
    yield put(cycleActions.createCycleFailure(extractErrorMessage(error)));
  }
}

/* ================= UPDATE ================= */
function* updateCycle(action: PayloadAction<UpdateCyclePayload>) {
  try {
    yield call(makeCall as any, {
      method: "PUT",
      route: apiRoutes.okr.cycleById(action.payload.id),
      body: action.payload.data,
      isSecureRoute: true,
    });

    yield put(cycleActions.updateCycleSuccess());
    yield put(cycleActions.fetchCyclesRequest());
  } catch (error: any) {
    yield put(cycleActions.updateCycleFailure(extractErrorMessage(error)));
  }
}

/* ================= OPEN ================= */
function* openCycle(action: PayloadAction<CycleIdPayload>) {
  try {
    yield call(makeCall as any, {
      method: "PATCH",
      route: apiRoutes.okr.openCycle(action.payload.id),
      isSecureRoute: true,
    });

    yield put(cycleActions.openCycleSuccess());
    yield put(cycleActions.fetchCyclesRequest());
  } catch (error: any) {
    yield put(cycleActions.openCycleFailure(extractErrorMessage(error)));
  }
}

/* ================= CLOSE ================= */
function* closeCycle(action: PayloadAction<CycleIdPayload>) {
  try {
    yield call(makeCall as any, {
      method: "PATCH",
      route: apiRoutes.okr.closeCycle(action.payload.id),
      isSecureRoute: true,
    });

    yield put(cycleActions.closeCycleSuccess());
    yield put(cycleActions.fetchCyclesRequest());
  } catch (error: any) {
    yield put(cycleActions.closeCycleFailure(extractErrorMessage(error)));
  }
}

/* ================= ROOT ================= */
export function* cycleSaga() {
  yield takeLatest(cycleActions.fetchCyclesRequest.type, fetchCycles);
  yield takeLatest(cycleActions.createCycleRequest.type, createCycle);
  yield takeLatest(cycleActions.updateCycleRequest.type, updateCycle);
  yield takeLatest(cycleActions.openCycleRequest.type, openCycle);
  yield takeLatest(cycleActions.closeCycleRequest.type, closeCycle);
}
