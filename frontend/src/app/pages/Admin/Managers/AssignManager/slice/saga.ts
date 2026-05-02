import { call, put, takeLatest, debounce } from "redux-saga/effects";
import { assignManagerActions } from ".";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";

// Worker Sagas
function* searchManagers(action: ReturnType<typeof assignManagerActions.searchManagersRequest>) {
  const query = action.payload;
  try {
    // Use general employees endpoint to allow filtering by onboarding_status
    // We strictly want COMPLETED status for managers as per requirements
    // AND is_active=true
    let params = `?search=${query || ""}&onboarding_status=COMPLETED&is_active=true`;

    const response: any = yield call(makeCall, {
      method: "GET",
      route: `${apiRoutes.employees}${params}`,
      isSecureRoute: true,
    });

    const rawEmployees = response?.data?.data?.employees || [];

    // Map the employee data to match the expected format for the UI
    const employees = rawEmployees.map((emp: any) => ({
      id: emp.id,
      full_name: emp.full_name,
      // Map nested appUser data
      email: emp.appUsers?.[0]?.email,
      profile_picture: emp.appUsers?.[0]?.profile_picture,
      // Map active employment data
      job_title: emp.employments?.[0]?.jobTitle?.title,
      department: emp.employments?.[0]?.department?.name,
      team_size: 0 // Count not available in this view, defaulting to 0
    }));

    yield put(assignManagerActions.searchManagersSuccess(employees));
  } catch (error) {
    yield put(assignManagerActions.searchManagersSuccess([]));
  }
}

function* fetchExistingManagers() {
  try {
    const response: any = yield call(makeCall, {
      method: 'GET',
      route: apiRoutes.assignManagers.existingManagers,
      isSecureRoute: true
    });
    const managers = response?.data?.data?.managers || [];
    yield put(assignManagerActions.fetchExistingManagersSuccess(managers));
  } catch (error: any) {
    yield put(assignManagerActions.fetchExistingManagersFailure(error.message));
  }
}

// Watcher Saga
export function* assignManagerSaga() {
  yield debounce(500, assignManagerActions.searchManagersRequest, searchManagers);
  yield takeLatest(assignManagerActions.fetchExistingManagersRequest, fetchExistingManagers);
}
