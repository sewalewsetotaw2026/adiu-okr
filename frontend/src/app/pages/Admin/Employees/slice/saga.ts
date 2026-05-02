import { call, put, takeLatest, all, select } from "redux-saga/effects";
import { employeesActions } from ".";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { selectEmployeesState } from "./selectors";
import { EmployeesState } from "./types";
import ToastService from "../../../../../utils/ToastService";
import { formatIsoDate } from "../../../../utils/dayjs-format";

const EXPORT_FIELD_MAPPING: Record<string, string> = {
  // Personal
  EMPLOYEE_ID: "id",
  FULL_NAME: "full_name",
  GENDER: "gender",
  DATE_OF_BIRTH: "date_of_birth",
  TIN_NUMBER: "tin_number",
  PENSION_NUMBER: "pension_number",
  PLACE_OF_WORK: "place_of_work",
  CREATED_AT: "created_at",

  // Employment
  DEPARTMENT: "employment.department.name",
  JOB_TITLE: "employment.jobTitle.title",
  EMPLOYMENT_TYPE: "employment.employment_type",
  GROSS_SALARY: "employment.gross_salary",
  BASIC_SALARY: "employment.basic_salary",
  START_DATE: "employment.start_date",
  MANAGER: "employment.manager.full_name",

  // Contact
  PHONE_NUMBERS: "primary_phone",
  ADDRESSES: "primary_email",
  EMERGENCY_CONTACTS: "emergency_contacts_summary",

  // Summaries
  EXPERIENCE_HISTORY: "experience_summary",
  EDUCATION_HISTORY: "education_summary",
  ALLOWANCES_LIST: "allowance_summary",
  COST_SHARING_INFO: "cost_sharing_summary",
};
const mapLeanEmployee = (e: any) => {
  const emp = e.employments?.[0] || {};
  return {
    ...e,
    email: e.email || e.appUsers?.[0]?.email || "-",
    onboarding_status:
      e.onboarding_status || e.appUsers?.[0]?.onboarding_status,
    profile_picture_url:
      e.profilePicture ||
      e.profile_picture ||
      e.profile_picture_url ||
      e.appUsers?.[0]?.profile_picture,
    role: e.role || e.appUsers?.[0]?.role?.name || "-",
    phone: e.phone || e.phones?.[0]?.phone_number || "-",
    department:
      e.department?.name ||
      (typeof e.department === "string" ? e.department : null) ||
      emp.department?.name ||
      "Unassigned",
    job_title: e.job_title || emp.jobTitle?.title || emp.job_title || "-",
    job_level: e.job_level || emp.jobTitle?.level || "-",
    start_date: e.start_date || emp.start_date || "-",
    probation_end_date: e.probation_end_date || emp.probation_end_date || null,
    employment_type: e.employment_type || emp.employment_type || "-",
  };
};

export function* fetchEmployeeTabCounts(): Generator<any, void, any> {
  try {
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.employeeTabCounts,
      isSecureRoute: true,
    });
    if (response?.data?.data) {
      yield put(
        employeesActions.fetchEmployeeTabCountsSuccess(response.data.data),
      );
    }
  } catch (error: any) {
    yield put(
      employeesActions.fetchEmployeeTabCountsFailure(
        error.message || "Failed to fetch counts",
      ),
    );
  }
}

