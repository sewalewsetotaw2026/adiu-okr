import ExcelJS from "exceljs";
import { parse as csvParse } from "csv-parse/sync";
import { prisma } from "src/app";
import { adoptAssignedKR, createEmployeeKR } from "src/services/okrEmployeeService";
import { createMonthlyPlan, createWeeklyPlan, submitMonthlyPeriod, submitWeeklyPeriod } from "src/services/okrPlanningService";
import { assignContributor } from "src/services/okrContributorService";
import { submitForApproval } from "src/services/okrApprovalService";
import type { OkrExecutionMode } from "@prisma/client";

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

type ImportMode = "strict" | "partial";

// ─── File Parsing ────────────────────────────────────────────────────────────

function parseBoolean(value: unknown, defaultVal = true): boolean {
  if (value === undefined || value === null || value === "") return defaultVal;
  const str = String(value).toLowerCase().trim();
  if (["true", "1", "yes"].includes(str)) return true;
  if (["false", "0", "no"].includes(str)) return false;
  return defaultVal;
}

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

function parseOptionalFloat(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function parseFileToRows(
  buffer: Buffer,
  filename: string,
): Promise<Record<string, any>[]> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "csv") {
    const content = buffer.toString("utf-8");
    return csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }

  // Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || "").trim().toLowerCase();
  });

  const rows: Record<string, any>[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const obj: Record<string, any> = {};
    let hasData = false;
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (key) {
        obj[key] = cell.value;
        if (cell.value !== null && cell.value !== undefined && cell.value !== "") {
          hasData = true;
        }
      }
    });
    if (hasData) rows.push(obj);
  }
  return rows;
}

// ─── Quarterly OKR Import ────────────────────────────────────────────────────

