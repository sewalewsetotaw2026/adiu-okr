import { call, put, takeLatest } from 'redux-saga/effects';
import { jobTitlesActions } from '.';
import makeCall from '../../../../../API';
import apiRoutes from '../../../../../API/apiRoutes';

function* fetchAllJobTitles() {
  try {
    const response: { data: { data: { jobTitles: any[] } } } = yield call(makeCall as any, {
      method: 'GET',
      route: apiRoutes.jobTitles,
      isSecureRoute: true,
    });
    yield put(jobTitlesActions.fetchAllJobTitlesSuccess(response.data.data.jobTitles));
  } catch (error: any) {
    yield put(jobTitlesActions.fetchAllJobTitlesFailure(error.message || 'Failed to fetch job titles'));
  }
}

export function* jobTitlesSaga() {
  yield takeLatest(jobTitlesActions.fetchAllJobTitlesRequest.type, fetchAllJobTitles);
}
