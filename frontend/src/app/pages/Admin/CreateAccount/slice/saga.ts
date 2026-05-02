import { call, put, takeLatest } from "redux-saga/effects";
import { createAccountActions } from ".";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { PayloadAction } from "@reduxjs/toolkit";
import { CreateAccountPayload } from "./types";

const extractErrorMessage = (error: any): string => {
  const responseData = error?.response?.data;
  const data = responseData ?? error?.data ?? error;

  const candidate =
    data?.error ||
    data?.data?.error ||
    responseData?.error ||
    responseData?.data?.error ||
    data?.errors?.[0]?.message ||
    data?.errors?.[0] ||
    data?.message ||
    responseData?.message ||
    error?.message;

  if (typeof candidate === "string" && candidate.trim()) {
    // Avoid surfacing generic transport errors when we have a better message.
    if (candidate.trim().toLowerCase() === "internal server error") {
      const specific =
        (typeof data?.error === "string" && data.error.trim() && data.error) ||
        (typeof data?.data?.error === "string" &&
          data.data.error.trim() &&
          data.data.error) ||
        (typeof responseData?.error === "string" &&
          responseData.error.trim() &&
          responseData.error) ||
        (typeof responseData?.data?.error === "string" &&
          responseData.data.error.trim() &&
          responseData.data.error);

      if (specific) return specific;
    }
    return candidate;
  }

  return "Failed to create account. Please check all required fields.";
};

function* createAccount(action: PayloadAction<CreateAccountPayload>) {
  try {
    // Log the payload being sent
    console.log(
      "Creating account with payload:",
      JSON.stringify(action.payload, null, 2)
    );

    const response = yield call(makeCall as any, {
      method: "POST",
      route: apiRoutes.users,
      body: action.payload,
      isSecureRoute: true,
    });

    console.log("Account creation response:", response);
    yield put(createAccountActions.createAccountSuccess());
  } catch (error: any) {
    // Log the full error for debugging
    console.error("Account creation error:", error);

    const errorMessage = extractErrorMessage(error);

    yield put(createAccountActions.createAccountFailure(errorMessage));
  }
}

export function* createAccountSaga() {
  yield takeLatest(
    createAccountActions.createAccountRequest.type,
    createAccount
  );
}
