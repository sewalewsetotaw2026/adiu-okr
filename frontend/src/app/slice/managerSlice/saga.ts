import { call, put, takeLatest } from "redux-saga/effects";
import { managerActions } from "./index";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";

function* checkIsManagerSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.isManager,
      isSecureRoute: true,
    });
    
    const isManager = response?.data?.data?.isManager ?? false;
    yield put(managerActions.checkIsManagerSuccess(isManager));
  } catch (error) {
    // Silent fail or just assume false
    yield put(managerActions.checkIsManagerFailure("Failed to check manager status"));
  }
}

function* getMyTeamSaga(action: ReturnType<typeof managerActions.getMyTeam>) {
  try {
    const recursive = action.payload?.recursive;
    const route = recursive ? `${apiRoutes.myTeam}?recursive=true` : apiRoutes.myTeam;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });
    
    // Handle different response structures gracefully
    const teamMembers = 
      response?.data?.data?.teamMembers ?? 
      response?.data?.teamMembers ?? 
      [];
      
    yield put(managerActions.getMyTeamSuccess(teamMembers));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch team members.";
    yield put(managerActions.getMyTeamFailure(errorMessage));
  }
}

function* getTeamLeaveApplicationsSaga(
  action: ReturnType<typeof managerActions.getTeamLeaveApplications>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.teamLeaveApplications}?${queryParams.toString()}`
      : apiRoutes.teamLeaveApplications;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data?.data ?? response?.data;
    
    yield put(
      managerActions.getTeamLeaveApplicationsSuccess({
        applications: raw?.applications ?? [],
        total: raw?.total ?? 0,
        page: raw?.page ?? 1,
        totalPages: raw?.totalPages ?? 1,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch team leave applications.";
    yield put(managerActions.getTeamLeaveApplicationsFailure(errorMessage));
  }
}

function* getTeamOnLeaveTodaySaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.teamOnLeaveToday,
      isSecureRoute: true,
    });
    
    const employees = 
      response?.data?.data?.employees ?? 
      response?.data?.employees ?? 
      [];
      
    yield put(managerActions.getTeamOnLeaveTodaySuccess(employees));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch team members on leave.";
    yield put(managerActions.getTeamOnLeaveTodayFailure(errorMessage));
  }
}

export default function* managerSaga() {
  yield takeLatest(managerActions.checkIsManager.type, checkIsManagerSaga);
  yield takeLatest(managerActions.getMyTeam.type, getMyTeamSaga);
  yield takeLatest(managerActions.getTeamLeaveApplications.type, getTeamLeaveApplicationsSaga);
  yield takeLatest(managerActions.getTeamOnLeaveToday.type, getTeamOnLeaveTodaySaga);
}