export async function importQuarterlyOKR(
  buffer: Buffer,
  filename: string,
  companyId: number,
  actorEmployeeId: string,
  actorUserId: string,
  mode: ImportMode = "strict",
): Promise<ImportReport> {
  const rows = await parseFileToRows(buffer, filename);
  const report: ImportReport = {
    total_rows: rows.length,
    succeeded: 0,
    failed: 0,
    errors: [],
    created: { objectives: 0, key_results: 0, submissions: 0, contributors: 0 },
  };

  if (rows.length === 0) {
    report.errors.push({ row: 0, message: "File contains no data rows." });
    report.failed = 1;
    return report;
  }
  if (rows.length > 500) {
    report.errors.push({ row: 0, message: "Maximum 500 rows allowed per import." });
    report.failed = rows.length;
    report.total_rows = rows.length;
    return report;
  }

  // Group rows by (parent_kr_type + parent_kr_id) so rows with the same parent share one objective
  const grouped = new Map<string, { rows: { idx: number; data: Record<string, any> }[] }>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = `${String(r.parent_kr_type || "").toUpperCase()}_${r.parent_kr_id}`;
    if (!grouped.has(key)) grouped.set(key, { rows: [] });
    grouped.get(key)!.rows.push({ idx: i + 2, data: r }); // idx is 1-based Excel row
  }

  // Validate cycle once
  const firstRow = rows[0];
  const cycleId = parseOptionalInt(firstRow.cycle_id);
  if (!cycleId) {
    report.errors.push({ row: 2, field: "cycle_id", message: "cycle_id is required." });
    report.failed = rows.length;
    return report;
  }

  const cycle = await prisma.okrCycle.findFirst({
    where: { id: cycleId, company_id: companyId, status: "OPEN" },
  });
  if (!cycle) {
    report.errors.push({
      row: 2,
      field: "cycle_id",
      message: `No OPEN OkrCycle found with id=${cycleId} for this company.`,
    });
    report.failed = rows.length;
    return report;
  }

  // Verify employee
  const employment = await prisma.employment.findFirst({
    where: { employee_id: actorEmployeeId, company_id: companyId, is_active: true },
  });
  if (!employment) {
    report.errors.push({ row: 0, field: "employee_id", message: "No active employment record found." });
    report.failed = rows.length;
    return report;
  }

  const processGroup = async (groupKey: string, group: { rows: { idx: number; data: Record<string, any> }[] }) => {
    const sample = group.rows[0].data;
    const parentKrType = String(sample.parent_kr_type || "").toUpperCase();
    const parentKrId = parseOptionalInt(sample.parent_kr_id);
    const executionMode = String(sample.execution_mode || "CUSTOMIZED").toUpperCase() as OkrExecutionMode;

    if (!["COMPANY", "EMPLOYEE"].includes(parentKrType)) {
      group.rows.forEach((r) => {
        report.errors.push({ row: r.idx, field: "parent_kr_type", message: "parent_kr_type must be COMPANY or EMPLOYEE." });
        report.failed++;
      });
      return;
    }
    if (!parentKrId) {
      group.rows.forEach((r) => {
        report.errors.push({ row: r.idx, field: "parent_kr_id", message: "parent_kr_id is required." });
        report.failed++;
      });
      return;
    }

    // Validate parent KR exists
    if (parentKrType === "COMPANY") {
      const companyKr = await prisma.companyKeyResult.findFirst({
        where: { id: parentKrId, company_id: companyId },
        include: { objective: { select: { cycle_id: true } } },
      });
      if (!companyKr) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "parent_kr_id", message: `CompanyKeyResult id=${parentKrId} not found.` });
          report.failed++;
        });
        return;
      }
      if (companyKr.objective.cycle_id !== cycleId) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "parent_kr_id", message: `CompanyKeyResult id=${parentKrId} belongs to a different cycle.` });
          report.failed++;
        });
        return;
      }
    } else {
      const empKr = await prisma.employeeKeyResult.findFirst({
        where: { id: parentKrId, company_id: companyId },
        include: { employeeObjective: { select: { cycle_id: true } } },
      });
      if (!empKr) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "parent_kr_id", message: `EmployeeKeyResult id=${parentKrId} not found.` });
          report.failed++;
        });
        return;
      }
      if (empKr.employeeObjective.cycle_id !== cycleId) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "parent_kr_id", message: `EmployeeKeyResult id=${parentKrId} belongs to a different cycle.` });
          report.failed++;
        });
        return;
      }
    }

    // Find or create contributor
    let contributor: any = await prisma.krContributor.findFirst({
      where: {
        company_id: companyId,
        user_id: actorEmployeeId,
        ...(parentKrType === "COMPANY"
          ? { company_kr_id: parentKrId }
          : { employee_kr_id: parentKrId }),
      },
    });

    if (!contributor) {
      try {
        const result = await assignContributor({
          companyId,
          ...(parentKrType === "COMPANY"
            ? { companyKrId: parentKrId }
            : { employeeKrId: parentKrId }),
          userId: actorEmployeeId,
          roleType: "EMPLOYEE",
          assignedBy: actorUserId,
        });
        // assignContributor returns an object containing the contributor
        contributor = (result as any).contributor || result;
        report.created.contributors++;
      } catch (err: any) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "parent_kr_id", message: `Failed to create contributor: ${err.message}` });
          report.failed++;
        });
        return;
      }
    }

    // Adopt to create objective
    let objective: any;
    try {
      const objTitle = executionMode === "CUSTOMIZED"
        ? String(sample.objective_title || "").trim()
        : undefined;

      if (executionMode === "CUSTOMIZED" && !objTitle) {
        group.rows.forEach((r) => {
          report.errors.push({ row: r.idx, field: "objective_title", message: "objective_title is required for CUSTOMIZED execution_mode." });
          report.failed++;
        });
        return;
      }

      const adoptResult = await adoptAssignedKR({
        companyId,
        contributorId: contributor.id,
        ...(parentKrType === "COMPANY"
          ? { companyKrId: parentKrId }
          : { employeeKrId: parentKrId }),
        cycleId,
        executionMode: executionMode === "DIRECT_ADOPTION" ? "DIRECT_ADOPTION" : "CUSTOMIZED",
        title: objTitle,
        description: sample.objective_description?.toString()?.trim() || undefined,
        assignmentUserId: actorEmployeeId,
        actorId: actorUserId,
      });
      objective = adoptResult.objective;
      if (adoptResult.created) report.created.objectives++;
    } catch (err: any) {
      group.rows.forEach((r) => {
        report.errors.push({ row: r.idx, field: "objective", message: `Failed to create objective: ${err.message}` });
        report.failed++;
      });
      return;
    }

    // Create KRs for each row in this group
    for (const { idx, data } of group.rows) {
      try {
        const krTitle = String(data.key_result_title || "").trim();
        if (!krTitle) {
          report.errors.push({ row: idx, field: "key_result_title", message: "key_result_title is required." });
          report.failed++;
          if (mode === "strict") throw new Error("strict mode abort");
          continue;
        }

        const metricId = parseOptionalInt(data.metric_definition_id);
        if (!metricId) {
          report.errors.push({ row: idx, field: "metric_definition_id", message: "metric_definition_id is required." });
          report.failed++;
          if (mode === "strict") throw new Error("strict mode abort");
          continue;
        }

        const targetValue = parseOptionalFloat(data.target_value);
        if (targetValue === undefined) {
          report.errors.push({ row: idx, field: "target_value", message: "target_value is required." });
          report.failed++;
          if (mode === "strict") throw new Error("strict mode abort");
          continue;
        }

        await createEmployeeKR({
          companyId,
          employeeObjectiveId: objective.id,
          title: krTitle,
          description: data.key_result_description?.toString()?.trim(),
          metricDefinitionId: metricId,
          unitOfMeasure: data.unit_of_measure?.toString()?.trim(),
          targetValue,
          startValue: parseOptionalFloat(data.start_value) ?? 0,
          weightPercent: parseOptionalFloat(data.weight_percent),
          contributesToScore: parseBoolean(data.contributes_to_score, true),
          contributesToValue: parseBoolean(data.contributes_to_value, true),
          isMandatory: parseBoolean(data.is_mandatory, false),
          executionMode: executionMode === "DIRECT_ADOPTION" ? "DIRECT_ADOPTION" : "CUSTOMIZED",
          createdBy: actorUserId,
        });

        report.succeeded++;
        report.created.key_results++;
      } catch (err: any) {
        if (err.message === "strict mode abort") throw err;
        report.errors.push({ row: idx, field: "key_result", message: err.message });
        report.failed++;
        if (mode === "strict") throw new Error("strict mode abort");
      }
    }
  };

  if (mode === "strict") {
    try {
      for (const [key, group] of grouped) {
        await processGroup(key, group);
      }
    } catch (err: any) {
      if (err.message !== "strict mode abort") {
        report.errors.push({ row: 0, message: `Unexpected error: ${err.message}` });
      }
      // In strict mode, if any failure occurred, mark all as failed
      report.failed = report.total_rows;
      report.succeeded = 0;
      report.created = { objectives: 0, key_results: 0, submissions: 0, contributors: 0 };
      return report;
    }
  } else {
    for (const [key, group] of grouped) {
      await processGroup(key, group);
    }
  }

  // Submit for approval if any KRs were created
  if (report.created.key_results > 0) {
    try {
      await submitForApproval({
        companyId,
        cycleId: cycleId!,
        submitterId: actorEmployeeId,
        type: "QUARTERLY_PLANNING",
      });
      report.created.submissions = 1;
    } catch (err: any) {
      // Non-fatal: plans are created but submission failed
      report.errors.push({
        row: 0,
        field: "submission",
        message: `Plans created but auto-submission failed: ${err.message}`,
      });
    }
  }

  return report;
}

