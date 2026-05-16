/**
 * OKR Import / Export API client.
 *
 * Endpoints:
 *   POST /api/v1/okr/import/quarterly
 *   POST /api/v1/okr/import/monthly
 *   POST /api/v1/okr/import/weekly
 *   GET  /api/v1/okr/export/quarterly?cycle_id=
 *   GET  /api/v1/okr/export/monthly?cycle_id=&month_number=&employee_kr_id=
 *   GET  /api/v1/okr/export/weekly?employee_month_plan_id=&week_number=
 *   GET  /api/v1/okr/template/quarterly
 *   GET  /api/v1/okr/template/monthly
 *   GET  /api/v1/okr/template/weekly
 */

import makeCall from "../API";

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;
const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
const OKR = `${BASE_URL}/okr`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportReport {
  total_rows: number;
  succeeded: number;
  failed: number;
  errors: ImportError[];
  created: Record<string, number>;
}

type ImportType = "quarterly" | "monthly" | "weekly";
type ImportMode = "strict" | "partial";

// ─── Import ──────────────────────────────────────────────────────────────────

export async function importOKR(
  type: ImportType,
  file: File,
  mode: ImportMode = "strict",
): Promise<ImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const res = await makeCall({
    route: `${OKR}/import/${type}`,
    method: "POST",
    body: formData,
  });

  const body = res?.data;
  return body?.data ?? body;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportQuarterlyOKR(cycleId: number): Promise<void> {
  const res = await makeCall({
    route: `${OKR}/export/quarterly`,
    method: "GET",
    query: { cycle_id: cycleId },
    responseType: "blob",
  });
  downloadBlob(res.data, getFilenameFromResponse(res, "quarterly_okr.xlsx"));
}

export async function exportMonthlyPlans(params: {
  cycleId: number;
  monthNumber?: number;
  employeeKrId?: number;
}): Promise<void> {
  const query: Record<string, number> = { cycle_id: params.cycleId };
  if (params.monthNumber) query.month_number = params.monthNumber;
  if (params.employeeKrId) query.employee_kr_id = params.employeeKrId;

  const res = await makeCall({
    route: `${OKR}/export/monthly`,
    method: "GET",
    query,
    responseType: "blob",
  });
  downloadBlob(res.data, getFilenameFromResponse(res, "monthly_plans.xlsx"));
}

export async function exportWeeklyPlans(params: {
  employeeMonthPlanId: number;
  weekNumber?: number;
}): Promise<void> {
  const query: Record<string, number> = {
    employee_month_plan_id: params.employeeMonthPlanId,
  };
  if (params.weekNumber) query.week_number = params.weekNumber;

  const res = await makeCall({
    route: `${OKR}/export/weekly`,
    method: "GET",
    query,
    responseType: "blob",
  });
  downloadBlob(res.data, getFilenameFromResponse(res, "weekly_plans.xlsx"));
}

// ─── Template Download ───────────────────────────────────────────────────────

export async function downloadTemplate(type: ImportType): Promise<void> {
  const res = await makeCall({
    route: `${OKR}/template/${type}`,
    method: "GET",
    responseType: "blob",
  });
  downloadBlob(res.data, `${type}_plan_template.xlsx`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFilenameFromResponse(res: any, fallback: string): string {
  const disposition = res.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match?.[1] || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
