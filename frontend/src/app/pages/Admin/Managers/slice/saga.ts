import { call, put, takeLatest, select, debounce } from "redux-saga/effects";
import { managerListActions } from ".";
import { selectFilter, selectPagination, selectPages } from "./selectors";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import ToastService from "../../../../../utils/ToastService";

const resolveEmployeeId = (record: any) => {
  const emp0 = record?.employments?.[0] || {};
  // Prefer explicit employee ids over the record id (which may be an employment id)
  return (
    record?.employee?.id ??
    record?.employee_id ??
    record?.employeeId ??
    record?.employee?.employee_id ??
    emp0?.employee_id ??
    emp0?.employeeId ??
    record?.id
  );
};

const normalizeManager = (record: any) => {
  const emp = record?.employments?.[0] || {};
  const resolvedEmployeeId = resolveEmployeeId(record);

  return {
    ...record,
    id:
      resolvedEmployeeId !== undefined && resolvedEmployeeId !== null
        ? String(resolvedEmployeeId)
        : record?.id,
    email: record?.email || record?.appUsers?.[0]?.email || "-",
    profilePicture:
      record?.profilePicture ||
      record?.profile_picture ||
      record?.appUsers?.[0]?.profile_picture,
    job_title: (() => {
      const title =
        record?.job_title ||
        record?.jobTitle ||
        record?.job_title_name ||
        emp?.jobTitle?.title ||
        emp?.job_title ||
        emp?.job_title_name;
      return title && title !== "Unspecified" ? title : "-";
    })(),
    department: (() => {
      const dept =
        record?.department?.name ||
        record?.department_name ||
        (typeof record?.department === "string" ? record.department : null) ||
        emp?.department?.name ||
        emp?.department_name ||
        (typeof emp?.department === "string" ? emp.department : null);
      return dept && dept !== "Unspecified" ? dept : "Unassigned";
    })(),
    team_size:
      record?.team_size !== undefined
        ? record.team_size
        : record?.managedEmployments?.length || 0,
  };
};

function* fetchManagers(): Generator<any, void, any> {
  try {
    const filters = yield select(selectFilter);
    const pagination = yield select(selectPagination);
    const pages = yield select(selectPages);
    const { page, limit } = pagination;
    const { search, department, job_title, job_level } = filters;

    // Check if we already have this page in cache
    if (pages[page]) {
      console.log(`Serving Managers page ${page} from cache`);
      const normalized = (pages[page] || [])
        .map(normalizeManager)
        .filter((m: any) => Boolean(m?.id));
      yield put(
        managerListActions.fetchManagersSuccess({
          managers: normalized,
          total: pagination.total,
          page,
        }),
      );
      return;
    }

    let params = `?page=${page}&limit=${limit}`;
    if (search) params += `&query=${search}`;
    if (department) params += `&department=${department}`;
    if (job_title) params += `&job_title=${job_title}`;
    if (job_level) params += `&job_level=${job_level}`;

    console.log("Fetching Managers with params:", params);

    const response: any = yield call(makeCall, {
      method: "GET",
      route: `${apiRoutes.assignManagers.existingManagers}${params}`,
      isSecureRoute: true,
    });

    const { managers: rawManagers, pagination: resPagination } =
      response?.data?.data || {};

    const managers = (rawManagers || [])
      .map(normalizeManager)
      .filter((m: any) => Boolean(m?.id));

    yield put(
      managerListActions.fetchManagersSuccess({
        managers,
        total: resPagination?.total || 0,
        page,
      }),
    );
  } catch (error: any) {
    yield put(managerListActions.fetchManagersFailure(error.message));
  }
}

function* fetchDirectReports(action: {
  payload: string;
  type: string;
}): Generator<any, void, any> {
  try {
    const managerId = action.payload;
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.assignManagers.teamMembers(managerId),
      isSecureRoute: true,
    });

    const rawEmployees = response?.data?.data?.employees || [];
    const employees = rawEmployees.map((emp: any) => ({
      ...emp,
      job_title:
        emp.job_title ||
        emp.employments?.[0]?.jobTitle?.title ||
        emp.employments?.[0]?.job_title ||
        "-",
      department:
        emp.department?.name ||
        (typeof emp.department === "string" ? emp.department : null) ||
        emp.employments?.[0]?.department?.name ||
        (typeof emp.employments?.[0]?.department === "string"
          ? emp.employments?.[0]?.department
          : null) ||
        "Unassigned",
    }));

    yield put(
      managerListActions.fetchDirectReportsSuccess({
        managerId,
        reports: employees,
      }),
    );
  } catch (error: any) {
    yield put(managerListActions.fetchDirectReportsFailure(error.message));
  }
}

function* removeTeamMember(action: {
  payload: { employee_id: string; manager_id: string };
}): Generator<any, void, any> {
  try {
    const { employee_id, manager_id } = action.payload;
    yield call(makeCall, {
      method: "POST",
      route: apiRoutes.assignManagers.removeMember,
      body: { employee_id },
      isSecureRoute: true,
    });

    // Refresh the direct reports list
    yield put(managerListActions.fetchDirectReportsRequest(manager_id));
    ToastService.success("Team member removed successfully");
    // Also refresh the manager list total/team size if needed, but for now just success
    yield put(managerListActions.removeTeamMemberSuccess(employee_id));
  } catch (error: any) {
    yield put(managerListActions.removeTeamMemberFailure(error.message));
  }
}

export function* managerListSaga() {
  yield takeLatest(
    [managerListActions.fetchManagersRequest, managerListActions.setPage],
    fetchManagers,
  );
  yield takeLatest(
    managerListActions.fetchDirectReportsRequest,
    fetchDirectReports,
  );
  yield takeLatest(
    managerListActions.removeTeamMemberRequest,
    removeTeamMember,
  );
  yield debounce(300, managerListActions.setFilters, fetchManagers);
}