export function* fetchAllEmployees(
  action: ReturnType<typeof employeesActions.fetchAllEmployeesRequest>,
): Generator<any, void, any> {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      is_active,
      gender,
      department,
      job_title,
      job_level,
      sort_by,
      search,
      cost_sharing_status,
      probation_status,
      refresh,
    } = action.payload || {};

    // Check Cache (Skip if refresh is requested)
    const state: EmployeesState = yield select(selectEmployeesState);
    const targetTab = state.activeTab;
    const cachedPage = state[targetTab].pages[page];

    if (!refresh && cachedPage && cachedPage.length > 0) {
      // If we have cached data, use it immediately
      // Total count should also be in state, but let's grab it from pagination or just use what we have
      const total = state[targetTab].pagination.total;

      yield put(
        employeesActions.fetchAllEmployeesSuccess({
          employees: cachedPage,
          total: total, // Use existing total
          page,
          limit,
        }),
      );
      return;
    }

    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (status) query.set("onboarding_status", status);
    if (is_active !== undefined) query.set("is_active", String(is_active));
    if (gender) query.set("gender", gender);
    if (department) query.set("department", department);
    if (job_title) query.set("job_title", job_title);
    if (job_level) query.set("job_level", job_level);
    if (cost_sharing_status)
      query.set("cost_sharing_status", cost_sharing_status);
    if (probation_status) query.set("probation_status", probation_status);

    const normalizedSearch =
      typeof search === "string" ? search.trim() : search;
    if (normalizedSearch) query.set("search", normalizedSearch);

    // Sorting logic
    if (sort_by === "newest") query.set("sort_by", "newest");
    if (sort_by === "oldest") query.set("sort_by", "oldest");
    if (sort_by === "name_asc") query.set("sort_by", "name_asc");
    if (sort_by === "name_desc") query.set("sort_by", "name_desc");

    // Fetch employees
    const employeesRes: any = yield call(makeCall, {
      method: "GET",
      route: `${apiRoutes.employees}?${query.toString()}`,
      isSecureRoute: true,
    });

    const rawEmployees = employeesRes?.data?.data?.employees || [];
    const employees = rawEmployees.map(mapLeanEmployee);

    // Extract total count logic
    // Backend returns total in response.data.data.pagination.total
    const total =
      employeesRes?.data?.data?.pagination?.total || employees.length;

    yield put(
      employeesActions.fetchAllEmployeesSuccess({
        employees,
        total,
        page,
        limit,
      }),
    );
  } catch (error: any) {
    yield put(
      employeesActions.fetchAllEmployeesFailure(
        error.message || "Failed to fetch employees",
      ),
    );
  }
}

export function* fetchEmployee(
  action: ReturnType<typeof employeesActions.fetchEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const id = action.payload;
    console.log("[Saga] fetchEmployeeRequest received ID:", id); // Debug log

    if (id && id.startsWith("mock-")) {
      yield new Promise((resolve) => setTimeout(resolve, 500));
      let mockData;

      switch (id) {
        case "mock-1":
          mockData = {
            id: "mock-1",
            full_name: "Abebe Bikila",
            email: "abebe@kacha.com",
            job_title: "Chief Technology Officer",
            department: "Engineering",
            profile_picture_url: null,
            phones: [{ phone_number: "+251911223344" }],
          };
          break;
        case "mock-2":
          mockData = {
            id: "mock-2",
            full_name: "Derartu Tulu",
            email: "derartu@kacha.com",
            job_title: "Head of Marketing",
            department: "Marketing",
            profile_picture_url: null,
            phones: [{ phone_number: "+251911556677" }],
          };
          break;
        case "mock-3":
          mockData = {
            id: "mock-3",
            full_name: "Haile Gebrselassie",
            email: "haile@kacha.com",
            job_title: "Operations Manager",
            department: "Operations",
            profile_picture_url: null,
            phones: [{ phone_number: "+251911889900" }],
          };
          break;
        default:
          mockData = {
            id: id,
            full_name: "Mock User",
            email: "mock@kacha.com",
            job_title: "Mock Title",
            department: "Mock Dept",
            profile_picture_url: null,
          };
      }
      yield put(
        employeesActions.fetchEmployeeSuccess(mapLeanEmployee(mockData)),
      );
      return;
    }

    const response: any = yield call(makeCall, {
      method: "GET",
      route: `${apiRoutes.employees}/${id}`,
      isSecureRoute: true,
    });

    if (response?.data?.data?.employee) {
      const mappedEmployee = mapLeanEmployee(response.data.data.employee);
      yield put(employeesActions.fetchEmployeeSuccess(mappedEmployee as any));
    } else {
      throw new Error("Invalid response format: employee data missing");
    }
  } catch (error: any) {
    yield put(
      employeesActions.fetchEmployeeFailure(
        error.message || "Failed to fetch employee details",
      ),
    );
  }
}

