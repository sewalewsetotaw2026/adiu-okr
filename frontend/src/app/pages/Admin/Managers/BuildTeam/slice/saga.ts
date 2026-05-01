import { call, put, takeLatest, select, all } from "redux-saga/effects";
import { buildTeamActions } from ".";
import {
  selectFilters,
  selectPagination,
  selectSelectedManager,
} from "./selectors";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";

// Worker Sagas
function* fetchSubordinates(): Generator<any, void, any> {
  try {
    const filters: ReturnType<typeof selectFilters> = yield select(
      selectFilters
    );
    const pagination: ReturnType<typeof selectPagination> = yield select(
      selectPagination
    );
    const selectedManager: ReturnType<typeof selectSelectedManager> =
      yield select(selectSelectedManager);
    const { page, limit } = pagination;
    // We also want to exclude the manager themselves from the search results
    // AND restrict to active employees
    const { gender, department, job_title, job_level, search: query } = filters; // Renamed search to query to avoid conflict
    const managerId = selectedManager?.id;

    let params = `?page=${page}&limit=${limit}&is_active=true&onboarding_status=COMPLETED`;
    if (managerId) {
      params += `&exclude_id=${managerId}`;
    }
    if (query) params += `&search=${query}`;
    if (gender) params += `&gender=${gender}`;
    if (department) params += `&department=${department}`;
    if (job_title) params += `&job_title=${job_title}`;
    if (job_level) params += `&job_level=${job_level}`;
    // Add sorting mapping similarly to main slice if needed

    // We only want active employees usually for assignment
    // (Already added in params init)

    // Exclude selected manager from the list
    // (Already added in params init)

    const [employeesRes, countRes]: any[] = yield all([
      call(makeCall, {
        method: "GET",
        route: `${apiRoutes.employees}${params}`,
        isSecureRoute: true,
      }),
      call(makeCall, {
        method: "GET",
        route: apiRoutes.employeesCount,
        isSecureRoute: true,
      }),
    ]);

    const employees = (employeesRes?.data?.data?.employees || []).map(
      (emp: any) => ({
        ...emp,
        job_title: emp.employments?.[0]?.jobTitle?.title || "Unspecified",
        department: emp.employments?.[0]?.department?.name || "Unspecified",
      })
    );
    let total = countRes?.data?.data?.count || employees.length;

    yield put(buildTeamActions.fetchSubordinatesSuccess({ employees, total }));
  } catch (error: any) {
    yield put(buildTeamActions.fetchSubordinatesFailure(error.message));
  }
}

// Fetch manager details and their existing team
function* fetchManager(
  action: ReturnType<typeof buildTeamActions.fetchManagerRequest>
): Generator<any, void, any> {
  const id = action.payload;
  try {
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.employeeDetail(id),
      isSecureRoute: true,
    });

    const rawData = response?.data?.data.employee;

    // Map raw detail data to the Employee shape expected by the slice
    const manager: any = {
      id: rawData.id,
      full_name: rawData.full_name,
      email: rawData.email,
      profile_picture: rawData.profile_picture,
      job_title: rawData.employments?.[0]?.jobTitle?.title,
      department: rawData.employments?.[0]?.department?.name,
      team_size: 0,
      // Add missing required fields with defaults to satisfy TS
      employee_id: rawData.employee_id || rawData.id,
      gender: rawData.gender || "Unspecified",
      date_of_birth: rawData.date_of_birth || null,
    };

    console.log("the manager", manager);

    yield put(buildTeamActions.fetchManagerSuccess(manager));

    // Auto-fetch subordinates (existing team) for this manager
    // We want to pre-select them if they are already in the team?
    // The requirement is usually to "Build Team" which often means assigning NEW members or Editing existing.
    // If we want to show existing team as pre-selected, we need to fetch them and set selectedSubordinateIds.

    // Check if we should pre-populate
    yield call(fetchExistingTeam, id);
  } catch (error: any) {
    console.error("Fetch Manager Failed:", error);
    let message = "Failed to fetch manager details";

    if (typeof error === "string") {
      message = error;
    } else if (typeof error === "object") {
      message =
        error.message ||
        error.error ||
        error.msg ||
        "An unexpected error occurred while loading manager";
    }
    yield put(buildTeamActions.fetchManagerFailure(message));
  }
}

function* fetchExistingTeam(managerId: string): Generator<any, void, any> {
  try {
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.assignManagers.teamMembers(managerId),
      isSecureRoute: true,
    });

    // Aggressive parsing to find the array of employees
    let teamList: any[] = [];
    const data = response?.data;

    if (Array.isArray(data)) {
      teamList = data;
    } else if (Array.isArray(data?.data)) {
      teamList = data.data;
    } else if (Array.isArray(data?.employees)) {
      teamList = data.employees;
    } else if (Array.isArray(data?.data?.employees)) {
      teamList = data.data.employees;
    }

    const team = teamList.map((emp: any) => ({
      ...emp,
      job_title:
        emp.job_title || emp.employments?.[0]?.jobTitle?.title || "Unspecified",
      department:
        emp.department ||
        emp.employments?.[0]?.department?.name ||
        "Unspecified",
    }));

    const teamIds = team.map((e: any) => e.id);

    yield put(buildTeamActions.setExistingTeam(team));
    yield put(buildTeamActions.setSelectedSubordinateIds(teamIds));
  } catch (error) {
    console.error("Failed to fetch manager team", error);
  }
}

function* assignTeam(
  action: ReturnType<typeof buildTeamActions.assignTeamRequest>
): Generator<any, void, any> {
  const { managerId, employeeIds } = action.payload;
  console.log("[BuildTeamSaga] assignTeam started", { managerId, employeeIds });
  try {
    if (!managerId) {
      throw new Error("Invalid manager ID");
    }

    yield call(makeCall, {
      method: "POST",
      route: apiRoutes.assignManagers.bulkAssign,
      body: {
        manager_id: managerId,
        subordinate_ids: employeeIds,
        strategy: "replace",
      },
      isSecureRoute: true,
    });

    yield put(buildTeamActions.assignTeamSuccess());
    // yield put(buildTeamActions.setSelectedSubordinateIds([])); // Don't clear manually, let fetchExistingTeam handle state sync

    // Refresh the existing team to show the updated roster
    yield call(fetchExistingTeam, managerId);
  } catch (error: any) {
    console.error("Assign Team Failed:", error);
    let message = "Failed to assign team";

    if (typeof error === "string") {
      message = error;
    } else if (typeof error === "object") {
      message =
        error.message ||
        error.error ||
        error.msg ||
        "An unexpected error occurred during assignment";
    }

    yield put(buildTeamActions.assignTeamFailure(message));
  }
}

// Watcher Saga
export function* buildTeamSaga() {
  yield takeLatest(
    [
      buildTeamActions.fetchSubordinatesRequest,
      buildTeamActions.setFilters,
      buildTeamActions.setPage,
    ],
    fetchSubordinates
  );

  yield takeLatest(buildTeamActions.fetchManagerRequest.type, fetchManager);
  yield takeLatest(buildTeamActions.assignTeamRequest.type, assignTeam);
}
