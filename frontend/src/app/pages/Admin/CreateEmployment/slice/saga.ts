import { call, put, takeLatest } from 'redux-saga/effects';
import { createEmploymentActions } from '.';
import makeCall from '../../../../API';
import apiRoutes from '../../../../API/apiRoutes';
import { PayloadAction } from '@reduxjs/toolkit';
import { CreateEmploymentPayload } from './types';

function* createEmployment(action: PayloadAction<CreateEmploymentPayload>) {
  try {
    yield call(makeCall as any, {
      method: 'POST',
      route: apiRoutes.employments,
      body: action.payload,
      isSecureRoute: true,
    });
    yield put(createEmploymentActions.createEmploymentSuccess());
  } catch (error: any) {
    yield put(createEmploymentActions.createEmploymentFailure(error.message || 'Failed to create employment'));
  }
}

export function* createEmploymentSaga() {
  yield takeLatest(createEmploymentActions.createEmploymentRequest.type, createEmployment);
}
