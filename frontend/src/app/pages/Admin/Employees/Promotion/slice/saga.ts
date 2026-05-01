import { call, put, takeLatest } from "redux-saga/effects";
import { promotionActions } from ".";
import { celebrationActions } from "../../../../../slice/celebrationSlice";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";

const enrichEmployeeDetail = (employee: any) => {
  const emp = employee.employments?.[0] || {};
  return {
    ...employee,
    email: employee.email || employee.appUsers?.[0]?.email || "-",
    onboarding_status:
      employee.onboarding_status || employee.appUsers?.[0]?.onboarding_status,
    profilePicture:
      employee.profilePicture ||
      employee.profile_picture ||
      employee.appUsers?.[0]?.profile_picture,
    department:
      employee.department?.name ||
      (typeof employee.department === "string" ? employee.department : null) ||
      emp.department?.name ||
      "Unassigned",
    job_title:
      employee.job_title ||
      employee.jobTitle ||
      emp.jobTitle?.title ||
      emp.job_title ||
      "-",
    job_level: employee.job_level || emp.jobTitle?.level || "-",
    start_date: employee.start_date || emp.start_date || "-",
    employment_type: employee.employment_type || emp.employment_type || "-",
  };
};

export function* fetchEmployee(
  action: ReturnType<typeof promotionActions.fetchEmployeeRequest>,
): Generator<any, any, any> {
  try {
    const id = action.payload;
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.employeeDetail(id),
      isSecureRoute: true,
    });

    if (response?.data?.data?.employee) {
      const employee = response.data.data.employee;
      const enrichedEmployee = enrichEmployeeDetail(employee);
      yield put(promotionActions.fetchEmployeeSuccess(enrichedEmployee));
    } else {
      throw new Error("Invalid response format: employee data missing");
    }
  } catch (error: any) {
    yield put(
      promotionActions.fetchEmployeeFailure(
        error.message || "Failed to fetch employee details",
      ),
    );
  }
}

export function* promoteEmployee(
  action: ReturnType<typeof promotionActions.promoteRequest>,
): Generator<any, any, any> {
  try {
    console.log("Promoting employee... v2 check:", apiRoutes.promote);
    const { documentFile, ...payload } = action.payload;

    if (documentFile) {
      try {
        const { uploadFile } = yield import("../../../../../services/fileUploadService");
        const url = yield call(uploadFile, documentFile);
        payload.document_urls = [url];
      } catch (e: any) {
        throw new Error(`Failed to upload document: ${e.message}`);
      }
    }

    let route = apiRoutes.promote;
    if (payload.event_type === "DEMOTION") {
      route = apiRoutes.careerDemote;
    } else if (payload.event_type === "TRANSFER") {
      route = apiRoutes.careerTransfer;
    }

    const response: any = yield call(makeCall, {
      method: "POST",
      route: route,
      body: payload,
      isSecureRoute: true,
    });

    if (response?.data?.status === "success") {
      yield put(promotionActions.promoteSuccess());
      yield put(celebrationActions.fetchCelebrationsRequest());
    } else {
      throw new Error(response?.data?.message || "Failed to promote employee");
    }
  } catch (error: any) {
    yield put(promotionActions.promoteFailure(error.message));
  }
}

export function* promotionSaga() {
  yield takeLatest(promotionActions.fetchEmployeeRequest.type, fetchEmployee);
  yield takeLatest(promotionActions.promoteRequest.type, promoteEmployee);
}
