import { call, put, takeLatest } from "redux-saga/effects";
import { createAccountActions } from ".";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";
import { PayloadAction } from "@reduxjs/toolkit";
import { CreateAccountPayload } from "./types";

function* createAccount(action: PayloadAction<CreateAccountPayload>) {
  try {
    yield call(makeCall as any, {
      method: "POST",
      route: apiRoutes.users,
      body: action.payload,
      isSecureRoute: true,
    });

    yield put(createAccountActions.createAccountSuccess());
  } catch (error: any) {
    yield put(
      createAccountActions.createAccountFailure(
        error.message || "Failed to create account"
      )
    );
  }
}

export function* createAccountSaga() {
  yield takeLatest(
    createAccountActions.createAccountRequest.type,
    createAccount
  );
}
