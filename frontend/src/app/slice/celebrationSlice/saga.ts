import { call, put, takeLatest } from "redux-saga/effects";
import { PayloadAction } from "@reduxjs/toolkit";
import { celebrationActions } from "./index";
import celebrationService from "../../services/celebrationService";
import { Celebration, CelebrationMessage } from "../../models/celebration";

/**
 * Fetch all active celebrations
 */
function* fetchCelebrationsSaga() {
  try {
    const celebrations: Celebration[] = yield call(
      celebrationService.getCelebrations
    );
    yield put(celebrationActions.fetchCelebrationsSuccess(celebrations));
  } catch (error: any) {
    yield put(
      celebrationActions.fetchCelebrationsFailure(
        error.message || "Failed to fetch celebrations"
      )
    );
  }
}

/**
 * Fetch a single celebration by ID (includes full messages list)
 */
function* fetchCelebrationByIdSaga(action: PayloadAction<string>) {
  try {
    const celebration: Celebration = yield call(
      celebrationService.getCelebrationById,
      action.payload
    );
    yield put(celebrationActions.fetchCelebrationByIdSuccess(celebration));
  } catch (error: any) {
    yield put(
      celebrationActions.fetchCelebrationByIdFailure(
        error.message || "Failed to fetch celebration"
      )
    );
  }
}

/**
 * Dismiss a celebration
 */
function* dismissCelebrationSaga(action: PayloadAction<string>) {
  try {
    yield call(celebrationService.dismissCelebration, action.payload);
    yield put(celebrationActions.dismissCelebrationSuccess(action.payload));
  } catch (error: any) {
    yield put(
      celebrationActions.dismissCelebrationFailure({
        id: action.payload,
        error: error.message || "Failed to dismiss celebration",
      })
    );
  }
}

/**
 * Send a message/wish
 */
function* sendMessageSaga(
  action: PayloadAction<{ celebrationId: string; message: string }>
) {
  try {
    const message: CelebrationMessage = yield call(
      celebrationService.sendMessage,
      action.payload.celebrationId,
      action.payload.message
    );
    yield put(celebrationActions.sendMessageSuccess(message));
  } catch (error: any) {
    yield put(
      celebrationActions.sendMessageFailure(
        error.message || "Failed to send message"
      )
    );
  }
}

/**
 * Send a reaction
 */
function* sendReactionSaga(
  action: PayloadAction<{ celebrationId: string; reaction: string }>
) {
  try {
    yield call(
      celebrationService.sendReaction,
      action.payload.celebrationId,
      action.payload.reaction
    );
    yield put(
      celebrationActions.sendReactionSuccess({
        celebrationId: action.payload.celebrationId,
      })
    );
  } catch (error: any) {
    yield put(
      celebrationActions.sendReactionFailure({
        id: action.payload.celebrationId,
        error: error.message || "Failed to send reaction",
      })
    );
  }
}

/**
 * Root saga for celebrations
 */
export function* celebrationSaga() {
  yield takeLatest(
    celebrationActions.fetchCelebrationsRequest.type,
    fetchCelebrationsSaga
  );
  yield takeLatest(
    celebrationActions.fetchCelebrationByIdRequest.type,
    fetchCelebrationByIdSaga
  );
  yield takeLatest(
    celebrationActions.dismissCelebrationRequest.type,
    dismissCelebrationSaga
  );
  yield takeLatest(
    celebrationActions.sendMessageRequest.type,
    sendMessageSaga
  );
  yield takeLatest(
    celebrationActions.sendReactionRequest.type,
    sendReactionSaga
  );
}