// ─── Monthly Plan Import ─────────────────────────────────────────────────────

export async function importMonthlyPlans(
  buffer: Buffer,
  filename: string,
  companyId: number,
  actorEmployeeId: string,
  actorUserId: string,
  mode: ImportMode = "strict",
): Promise<ImportReport> {
  const rows = await parseFileToRows(buffer, filename);
  const report: ImportReport = {
    total_rows: rows.length,
    succeeded: 0,
    failed: 0,
    errors: [],
    created: { monthly_plans: 0, submissions: 0 },
  };

  if (rows.length === 0) {
    report.errors.push({ row: 0, message: "File contains no data rows." });
    return report;
  }
  if (rows.length > 500) {
    report.errors.push({ row: 0, message: "Maximum 500 rows allowed per import." });
    report.failed = rows.length;
    return report;
  }

  const createdByMonth = new Map<number, number[]>(); // monthNumber -> planIds

  let cycleId: number | undefined;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const data = rows[i];

    try {
      // Validate employee_id
      const empId = String(data.employee_id || "").trim();
      if (empId && empId !== actorEmployeeId) {
        report.errors.push({ row: rowNum, field: "employee_id", message: "employee_id must match the authenticated user." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const krId = parseOptionalInt(data.employee_kr_id);
      if (!krId) {
        report.errors.push({ row: rowNum, field: "employee_kr_id", message: "employee_kr_id is required." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      cycleId = parseOptionalInt(data.cycle_id) || cycleId;
      if (!cycleId) {
        report.errors.push({ row: rowNum, field: "cycle_id", message: "cycle_id is required." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const monthNumber = parseOptionalInt(data.month_number);
      if (!monthNumber || monthNumber < 1 || monthNumber > 3) {
        report.errors.push({ row: rowNum, field: "month_number", message: "month_number must be 1, 2, or 3." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const title = String(data.title || "").trim();
      if (!title) {
        report.errors.push({ row: rowNum, field: "title", message: "title is required." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const adoptionMode = String(data.adoption_mode || "DECOMPOSED").toUpperCase() as "DIRECT" | "DECOMPOSED";
      const weightPct = parseOptionalFloat(data.weight_pct);

      if (adoptionMode === "DECOMPOSED" && (!weightPct || weightPct <= 0)) {
        report.errors.push({ row: rowNum, field: "weight_pct", message: "weight_pct is required for DECOMPOSED adoption_mode." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const plan = await createMonthlyPlan({
        krId,
        companyId,
        ownerId: actorEmployeeId,
        monthNumber,
        adoptionMode,
        weightPct,
        title,
        description: data.description?.toString()?.trim() || null,
        metric_definition_id: parseOptionalInt(data.metric_definition_id),
        start_value: parseOptionalFloat(data.start_value),
        target_value: parseOptionalFloat(data.target_value),
        contribute_to_score: parseBoolean(data.contribute_to_score, true),
        contribute_to_value: parseBoolean(data.contribute_to_value, true),
        aligned_manager_plan_id: parseOptionalInt(data.aligned_manager_plan_id),
      });

      report.succeeded++;
      report.created.monthly_plans++;

      if (!createdByMonth.has(monthNumber)) createdByMonth.set(monthNumber, []);
      createdByMonth.get(monthNumber)!.push(plan.id);
    } catch (err: any) {
      report.errors.push({ row: rowNum, message: err.message });
      report.failed++;
      if (mode === "strict") break;
    }
  }

  // If strict mode had errors, zero out
  if (mode === "strict" && report.failed > 0) {
    report.failed = report.total_rows;
    report.succeeded = 0;
    report.created = { monthly_plans: 0, submissions: 0 };
    return report;
  }

  // Submit each month period
  if (report.created.monthly_plans > 0 && cycleId) {
    for (const [monthNumber, planIds] of createdByMonth) {
      try {
        await submitMonthlyPeriod({
          ownerId: actorEmployeeId,
          companyId,
          cycleId,
          monthNumber,
          planIds,
        });
        report.created.submissions++;
      } catch (err: any) {
        report.errors.push({
          row: 0,
          field: "submission",
          message: `Month ${monthNumber} plans created but submission failed: ${err.message}`,
        });
      }
    }
  }

  return report;
}

// ─── Weekly Plan Import ──────────────────────────────────────────────────────

export async function importWeeklyPlans(
  buffer: Buffer,
  filename: string,
  companyId: number,
  actorEmployeeId: string,
  actorUserId: string,
  mode: ImportMode = "strict",
): Promise<ImportReport> {
  const rows = await parseFileToRows(buffer, filename);
  const report: ImportReport = {
    total_rows: rows.length,
    succeeded: 0,
    failed: 0,
    errors: [],
    created: { weekly_plans: 0, submissions: 0 },
  };

  if (rows.length === 0) {
    report.errors.push({ row: 0, message: "File contains no data rows." });
    return report;
  }
  if (rows.length > 500) {
    report.errors.push({ row: 0, message: "Maximum 500 rows allowed per import." });
    report.failed = rows.length;
    return report;
  }

  // Group by (monthly_plan_id, week_number) for batch submission
  const createdByGroup = new Map<string, { monthlyPlanId: number; weekNumber: number; planIds: number[] }>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const data = rows[i];

    try {
      const empId = String(data.employee_id || "").trim();
      if (empId && empId !== actorEmployeeId) {
        report.errors.push({ row: rowNum, field: "employee_id", message: "employee_id must match the authenticated user." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const monthlyPlanId = parseOptionalInt(data.employee_month_plan_id);
      if (!monthlyPlanId) {
        report.errors.push({ row: rowNum, field: "employee_month_plan_id", message: "employee_month_plan_id is required." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const weekNumber = parseOptionalInt(data.week_number);
      if (!weekNumber || weekNumber < 1 || weekNumber > 5) {
        report.errors.push({ row: rowNum, field: "week_number", message: "week_number must be 1–5." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const title = String(data.title || "").trim();
      if (!title) {
        report.errors.push({ row: rowNum, field: "title", message: "title is required." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const adoptionMode = String(data.adoption_mode || "DECOMPOSED").toUpperCase() as "DIRECT" | "DECOMPOSED";
      const weightPct = parseOptionalFloat(data.weight_pct);

      if (adoptionMode === "DECOMPOSED" && (!weightPct || weightPct <= 0)) {
        report.errors.push({ row: rowNum, field: "weight_pct", message: "weight_pct is required for DECOMPOSED adoption_mode." });
        report.failed++;
        if (mode === "strict") break;
        continue;
      }

      const plan = await createWeeklyPlan({
        monthlyPlanId,
        companyId,
        ownerId: actorEmployeeId,
        weekNumber,
        adoptionMode,
        weightPct,
        title,
        metric_definition_id: parseOptionalInt(data.metric_definition_id),
        start_value: parseOptionalFloat(data.start_value),
        target_value: parseOptionalFloat(data.target_value),
        contribute_to_score: parseBoolean(data.contribute_to_score, true),
        contribute_to_value: parseBoolean(data.contribute_to_value, true),
        aligned_manager_plan_id: parseOptionalInt(data.aligned_manager_plan_id),
      });

      report.succeeded++;
      report.created.weekly_plans++;

      const gKey = `${monthlyPlanId}_${weekNumber}`;
      if (!createdByGroup.has(gKey)) {
        createdByGroup.set(gKey, { monthlyPlanId, weekNumber, planIds: [] });
      }
      createdByGroup.get(gKey)!.planIds.push(plan.id);
    } catch (err: any) {
      report.errors.push({ row: rowNum, message: err.message });
      report.failed++;
      if (mode === "strict") break;
    }
  }

  if (mode === "strict" && report.failed > 0) {
    report.failed = report.total_rows;
    report.succeeded = 0;
    report.created = { weekly_plans: 0, submissions: 0 };
    return report;
  }

  // Submit each group
  if (report.created.weekly_plans > 0) {
    for (const [, group] of createdByGroup) {
      try {
        await submitWeeklyPeriod({
          ownerId: actorEmployeeId,
          companyId,
          monthlyPlanId: group.monthlyPlanId,
          weekNumber: group.weekNumber,
          planIds: group.planIds,
        });
        report.created.submissions++;
      } catch (err: any) {
        report.errors.push({
          row: 0,
          field: "submission",
          message: `Weekly plans created but submission failed: ${err.message}`,
        });
      }
    }
  }

  return report;
}


export async function importCompanyObjectives(
  buffer: Buffer,
  filename: string,
  companyId: number,
  userId: string,
  mode: ImportMode = "strict"
): Promise<ImportReport> {
  const rows = await parseFileToRows(buffer, filename);
  const report: ImportReport = { total_rows: rows.length, succeeded: 0, failed: 0, errors: [], created: { objectives: 0, key_results: 0 } };

  if (rows.length === 0) {
    report.errors.push({ row: 0, message: "File is empty or invalid format." });
    report.failed++;
    return report;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      if (!r.objective_title) throw new Error("Missing objective_title");
      if (!r.cycle_id) throw new Error("Missing cycle_id");

      let obj = await prisma.companyObjective.findFirst({
        where: { title: String(r.objective_title), cycle_id: Number(r.cycle_id), company_id: companyId }
      });

      if (!obj) {
        obj = await prisma.companyObjective.create({
          data: {
            title: String(r.objective_title),
            description: r.objective_description ? String(r.objective_description) : null,
            cycle_id: Number(r.cycle_id),
            company_id: companyId,
            status_code: "draft",
            created_by: userId
          }
        });
        report.created.objectives++;
      }

      if (r.key_result_title) {
        await prisma.companyKeyResult.create({
          data: {
            objective_id: obj.id,
            title: String(r.key_result_title),
            description: r.key_result_description ? String(r.key_result_description) : null,
            metric_definition_id: r.metric_definition_id ? Number(r.metric_definition_id) : 1,
            unit_of_measure: r.unit_of_measure ? String(r.unit_of_measure) : null,
            target_value: r.target_value ? Number(r.target_value) : 100,
            start_value: r.start_value ? Number(r.start_value) : 0,
            weight_percent: r.weight_percent ? Number(r.weight_percent) : 100,
            status_code: "draft",
            company_id: companyId,
            created_by: userId
          }
        });
        report.created.key_results++;
      }
      report.succeeded++;
    } catch (err: any) {
      report.failed++;
      report.errors.push({ row: rowNum, message: err.message });
      if (mode === "strict") throw new Error(`Row ${rowNum}: ${err.message}`);
    }
  }
  return report;
}
