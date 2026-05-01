import { call, put, takeLatest } from "redux-saga/effects";
import { leaveActions } from "./index";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";
import {
  LeaveType,
  LeaveBalance,
  LeaveApplication,
  LeaveRecall,
  LeaveStatsResponse,
  ReliefOfficerOption,
  Pagination,
  PublicHoliday,
  LeaveSettings,
  OnLeaveDetailedEmployee,
  EnhancedLeaveBalance,
  AccrualSettingsInfo,
  CashOutRequest,
  CashOutCalculation,
  ExpiringBalance,
} from "./types";

// ==========================================
// Leave Types Sagas
// ==========================================
function* getLeaveTypesSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.leaveTypes,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const leaveTypes: LeaveType[] =
      (Array.isArray(raw?.leaveTypes) && raw.leaveTypes) ||
      (Array.isArray(raw?.data?.leaveTypes) && raw.data.leaveTypes) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getLeaveTypesSuccess(leaveTypes));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave types.";
    yield put(leaveActions.getLeaveTypesFailure(errorMessage));
  }
}

function* getApplicableLeaveTypesSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.applicableLeaveTypes,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const leaveTypes: LeaveType[] =
      (Array.isArray(raw?.leaveTypes) && raw.leaveTypes) ||
      (Array.isArray(raw?.data?.leaveTypes) && raw.data.leaveTypes) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getApplicableLeaveTypesSuccess(leaveTypes));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch applicable leave types.";
    yield put(leaveActions.getApplicableLeaveTypesFailure(errorMessage));
  }
}

function* createLeaveTypeSaga(
  action: ReturnType<typeof leaveActions.createLeaveTypeRequest>
) {
  try {
    const response: { data: { leaveType: LeaveType } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.leaveTypes,
      body: action.payload,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.createLeaveTypeSuccess(
        response.data.leaveType || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to create leave type.";
    yield put(leaveActions.createLeaveTypeFailure(errorMessage));
  }
}

function* updateLeaveTypeSaga(
  action: ReturnType<typeof leaveActions.updateLeaveTypeRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { leaveType: LeaveType } } = yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.leaveTypeById(id),
      body: data,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.updateLeaveTypeSuccess(
        response.data.leaveType || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to update leave type.";
    yield put(leaveActions.updateLeaveTypeFailure(errorMessage));
  }
}

function* deleteLeaveTypeSaga(
  action: ReturnType<typeof leaveActions.deleteLeaveTypeRequest>
) {
  try {
    yield call(makeCall, {
      method: "DELETE",
      route: apiRoutes.leaveTypeById(action.payload),
      isSecureRoute: true,
    });
    yield put(leaveActions.deleteLeaveTypeSuccess(action.payload));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to delete leave type.";
    yield put(leaveActions.deleteLeaveTypeFailure(errorMessage));
  }
}

function* seedDefaultLeaveTypesSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.seedDefaultLeaveTypes,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const leaveTypes: LeaveType[] =
      (Array.isArray(raw?.leaveTypes) && raw.leaveTypes) ||
      (Array.isArray(raw?.data?.leaveTypes) && raw.data.leaveTypes) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.seedDefaultLeaveTypesSuccess(leaveTypes));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to seed default leave types.";
    yield put(leaveActions.seedDefaultLeaveTypesFailure(errorMessage));
  }
}

// ==========================================
// Leave Balance Sagas
// ==========================================
function* getMyLeaveBalanceSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.myLeaveBalance,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const balances: LeaveBalance[] =
      (Array.isArray(raw?.balances) && raw.balances) ||
      (Array.isArray(raw?.data?.balances) && raw.data.balances) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getMyLeaveBalanceSuccess(balances));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave balance.";
    yield put(leaveActions.getMyLeaveBalanceFailure(errorMessage));
  }
}

function* getEmployeeLeaveBalanceSaga(
  action: ReturnType<typeof leaveActions.getEmployeeLeaveBalanceRequest>
) {
  try {
    const { employeeId, year } = action.payload;
    let route = apiRoutes.leaveBalanceByEmployee(employeeId);
    if (year) {
      route += `?year=${year}`;
    }

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const balances: LeaveBalance[] =
      (Array.isArray(raw?.balances) && raw.balances) ||
      (Array.isArray(raw?.data?.balances) && raw.data.balances) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getEmployeeLeaveBalanceSuccess(balances));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch employee leave balance.";
    yield put(leaveActions.getEmployeeLeaveBalanceFailure(errorMessage));
  }
}