export function* approveEmployee(
  action: ReturnType<typeof employeesActions.approveEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const id = action.payload;
    yield call(makeCall, {
      method: "POST",
      route: apiRoutes.approveOnboarding(id),
      isSecureRoute: true,
    });
    yield put(employeesActions.approveEmployeeSuccess());
    yield put(employeesActions.fetchEmployeeRequest(id)); // Refresh details
  } catch (error: any) {
    yield put(employeesActions.approveEmployeeFailure(error.message));
  }
}
export function* updateEmployee(
  action: ReturnType<typeof employeesActions.updateEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const { id, ...data } = action.payload;
    const response: any = yield call(makeCall, {
      method: "PUT",
      route: `${apiRoutes.employees}/${id}`,
      body: data,
      isSecureRoute: true,
    });
    yield put(employeesActions.updateEmployeeSuccess(response.data.data));
  } catch (error: any) {
    yield put(employeesActions.updateEmployeeFailure(error.message));
  }
}

export function* deleteEmployee(
  action: ReturnType<typeof employeesActions.deleteEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const payload = action.payload;
    const id = typeof payload === "string" ? payload : payload.id;
    const hardDelete =
      typeof payload === "object" ? payload.hard_delete : false;

    let params = "";
    if (hardDelete) params = "?hard_delete=true";

    yield call(makeCall, {
      method: "DELETE",
      route: `${apiRoutes.employees}/${id}${params}`,
      isSecureRoute: true,
    });
    yield put(employeesActions.deleteEmployeeSuccess());
  } catch (error: any) {
    yield put(employeesActions.deleteEmployeeFailure(error.message));
  }
}

export function* activateEmployee(
  action: ReturnType<typeof employeesActions.activateEmployeeRequest>,
): Generator<any, void, any> {
  try {
    yield call(makeCall, {
      method: "PATCH",
      route: apiRoutes.activate(action.payload),
      isSecureRoute: true,
    });
    yield put(employeesActions.activateEmployeeSuccess());
  } catch (error: any) {
    yield put(employeesActions.activateEmployeeFailure(error.message));
  }
}

export function* assignManager(
  action: ReturnType<typeof employeesActions.assignManagerRequest>,
): Generator<any, void, any> {
  try {
    const { managerId, employeeIds } = action.payload;

    // We update each employee's manager.
    // Ideally the backend would have a bulk endpoint, but we'll loop for now as per plan.
    yield all(
      employeeIds.map((id) =>
        call(makeCall, {
          method: "PATCH",
          route: apiRoutes.updateEmployment(id),
          body: { manager_id: managerId },
          isSecureRoute: true,
        }),
      ),
    );

    yield put(employeesActions.assignManagerSuccess());
  } catch (error: any) {
    yield put(
      employeesActions.assignManagerFailure(
        error.message || "Failed to assign manager",
      ),
    );
  }
}

// ... imports

