import { call, put, takeLatest } from "redux-saga/effects";
import { companyObjectivesActions } from ".";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";
import { PayloadAction } from "@reduxjs/toolkit";
import {
  CreateCompanyObjectivePayload,
  UpdateCompanyObjectivePayload,
  ObjectiveIdPayload,
} from "./types";

/* ================= ERROR HANDLER ================= */
const extractErrorMessage = (error: any): string => {
  const data = error?.response?.data || error;

  return (
    data?.error || data?.message || data?.data?.error || "Something went wrong"
  );
};

/* ================= FETCH ================= */
function* fetchObjectives(action: PayloadAction<{ cycle_id: number }>) {
  try {
    const response = yield call(makeCall as any, {
      method: "GET",
      route: `${apiRoutes.okr.companyObjectives}?cycle_id=${action.payload.cycle_id}`,
      isSecureRoute: true,
    });

    const objectives = response?.data?.data || response?.data || [];

    yield put(companyObjectivesActions.fetchObjectivesSuccess(objectives));
  } catch (error: any) {
    yield put(
      companyObjectivesActions.fetchObjectivesFailure(
        extractErrorMessage(error),
      ),
    );
  }
}

/* ================= CREATE ================= */
function* createObjective(
  action: PayloadAction<CreateCompanyObjectivePayload>,
) {
  try {
    yield call(makeCall as any, {
      method: "POST",
      route: apiRoutes.okr.companyObjectives,
      body: action.payload,
      isSecureRoute: true,
    });

    yield put(companyObjectivesActions.createObjectiveSuccess());

    yield put(
      companyObjectivesActions.fetchObjectivesRequest({
        cycle_id: action.payload.cycle_id,
      }),
    );
  } catch (error: any) {
    yield put(
      companyObjectivesActions.createObjectiveFailure(
        extractErrorMessage(error),
      ),
    );
  }
}

/* ================= UPDATE ================= */
function* updateObjective(
  action: PayloadAction<UpdateCompanyObjectivePayload>,
) {
  try {
    yield call(makeCall as any, {
      method: "PUT",
      route: apiRoutes.okr.companyObjectiveById(action.payload.id),
      body: action.payload.data,
      isSecureRoute: true,
    });

    yield put(companyObjectivesActions.updateObjectiveSuccess());

    if (action.payload.cycle_id) {
      yield put(
        companyObjectivesActions.fetchObjectivesRequest({
          cycle_id: action.payload.cycle_id,
        }),
      );
    }
  } catch (error: any) {
    yield put(
      companyObjectivesActions.updateObjectiveFailure(
        extractErrorMessage(error),
      ),
    );
  }
}

/* ================= DELETE ================= */
function* deleteObjective(action: PayloadAction<ObjectiveIdPayload>) {
  try {
    yield call(makeCall as any, {
      method: "DELETE",
      route: apiRoutes.okr.companyObjectiveById(action.payload.id),
      isSecureRoute: true,
    });

    yield put(companyObjectivesActions.deleteObjectiveSuccess());

    if (action.payload.cycle_id) {
      yield put(
        companyObjectivesActions.fetchObjectivesRequest({
          cycle_id: action.payload.cycle_id,
        }),
      );
    }
  } catch (error: any) {
    yield put(
      companyObjectivesActions.deleteObjectiveFailure(
        extractErrorMessage(error),
      ),
    );
  }
}

/* ================= ROOT ================= */
export function* companyObjectivesSaga() {
  yield takeLatest(
    companyObjectivesActions.fetchObjectivesRequest.type,
    fetchObjectives,
  );

  yield takeLatest(
    companyObjectivesActions.createObjectiveRequest.type,
    createObjective,
  );

  yield takeLatest(
    companyObjectivesActions.updateObjectiveRequest.type,
    updateObjective,
  );

  yield takeLatest(
    companyObjectivesActions.deleteObjectiveRequest.type,
    deleteObjective,
  );
}