function* getAllLeaveBalancesSaga(
  action: ReturnType<typeof leaveActions.getAllLeaveBalancesRequest>
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
      ? `${apiRoutes.leaveBalances}?${queryParams.toString()}`
      : apiRoutes.leaveBalances;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;

    // Supports multiple backend response shapes.
    // New shape: { status, message, data: { fiscal_year, employees: [{..., leaveBalances: [...] }], pagination } }
    let balances: LeaveBalance[] = [];

    const employees = raw?.data?.employees ?? raw?.employees;
    const fiscalYear = raw?.data?.fiscal_year ?? raw?.fiscal_year;

    if (Array.isArray(employees)) {
      balances = employees.flatMap((emp: any) => {
        const employeeRef = {
          id: emp?.id,
          full_name: emp?.full_name,
          gender: emp?.gender,
          employments: Array.isArray(emp?.employments) ? emp.employments : [],
        } as any;

        const leaveBalances = Array.isArray(emp?.leaveBalances)
          ? emp.leaveBalances
          : Array.isArray(emp?.leave_balances)
          ? emp.leave_balances
          : [];

        return leaveBalances.map((lb: any) => ({
          ...lb,
          employee_id: lb?.employee_id ?? emp?.id,
          fiscal_year: lb?.fiscal_year ?? fiscalYear,
          total_entitlement: Number(lb?.total_entitlement ?? 0),
          used_days: Number(lb?.used_days ?? 0),
          pending_days: Number(lb?.pending_days ?? 0),
          remaining_days: Number(lb?.remaining_days ?? 0),
          employee: employeeRef,
          leaveType: lb?.leaveType ?? lb?.leave_type,
        }));
      });
    } else {
      // Older shapes that return a flat list of balances
      balances =
        (Array.isArray(raw?.balances) && raw.balances) ||
        (Array.isArray(raw?.data?.balances) && raw.data.balances) ||
        (Array.isArray(raw?.data) && raw.data) ||
        (Array.isArray(raw) && raw) ||
        [];
    }

    const pagination: Pagination | undefined =
      raw?.data?.pagination ?? raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getAllLeaveBalancesSuccess({
        balances,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch all leave balances.";
    yield put(leaveActions.getAllLeaveBalancesFailure(errorMessage));
  }
}

function* allocateLeaveBalanceSaga(
  action: ReturnType<typeof leaveActions.allocateLeaveBalanceRequest>
) {
  try {
    const { employee_id, ...data } = action.payload;
    const response: { data: { balance: LeaveBalance } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.allocateLeaveBalance(employee_id),
      body: data,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.allocateLeaveBalanceSuccess(
        response.data.balance || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to allocate leave balance.";
    yield put(leaveActions.allocateLeaveBalanceFailure(errorMessage));
  }
}

function* bulkAllocateLeaveBalanceSaga(
  action: ReturnType<typeof leaveActions.bulkAllocateLeaveBalanceRequest>
) {
  try {
    const response: {
      data: { total_employees: number; created: number; updated: number };
    } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.bulkAllocateLeaveBalance,
      body: action.payload,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.bulkAllocateLeaveBalanceSuccess({
        created: response.data.created,
        updated: response.data.updated,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to bulk allocate leave.";
    yield put(leaveActions.bulkAllocateLeaveBalanceFailure(errorMessage));
  }
}

function* adjustLeaveBalanceSaga(
  action: ReturnType<typeof leaveActions.adjustLeaveBalanceRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { balance: LeaveBalance } } = yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.adjustLeaveBalance(String(id)),
      body: data,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.adjustLeaveBalanceSuccess(
        response.data.balance || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to adjust leave balance.";
    yield put(leaveActions.adjustLeaveBalanceFailure(errorMessage));
  }
}

function* carryOverLeaveSaga(
  action: ReturnType<typeof leaveActions.carryOverLeaveRequest>
) {
  try {
    const response: { data: { message: string } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.carryOverLeave,
      body: action.payload,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.carryOverLeaveSuccess(
        response.data.message || "Leave carried over successfully"
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to carry over leave.";
    yield put(leaveActions.carryOverLeaveFailure(errorMessage));
  }
}

const mapEmployeeRef = (emp: any) => {
  if (!emp) return emp;
  return {
    ...emp,
    photo: emp.photo || emp.profile_picture_url || emp.profile_picture,
  };
};

const mapLeaveApplication = (app: any) => ({
  ...app,
  employee: mapEmployeeRef(app.employee),
  reliefOfficer: mapEmployeeRef(app.reliefOfficer),
});

// ==========================================
// Leave Applications Sagas - Employee
// ==========================================
function* getMyLeavesSaga(
  action: ReturnType<typeof leaveActions.getMyLeavesRequest>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "ALL") {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.myLeaveApplications}?${queryParams.toString()}`
      : apiRoutes.myLeaveApplications;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const rawApplications: any[] =
      (Array.isArray(raw?.applications) && raw.applications) ||
      (Array.isArray(raw?.data?.applications) && raw.data.applications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    const applications = rawApplications.map(mapLeaveApplication);
    const pagination: Pagination | undefined =
      raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getMyLeavesSuccess({
        applications,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave applications.";
    yield put(leaveActions.getMyLeavesFailure(errorMessage));
  }
}

function* getCancellableLeavesSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.cancellableLeaves,
      isSecureRoute: true,
    });
    const raw = response?.data;
    const applications: LeaveApplication[] =
      (Array.isArray(raw?.applications) && raw.applications) ||
      (Array.isArray(raw?.data?.applications) && raw.data.applications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getCancellableLeavesSuccess(applications));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch cancellable leaves.";
    yield put(leaveActions.getCancellableLeavesFailure(errorMessage));
  }
}

function* createLeaveApplicationSaga(
  action: ReturnType<typeof leaveActions.createLeaveApplicationRequest>
) {
  try {
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.leaveApplications,
        body: action.payload,
        isSecureRoute: true,
      }
    );

    yield put(
      leaveActions.createLeaveApplicationSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to submit leave application.";
    yield put(leaveActions.createLeaveApplicationFailure(errorMessage));
  }
}

function* cancelLeaveApplicationSaga(
  action: ReturnType<typeof leaveActions.cancelLeaveApplicationRequest>
) {
  try {
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.cancelLeaveApplication(action.payload),
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.cancelLeaveApplicationSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to cancel leave application.";
    yield put(leaveActions.cancelLeaveApplicationFailure(errorMessage));
  }
}

function* requestLeaveCancellationSaga(
  action: ReturnType<typeof leaveActions.requestLeaveCancellationRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.requestLeaveCancellation(id),
        body: data,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.requestLeaveCancellationSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to request leave cancellation.";
    yield put(leaveActions.requestLeaveCancellationFailure(errorMessage));
  }
}

function* approveLeaveCancellationSaga(
  action: ReturnType<typeof leaveActions.approveLeaveCancellationRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.approveLeaveCancellation(id),
        body: data,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.approveLeaveCancellationSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to approve leave cancellation.";
    yield put(leaveActions.approveLeaveCancellationFailure(errorMessage));
  }
}

function* rejectLeaveCancellationSaga(
  action: ReturnType<typeof leaveActions.rejectLeaveCancellationRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.rejectLeaveCancellation(id),
        body: data,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.rejectLeaveCancellationSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to reject leave cancellation.";
    yield put(leaveActions.rejectLeaveCancellationFailure(errorMessage));
  }
}

// ==========================================
// Leave Applications Sagas - Admin/Manager
// ==========================================
function* getAllLeavesSaga(
  action: ReturnType<typeof leaveActions.getAllLeavesRequest>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "ALL") {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.leaveApplications}?${queryParams.toString()}`
      : apiRoutes.leaveApplications;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const rawApplications: any[] =
      (Array.isArray(raw?.applications) && raw.applications) ||
      (Array.isArray(raw?.data?.applications) && raw.data.applications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    const applications = rawApplications.map(mapLeaveApplication);
    const pagination: Pagination | undefined =
      raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getAllLeavesSuccess({
        applications,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave applications.";
    yield put(leaveActions.getAllLeavesFailure(errorMessage));
  }
}

function* getPendingLeavesSaga(
  action: ReturnType<typeof leaveActions.getPendingLeavesRequest>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "ALL") {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.pendingLeaveApplications}?${queryParams.toString()}`
      : apiRoutes.pendingLeaveApplications;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const rawApplications: any[] =
      (Array.isArray(raw?.applications) && raw.applications) ||
      (Array.isArray(raw?.data?.applications) && raw.data.applications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    const applications = rawApplications.map(mapLeaveApplication);
    const pagination: Pagination | undefined =
      raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getPendingLeavesSuccess({
        applications,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch pending leave applications.";
    yield put(leaveActions.getPendingLeavesFailure(errorMessage));
  }
}

function* getPendingCancellationsSaga(
  action: ReturnType<typeof leaveActions.getPendingCancellationsRequest>
) {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "ALL") {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.pendingLeaveCancellations}?${queryParams.toString()}`
      : apiRoutes.pendingLeaveCancellations;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const rawApplications: any[] =
      (Array.isArray(raw?.applications) && raw.applications) ||
      (Array.isArray(raw?.data?.applications) && raw.data.applications) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    const applications = rawApplications.map(mapLeaveApplication);
    const pagination: Pagination | undefined =
      raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getPendingCancellationsSuccess({
        applications,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch pending leave cancellations.";
    yield put(leaveActions.getPendingCancellationsFailure(errorMessage));
  }
}

function* getLeaveApplicationByIdSaga(
  action: ReturnType<typeof leaveActions.getLeaveApplicationByIdRequest>
) {
  try {
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "GET",
        route: apiRoutes.leaveApplicationById(action.payload),
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.getLeaveApplicationByIdSuccess(
        mapLeaveApplication(response.data.application || (response.data as any))
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave application.";
    yield put(leaveActions.getLeaveApplicationByIdFailure(errorMessage));
  }
}

function* approveLeaveSaga(
  action: ReturnType<typeof leaveActions.approveLeaveRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.approveLeaveApplication(id),
        body: data,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.approveLeaveSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to approve leave application.";
    yield put(leaveActions.approveLeaveFailure(errorMessage));
  }
}

function* rejectLeaveSaga(
  action: ReturnType<typeof leaveActions.rejectLeaveRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { application: LeaveApplication } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.rejectLeaveApplication(id),
        body: data,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.rejectLeaveSuccess(
        response.data.application || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to reject leave application.";
    yield put(leaveActions.rejectLeaveFailure(errorMessage));
  }
}

// ==========================================
// On Leave Employees Saga
// ==========================================
function* getOnLeaveEmployeesSaga(
  action: ReturnType<typeof leaveActions.getOnLeaveEmployeesRequest>
): Generator<any, void, any> {
  try {
    const params = action.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "ALL") {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.onLeaveEmployees}?${queryParams.toString()}`
      : apiRoutes.onLeaveEmployees;

    const response: any = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    let employees: OnLeaveDetailedEmployee[] = [];
    let count = 0;
    let page = 1;
    let totalPages = 1;

    // Robust parsing for new pagination structure
    if (response?.data?.data && Array.isArray(response.data.data.employees)) {
         // New structure from managerController: { employees: [], total, page, totalPages }
         const data = response.data.data;
         employees = data.employees.map((emp: any) => ({
             ...emp,
             id: emp.application_id || emp.id // Ensure mapping if needed
         }));
         count = data.total;
         page = data.page;
         totalPages = data.totalPages;
    } else if (Array.isArray(response?.data?.employees)) {
      // Fallback for direct array or unexpected structure
      employees = response.data.employees;
      count = response.data.count || employees.length;
    } else if (Array.isArray(response?.data)) {
        employees = response.data;
        count = employees.length;
    }

    yield put(
      leaveActions.getOnLeaveEmployeesSuccess({
        count,
        employees: employees as OnLeaveDetailedEmployee[],
        total: count,
        page,
        totalPages
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch employees on leave.";
    yield put(leaveActions.getOnLeaveEmployeesFailure(errorMessage));
  }
}

// ==========================================
// Leave Recalls Sagas
// ==========================================
function* getMyRecallNotificationsSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.myLeaveRecalls,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const recalls: LeaveRecall[] =
      (Array.isArray(raw?.recalls) && raw.recalls) ||
      (Array.isArray(raw?.data?.recalls) && raw.data.recalls) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getMyRecallNotificationsSuccess(recalls));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch recall notifications.";
    yield put(leaveActions.getMyRecallNotificationsFailure(errorMessage));
  }
}

function* getAllRecallsSaga(
  action: ReturnType<typeof leaveActions.getAllRecallsRequest>
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
      ? `${apiRoutes.leaveRecalls}?${queryParams.toString()}`
      : apiRoutes.leaveRecalls;

    const response: {
      data: { recalls: LeaveRecall[]; pagination?: Pagination };
    } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    yield put(
      leaveActions.getAllRecallsSuccess({
        recalls: response.data.recalls || (response.data as any),
        pagination: response.data.pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch recalls.";
    yield put(leaveActions.getAllRecallsFailure(errorMessage));
  }
}

function* getActiveLeavesForRecallSaga() {
  try {
    const response: { data: { applications: LeaveApplication[] } } = yield call(
      makeCall,
      {
        method: "GET",
        route: apiRoutes.activeLeavesForRecall,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.getActiveLeavesForRecallSuccess(
        response.data.applications || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch active leaves.";
    yield put(leaveActions.getActiveLeavesForRecallFailure(errorMessage));
  }
}

function* createRecallSaga(
  action: ReturnType<typeof leaveActions.createRecallRequest>
) {
  try {
    const response: { data: { recall: LeaveRecall } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.leaveRecalls,
      body: action.payload,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.createRecallSuccess(
        response.data.recall || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to create recall request.";
    yield put(leaveActions.createRecallFailure(errorMessage));
  }
}

function* respondToRecallSaga(
  action: ReturnType<typeof leaveActions.respondToRecallRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: { recall: LeaveRecall } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.respondToRecall(String(id)),
      body: data,
      isSecureRoute: true,
    });
    yield put(
      leaveActions.respondToRecallSuccess(
        response.data.recall || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to respond to recall.";
    yield put(leaveActions.respondToRecallFailure(errorMessage));
  }
}

function* cancelRecallSaga(
  action: ReturnType<typeof leaveActions.cancelRecallRequest>
) {
  try {
    yield call(makeCall, {
      method: "DELETE",
      route: apiRoutes.leaveRecallById(action.payload),
      isSecureRoute: true,
    });
    yield put(leaveActions.cancelRecallSuccess(action.payload));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to cancel recall.";
    yield put(leaveActions.cancelRecallFailure(errorMessage));
  }
}

// ==========================================
// Relief Officers Saga
// ==========================================
function* getReliefOfficersSaga() {
  try {
    const response: { data: { officers: ReliefOfficerOption[] } } = yield call(
      makeCall,
      {
        method: "GET",
        route: apiRoutes.leaveReliefOfficers,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.getReliefOfficersSuccess(
        response.data.officers || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch relief officers.";
    yield put(leaveActions.getReliefOfficersFailure(errorMessage));
  }
}

// ==========================================
// Leave Statistics Saga
// ==========================================
function* getLeaveStatsSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.leaveStats,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const candidate: any = raw?.stats ?? raw?.data?.stats ?? raw?.data ?? raw;

    const stats: LeaveStatsResponse = {
      totalEmployees: Number(candidate?.totalEmployees ?? 0) || 0,
      onLeaveToday: Number(candidate?.onLeaveToday ?? 0) || 0,
      pendingApplications: Number(candidate?.pendingApplications ?? 0) || 0,
      approvedThisMonth: Number(candidate?.approvedThisMonth ?? 0) || 0,
      rejectedThisMonth: Number(candidate?.rejectedThisMonth ?? 0) || 0,
      byLeaveType: Array.isArray(candidate?.byLeaveType)
        ? candidate.byLeaveType
        : undefined,
    };
    yield put(leaveActions.getLeaveStatsSuccess(stats));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave statistics.";
    yield put(leaveActions.getLeaveStatsFailure(errorMessage));
  }
}

function* getTabCountsSaga(
  action: ReturnType<typeof leaveActions.getTabCountsRequest>
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
      ? `${apiRoutes.tabCounts}?${queryParams.toString()}`
      : apiRoutes.tabCounts;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const tabCounts: TabCounts = raw?.data ?? raw;

    yield put(leaveActions.getTabCountsSuccess(tabCounts));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch tab counts.";
    yield put(leaveActions.getTabCountsFailure(errorMessage));
  }
}

// ==========================================
// Public Holidays Sagas
// ==========================================
function* getPublicHolidaysSaga(
  action: ReturnType<typeof leaveActions.getPublicHolidaysRequest>
) {
  try {
    const year = action.payload?.year;
    const route = year
      ? `${apiRoutes.publicHolidays}?year=${year}`
      : apiRoutes.publicHolidays;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const holidays: PublicHoliday[] =
      (Array.isArray(raw?.holidays) && raw.holidays) ||
      (Array.isArray(raw?.data?.holidays) && raw.data.holidays) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getPublicHolidaysSuccess(holidays));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch public holidays.";
    yield put(leaveActions.getPublicHolidaysFailure(errorMessage));
  }
}

function* getUpcomingHolidaysSaga(
  action: ReturnType<typeof leaveActions.getUpcomingHolidaysRequest>
) {
  try {
    const limit = action.payload?.limit || 5;
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: `${apiRoutes.upcomingHolidays}?limit=${limit}`,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const holidays: PublicHoliday[] =
      (Array.isArray(raw?.holidays) && raw.holidays) ||
      (Array.isArray(raw?.data?.holidays) && raw.data.holidays) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.getUpcomingHolidaysSuccess(holidays));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch upcoming holidays.";
    yield put(leaveActions.getUpcomingHolidaysFailure(errorMessage));
  }
}

function* createPublicHolidaySaga(
  action: ReturnType<typeof leaveActions.createPublicHolidayRequest>
) {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.publicHolidays,
      body: action.payload,
      isSecureRoute: true,
    });

    // Handle various API response formats
    const raw = response?.data;
    const holiday: PublicHoliday =
      raw?.holiday || raw?.data?.holiday || raw?.data || raw;

    yield put(leaveActions.createPublicHolidaySuccess(holiday));

    // Re-fetch holidays to ensure state is in sync
    yield put(leaveActions.getPublicHolidaysRequest(undefined));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to create public holiday.";
    yield put(leaveActions.createPublicHolidayFailure(errorMessage));
  }
}

function* updatePublicHolidaySaga(
  action: ReturnType<typeof leaveActions.updatePublicHolidayRequest>
) {
  try {
    const { id, ...data } = action.payload;
    const response: { data: any } = yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.publicHolidayById(id),
      body: data,
      isSecureRoute: true,
    });

    // Handle various API response formats
    const raw = response?.data;
    const holiday: PublicHoliday =
      raw?.holiday || raw?.data?.holiday || raw?.data || raw;

    yield put(leaveActions.updatePublicHolidaySuccess(holiday));

    // Re-fetch holidays to ensure state is in sync with backend
    yield put(leaveActions.getPublicHolidaysRequest(undefined));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to update public holiday.";
    yield put(leaveActions.updatePublicHolidayFailure(errorMessage));
  }
}

function* deletePublicHolidaySaga(
  action: ReturnType<typeof leaveActions.deletePublicHolidayRequest>
) {
  try {
    yield call(makeCall, {
      method: "DELETE",
      route: apiRoutes.publicHolidayById(action.payload),
      isSecureRoute: true,
    });
    yield put(leaveActions.deletePublicHolidaySuccess(action.payload));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to delete public holiday.";
    yield put(leaveActions.deletePublicHolidayFailure(errorMessage));
  }
}

function* seedDefaultHolidaysSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.seedDefaultHolidays,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const holidays: PublicHoliday[] =
      (Array.isArray(raw?.holidays) && raw.holidays) ||
      (Array.isArray(raw?.data?.holidays) && raw.data.holidays) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    yield put(leaveActions.seedDefaultHolidaysSuccess(holidays));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to seed default holidays.";
    yield put(leaveActions.seedDefaultHolidaysFailure(errorMessage));
  }
}

// ==========================================
// Leave Settings Sagas
// ==========================================
function* getLeaveSettingsSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.leaveSettings,
      isSecureRoute: true,
    });

    // Handle various API response formats
    const raw = response?.data;
    const settings: LeaveSettings =
      raw?.settings || raw?.data?.settings || raw?.data || raw;

    yield put(leaveActions.getLeaveSettingsSuccess(settings));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch leave settings.";
    yield put(leaveActions.getLeaveSettingsFailure(errorMessage));
  }
}

function* updateLeaveSettingsSaga(
  action: ReturnType<typeof leaveActions.updateLeaveSettingsRequest>
) {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "PUT",
      route: apiRoutes.leaveSettings,
      body: action.payload,
      isSecureRoute: true,
    });

    // Handle various API response formats
    const raw = response?.data;
    const settings: LeaveSettings =
      raw?.settings || raw?.data?.settings || raw?.data || raw;

    yield put(leaveActions.updateLeaveSettingsSuccess(settings));

    // Re-fetch to ensure state is in sync
    yield put(leaveActions.getLeaveSettingsRequest());
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to update leave settings.";
    yield put(leaveActions.updateLeaveSettingsFailure(errorMessage));
  }
}

// ==========================================
// Enhanced Leave Balance Sagas
// ==========================================
function* getEnhancedBalanceSaga() {
  try {
    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.myLeaveBalance,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const fiscal_year: number = raw?.fiscal_year ?? new Date().getFullYear();
    const accrual_settings: AccrualSettingsInfo = raw?.accrual_settings ?? null;
    const balances: EnhancedLeaveBalance[] =
      (Array.isArray(raw?.balances) && raw.balances) ||
      (Array.isArray(raw?.data?.balances) && raw.data.balances) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];

    yield put(
      leaveActions.getEnhancedBalanceSuccess({
        fiscal_year,
        accrual_settings,
        balances,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch enhanced leave balance.";
    yield put(leaveActions.getEnhancedBalanceFailure(errorMessage));
  }
}

// ==========================================
// Expiring Balances Sagas
// ==========================================
function* getExpiringBalancesSaga(
  action: ReturnType<typeof leaveActions.getExpiringBalancesRequest>
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
      ? `${apiRoutes.expiringLeaveBalances}?${queryParams.toString()}`
      : apiRoutes.expiringLeaveBalances;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const balances: ExpiringBalance[] =
      (Array.isArray(raw?.balances) && raw.balances) ||
      (Array.isArray(raw?.data?.balances) && raw.data.balances) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];

    yield put(leaveActions.getExpiringBalancesSuccess(balances));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch expiring balances.";
    yield put(leaveActions.getExpiringBalancesFailure(errorMessage));
  }
}

function* notifyExpiringBalancesSaga(
  action: ReturnType<typeof leaveActions.notifyExpiringBalancesRequest>
) {
  try {
    const response: { data: { notified: number } } = yield call(makeCall, {
      method: "POST",
      route: apiRoutes.notifyExpiringBalances,
      body: action?.payload ?? {},
      isSecureRoute: true,
    });
    yield put(
      leaveActions.notifyExpiringBalancesSuccess({
        notified: response.data.notified,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to send expiry notifications.";
    yield put(leaveActions.notifyExpiringBalancesFailure(errorMessage));
  }
}

// ==========================================
// Leave Cash-Out Sagas
// ==========================================
function* calculateCashOutSaga() {
  try {
    const response: { data: CashOutCalculation } = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.calculateCashOut,
      isSecureRoute: true,
    });
    yield put(leaveActions.calculateCashOutSuccess(response.data));
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to calculate cash-out.";
    yield put(leaveActions.calculateCashOutFailure(errorMessage));
  }
}

function* requestCashOutSaga(
  action: ReturnType<typeof leaveActions.requestCashOutRequest>
) {
  try {
    const response: { data: { cashOut: CashOutRequest } } = yield call(
      makeCall,
      {
        method: "POST",
        route: apiRoutes.requestCashOut,
        body: action.payload,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.requestCashOutSuccess(
        response.data.cashOut || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to submit cash-out request.";
    yield put(leaveActions.requestCashOutFailure(errorMessage));
  }
}

function* getMyCashOutRequestsSaga() {
  try {
    const response: { data: { requests: CashOutRequest[] } } = yield call(
      makeCall,
      {
        method: "GET",
        route: apiRoutes.myCashOutRequests,
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.getMyCashOutRequestsSuccess(
        response.data.requests || (response.data as any) || []
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch cash-out requests.";
    yield put(leaveActions.getMyCashOutRequestsFailure(errorMessage));
  }
}

function* getAllCashOutRequestsSaga(
  action: ReturnType<typeof leaveActions.getAllCashOutRequestsRequest>
) {
  try {
    const params = action?.payload || {};
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const route = queryParams.toString()
      ? `${apiRoutes.allCashOutRequests}?${queryParams.toString()}`
      : apiRoutes.allCashOutRequests;

    const response: { data: any } = yield call(makeCall, {
      method: "GET",
      route,
      isSecureRoute: true,
    });

    const raw = response?.data;
    const requests: CashOutRequest[] =
      (Array.isArray(raw?.requests) && raw.requests) ||
      (Array.isArray(raw?.data?.requests) && raw.data.requests) ||
      (Array.isArray(raw?.data) && raw.data) ||
      (Array.isArray(raw) && raw) ||
      [];
    const pagination: Pagination | undefined =
      raw?.pagination ?? raw?.data?.pagination;

    yield put(
      leaveActions.getAllCashOutRequestsSuccess({
        requests,
        pagination,
      })
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to fetch cash-out requests.";
    yield put(leaveActions.getAllCashOutRequestsFailure(errorMessage));
  }
}

function* approveCashOutSaga(
  action: ReturnType<typeof leaveActions.approveCashOutRequest>
) {
  try {
    const response: { data: { cashOut: CashOutRequest } } = yield call(
      makeCall,
      {
        method: "PUT",
        route: apiRoutes.approveCashOut(String(action.payload)),
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.approveCashOutSuccess(
        response.data.cashOut || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to approve cash-out request.";
    yield put(leaveActions.approveCashOutFailure(errorMessage));
  }
}

function* rejectCashOutSaga(
  action: ReturnType<typeof leaveActions.rejectCashOutRequest>
) {
  try {
    const { id, rejection_reason } = action.payload;
    const response: { data: { cashOut: CashOutRequest } } = yield call(
      makeCall,
      {
        method: "PUT",
        route: apiRoutes.rejectCashOut(String(id)),
        body: { rejection_reason },
        isSecureRoute: true,
      }
    );
    yield put(
      leaveActions.rejectCashOutSuccess(
        response.data.cashOut || (response.data as any)
      )
    );
  } catch (error: any) {
    const errorMessage =
      error?.message ||
      error?.response?.data?.message ||
      "Failed to reject cash-out request.";
    yield put(leaveActions.rejectCashOutFailure(errorMessage));
  }
}

// ==========================================
// Root Saga
// ===========================================
export function* leaveSaga() {
  // Leave Types
  yield takeLatest(leaveActions.getLeaveTypesRequest.type, getLeaveTypesSaga);
  yield takeLatest(
    leaveActions.getApplicableLeaveTypesRequest.type,
    getApplicableLeaveTypesSaga
  );
  yield takeLatest(
    leaveActions.createLeaveTypeRequest.type,
    createLeaveTypeSaga
  );
  yield takeLatest(
    leaveActions.updateLeaveTypeRequest.type,
    updateLeaveTypeSaga
  );
  yield takeLatest(
    leaveActions.deleteLeaveTypeRequest.type,
    deleteLeaveTypeSaga
  );
  yield takeLatest(
    leaveActions.seedDefaultLeaveTypesRequest.type,
    seedDefaultLeaveTypesSaga
  );

  // Leave Balance
  yield takeLatest(
    leaveActions.getMyLeaveBalanceRequest.type,
    getMyLeaveBalanceSaga
  );
  yield takeLatest(
    leaveActions.getEmployeeLeaveBalanceRequest.type,
    getEmployeeLeaveBalanceSaga
  );
  yield takeLatest(
    leaveActions.getAllLeaveBalancesRequest.type,
    getAllLeaveBalancesSaga
  );
  yield takeLatest(
    leaveActions.allocateLeaveBalanceRequest.type,
    allocateLeaveBalanceSaga
  );
  yield takeLatest(
    leaveActions.bulkAllocateLeaveBalanceRequest.type,
    bulkAllocateLeaveBalanceSaga
  );
  yield takeLatest(
    leaveActions.adjustLeaveBalanceRequest.type,
    adjustLeaveBalanceSaga
  );
  yield takeLatest(leaveActions.carryOverLeaveRequest.type, carryOverLeaveSaga);

  // Leave Applications - Employee
  yield takeLatest(leaveActions.getMyLeavesRequest.type, getMyLeavesSaga);
  yield takeLatest(
    leaveActions.getCancellableLeavesRequest.type,
    getCancellableLeavesSaga
  );
  yield takeLatest(
    leaveActions.createLeaveApplicationRequest.type,
    createLeaveApplicationSaga
  );
  yield takeLatest(
    leaveActions.cancelLeaveApplicationRequest.type,
    cancelLeaveApplicationSaga
  );
  yield takeLatest(
    leaveActions.requestLeaveCancellationRequest.type,
    requestLeaveCancellationSaga
  );
  yield takeLatest(
    leaveActions.approveLeaveCancellationRequest.type,
    approveLeaveCancellationSaga
  );
  yield takeLatest(
    leaveActions.rejectLeaveCancellationRequest.type,
    rejectLeaveCancellationSaga
  );

  // Leave Applications - Admin/Manager
  yield takeLatest(leaveActions.getAllLeavesRequest.type, getAllLeavesSaga);
  yield takeLatest(
    leaveActions.getPendingLeavesRequest.type,
    getPendingLeavesSaga
  );
  yield takeLatest(
    leaveActions.getPendingCancellationsRequest.type,
    getPendingCancellationsSaga
  );
  yield takeLatest(
    leaveActions.getLeaveApplicationByIdRequest.type,
    getLeaveApplicationByIdSaga
  );
  yield takeLatest(leaveActions.approveLeaveRequest.type, approveLeaveSaga);
  yield takeLatest(leaveActions.rejectLeaveRequest.type, rejectLeaveSaga);

  // On Leave Employees
  yield takeLatest(
    leaveActions.getOnLeaveEmployeesRequest.type,
    getOnLeaveEmployeesSaga
  );

  // Leave Recalls
  yield takeLatest(
    leaveActions.getMyRecallNotificationsRequest.type,
    getMyRecallNotificationsSaga
  );
  yield takeLatest(leaveActions.getAllRecallsRequest.type, getAllRecallsSaga);
  yield takeLatest(
    leaveActions.getActiveLeavesForRecallRequest.type,
    getActiveLeavesForRecallSaga
  );
  yield takeLatest(leaveActions.createRecallRequest.type, createRecallSaga);
  yield takeLatest(
    leaveActions.respondToRecallRequest.type,
    respondToRecallSaga
  );
  yield takeLatest(leaveActions.cancelRecallRequest.type, cancelRecallSaga);

  // Relief Officers
  yield takeLatest(
    leaveActions.getReliefOfficersRequest.type,
    getReliefOfficersSaga
  );

  // Leave Statistics
  yield takeLatest(leaveActions.getLeaveStatsRequest.type, getLeaveStatsSaga);
  yield takeLatest(leaveActions.getTabCountsRequest.type, getTabCountsSaga);

  // Public Holidays
  yield takeLatest(
    leaveActions.getPublicHolidaysRequest.type,
    getPublicHolidaysSaga
  );
  yield takeLatest(
    leaveActions.getUpcomingHolidaysRequest.type,
    getUpcomingHolidaysSaga
  );
  yield takeLatest(
    leaveActions.createPublicHolidayRequest.type,
    createPublicHolidaySaga
  );
  yield takeLatest(
    leaveActions.updatePublicHolidayRequest.type,
    updatePublicHolidaySaga
  );
  yield takeLatest(
    leaveActions.deletePublicHolidayRequest.type,
    deletePublicHolidaySaga
  );
  yield takeLatest(
    leaveActions.seedDefaultHolidaysRequest.type,
    seedDefaultHolidaysSaga
  );

  // Leave Settings
  yield takeLatest(
    leaveActions.getLeaveSettingsRequest.type,
    getLeaveSettingsSaga
  );
  yield takeLatest(
    leaveActions.updateLeaveSettingsRequest.type,
    updateLeaveSettingsSaga
  );

  // Enhanced Balance
  yield takeLatest(
    leaveActions.getEnhancedBalanceRequest.type,
    getEnhancedBalanceSaga
  );

  // Expiring Balances
  yield takeLatest(
    leaveActions.getExpiringBalancesRequest.type,
    getExpiringBalancesSaga
  );
  yield takeLatest(
    leaveActions.notifyExpiringBalancesRequest.type,
    notifyExpiringBalancesSaga
  );

  // Cash-Out
  yield takeLatest(
    leaveActions.calculateCashOutRequest.type,
    calculateCashOutSaga
  );
  yield takeLatest(leaveActions.requestCashOutRequest.type, requestCashOutSaga);
  yield takeLatest(
    leaveActions.getMyCashOutRequestsRequest.type,
    getMyCashOutRequestsSaga
  );
  yield takeLatest(
    leaveActions.getAllCashOutRequestsRequest.type,
    getAllCashOutRequestsSaga
  );
  yield takeLatest(leaveActions.approveCashOutRequest.type, approveCashOutSaga);
  yield takeLatest(leaveActions.rejectCashOutRequest.type, rejectCashOutSaga);
}