export function* exportEmployees(
  action: ReturnType<typeof employeesActions.exportEmployeesRequest>,
): Generator<any, void, any> {
  try {
    const { modules, format, filters } = action.payload;

    console.log("[Export Saga] Starting export with format:", format);

    // Transform UI modules/columns to Backend fields
    const fields: string[] = [];
    if (modules) {
      Object.values(modules).forEach((cols: any) => {
        if (Array.isArray(cols)) {
          cols.forEach((colKey: string) => {
            const backendKey = EXPORT_FIELD_MAPPING[colKey];
            if (backendKey) {
              fields.push(backendKey);
            }
          });
        }
      });
    }

    // Default fields if empty (fallback)
    if (fields.length === 0) {
      fields.push("id", "full_name");
    }

    // Transform format
    const apiFormat = format === "excel" ? "xlsx" : format;

    console.log("[Export Saga] API format:", apiFormat);
    console.log("[Export Saga] Fields:", fields);

    // Transform Filters
    const apiFilters: any = {};
    if (filters) {
      const f = filters as any;
      // Backend expects _id
      if (f.department) apiFilters.department_id = f.department;
      if (f.job_title) apiFilters.job_title_id = f.job_title;
      if (f.job_level) apiFilters.job_title_id = f.job_level; // Map level to title_id as backend handles OR
      if (f.status) apiFilters.status = f.status;
      if (f.gender) apiFilters.gender = f.gender;
      if (f.search) apiFilters.search = f.search;
      if (f.cost_sharing_status)
        apiFilters.cost_sharing_status = f.cost_sharing_status;
      if (f.is_active !== undefined) apiFilters.is_active = f.is_active;
    }

    // Handle scope (selected IDs)
    if (
      action.payload.scope?.employee_ids &&
      action.payload.scope.employee_ids.length > 0
    ) {
      apiFilters.ids = action.payload.scope.employee_ids;
    } else if (action.payload.scope?.employee_id) {
      // Single export support
      apiFilters.ids = [action.payload.scope.employee_id];
    }

    console.log("[Export Saga] Making API call to:", apiRoutes.exportEmployees);
    console.log("[Export Saga] Request body:", {
      format: apiFormat,
      fields,
      filters: apiFilters,
    });

    // We expect a blob response
    const response: any = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.exportEmployees,
      body: {
        format: apiFormat,
        fields,
        filters: apiFilters,
      },
      isSecureRoute: true,
      responseType: "blob", // Important!
    });

    console.log("[Export Saga] Response received:", response);
    console.log(
      "[Export Saga] Response data type:",
      response.data?.constructor?.name,
    );
    console.log("[Export Saga] Response data size:", response.data?.size);

    // Create a Blob from the PDF Stream
    const file = new Blob([response.data], {
      type:
        format === "pdf"
          ? "application/pdf"
          : format === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv",
    });

    console.log("[Export Saga] Created blob with size:", file.size);

    // Build a URL from the file
    const fileURL = URL.createObjectURL(file);

    // Create a temp <a> tag to download file
    const link = document.createElement("a");
    link.href = fileURL;

    // Generate filename based on date and format
    const date = formatIsoDate(new Date());
    link.download = `employees_export_${date}.${
      format === "excel" ? "xlsx" : format
    }`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("[Export Saga] Export successful");
    ToastService.success("Export completed successfully");
    yield put(employeesActions.exportEmployeesSuccess());
  } catch (error: any) {
    console.error("[Export Saga] Export failed:", error);
    console.error("[Export Saga] Error details:", {
      message: error.message,
      response: error.response,
      data: error.data,
      stack: error.stack,
    });

    let message = "Failed to export employees";

    // The makeCall function now properly handles blob errors
    if (error.message) {
      message = error.message;
    } else if (error.error) {
      message = error.error;
    } else if (typeof error === "string") {
      message = error;
    }

    console.log("[Export Saga] Final error message:", message);
    ToastService.error(message);
    yield put(employeesActions.exportEmployeesFailure(message));
  }
}

export function* employeesSaga(): Generator<any, void, any> {
  yield takeLatest(
    employeesActions.fetchAllEmployeesRequest.type,
    fetchAllEmployees,
  );
  yield takeLatest(employeesActions.fetchEmployeeRequest.type, fetchEmployee);
  yield takeLatest(
    employeesActions.approveEmployeeRequest.type,
    approveEmployee,
  );
  yield takeLatest(employeesActions.updateEmployeeRequest.type, updateEmployee);
  yield takeLatest(employeesActions.deleteEmployeeRequest.type, deleteEmployee);
  yield takeLatest(employeesActions.assignManagerRequest.type, assignManager);
  yield takeLatest(
    employeesActions.activateEmployeeRequest.type,
    activateEmployee,
  );
  yield takeLatest(
    employeesActions.exportEmployeesRequest.type,
    exportEmployees,
  );
  yield takeLatest(
    employeesActions.fetchEmployeeTabCountsRequest.type,
    fetchEmployeeTabCounts,
  );
}
