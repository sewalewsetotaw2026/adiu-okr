import ExcelJS from "exceljs";
import { prisma } from "src/app";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dec(v: any): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 24;
}

// ─── Quarterly OKR Export ────────────────────────────────────────────────────

export async function exportQuarterlyOKR(
  companyId: number,
  employeeId: string,
  cycleId: number,
): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id: cycleId, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");

  const objectives = await prisma.employeeObjective.findMany({
    where: { company_id: companyId, user_id: employeeId, cycle_id: cycleId },
    include: {
      keyResults: {
        include: { metricDefinition: true },
      },
      parentCompanyKr: {
        select: {
          id: true,
          title: true,
          objective: { select: { title: true } },
        },
      },
      parentEmployeeKr: {
        select: {
          id: true,
          title: true,
          employeeObjective: {
            select: { user_id: true, title: true },
          },
        },
      },
      contributor: { select: { id: true } },
    },
    orderBy: { created_at: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  const sheet = wb.addWorksheet("Quarterly OKR");

  sheet.columns = [
    { header: "employee_id", key: "employee_id", width: 18 },
    { header: "cycle_id", key: "cycle_id", width: 12 },
    { header: "cycle_name", key: "cycle_name", width: 20 },
    { header: "quarter_label", key: "quarter_label", width: 16 },
    { header: "objective_id", key: "objective_id", width: 14 },
    { header: "objective_title", key: "objective_title", width: 40 },
    { header: "objective_description", key: "objective_description", width: 50 },
    { header: "objective_status", key: "objective_status", width: 18 },
    { header: "parent_kr_type", key: "parent_kr_type", width: 18 },
    { header: "parent_kr_id", key: "parent_kr_id", width: 15 },
    { header: "parent_kr_title", key: "parent_kr_title", width: 40 },
    { header: "execution_mode", key: "execution_mode", width: 20 },
    { header: "kr_id", key: "kr_id", width: 10 },
    { header: "key_result_title", key: "key_result_title", width: 40 },
    { header: "key_result_description", key: "key_result_description", width: 50 },
    { header: "kr_status", key: "kr_status", width: 18 },
    { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
    { header: "metric_name", key: "metric_name", width: 25 },
    { header: "unit_of_measure", key: "unit_of_measure", width: 18 },
    { header: "target_value", key: "target_value", width: 15 },
    { header: "start_value", key: "start_value", width: 15 },
    { header: "weight_percent", key: "weight_percent", width: 16 },
    { header: "contributes_to_score", key: "contributes_to_score", width: 22 },
    { header: "contributes_to_value", key: "contributes_to_value", width: 22 },
    { header: "is_mandatory", key: "is_mandatory", width: 14 },
    { header: "final_score", key: "final_score", width: 14 },
    { header: "final_value", key: "final_value", width: 14 },
    { header: "created_at", key: "created_at", width: 22 },
    { header: "submission_id", key: "submission_id", width: 15 },
  ];
  styleHeaderRow(sheet);

  for (const obj of objectives) {
    const parentKrType = obj.chosen_parent_kr_id ? "COMPANY" : obj.chosen_parent_employee_kr_id ? "EMPLOYEE" : "";
    const parentKr = obj.parentCompanyKr || obj.parentEmployeeKr;
    const parentKrId = obj.chosen_parent_kr_id || obj.chosen_parent_employee_kr_id || "";
    const parentKrTitle = parentKr?.title || "";

    for (const kr of obj.keyResults) {
      sheet.addRow({
        employee_id: employeeId,
        cycle_id: cycleId,
        cycle_name: cycle.name,
        quarter_label: cycle.quarter_label || "",
        objective_id: obj.id,
        objective_title: obj.title,
        objective_description: obj.description || "",
        objective_status: obj.status_code,
        parent_kr_type: parentKrType,
        parent_kr_id: parentKrId,
        parent_kr_title: parentKrTitle,
        execution_mode: kr.execution_mode,
        kr_id: kr.id,
        key_result_title: kr.title,
        key_result_description: kr.description || "",
        kr_status: kr.status_code,
        metric_definition_id: kr.metric_definition_id,
        metric_name: kr.metricDefinition?.name || "",
        unit_of_measure: kr.unit_of_measure || "",
        target_value: dec(kr.target_value),
        start_value: dec(kr.start_value),
        weight_percent: dec(kr.weight_percent),
        contributes_to_score: kr.contributes_to_objective_score,
        contributes_to_value: kr.contributes_to_objective_value,
        is_mandatory: kr.is_mandatory_for_completion,
        final_score: dec(kr.final_score),
        final_value: dec(kr.final_value),
        created_at: kr.created_at,
        submission_id: kr.submission_id || "",
      });
    }
  }

  const safeCycleName = cycle.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `quarterly_okr_${employeeId}_${safeCycleName}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename };
}

// ─── Monthly Plan Export ─────────────────────────────────────────────────────

export async function exportMonthlyPlans(
  companyId: number,
  employeeId: string,
  cycleId: number,
  monthNumber?: number,
  employeeKrId?: number,
): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id: cycleId, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");

  const where: any = {
    company_id: companyId,
    owner_id: employeeId,
    cycle_id: cycleId,
  };
  if (monthNumber) where.month_number = monthNumber;
  if (employeeKrId) where.employee_kr_id = employeeKrId;

  const plans = await prisma.employeeMonthPlan.findMany({
    where,
    include: {
      employeeKr: { select: { id: true, title: true } },
      metricDefinition: { select: { id: true, name: true } },
    },
    orderBy: [{ month_number: "asc" }, { created_at: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  const sheet = wb.addWorksheet("Monthly Plans");

  sheet.columns = [
    { header: "id", key: "id", width: 10 },
    { header: "employee_id", key: "employee_id", width: 18 },
    { header: "employee_kr_id", key: "employee_kr_id", width: 18 },
    { header: "employee_kr_title", key: "employee_kr_title", width: 40 },
    { header: "cycle_id", key: "cycle_id", width: 12 },
    { header: "cycle_name", key: "cycle_name", width: 20 },
    { header: "month_number", key: "month_number", width: 15 },
    { header: "title", key: "title", width: 40 },
    { header: "description", key: "description", width: 50 },
    { header: "adoption_mode", key: "adoption_mode", width: 18 },
    { header: "weight_pct", key: "weight_pct", width: 14 },
    { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
    { header: "metric_name", key: "metric_name", width: 25 },
    { header: "start_value", key: "start_value", width: 15 },
    { header: "target_value", key: "target_value", width: 15 },
    { header: "current_value", key: "current_value", width: 15 },
    { header: "progress_pct", key: "progress_pct", width: 14 },
    { header: "contribute_to_score", key: "contribute_to_score", width: 22 },
    { header: "contribute_to_value", key: "contribute_to_value", width: 22 },
    { header: "plan_status", key: "plan_status", width: 16 },
    { header: "aligned_manager_plan_id", key: "aligned_manager_plan_id", width: 26 },
    { header: "reviewer_id", key: "reviewer_id", width: 18 },
    { header: "rejection_note", key: "rejection_note", width: 40 },
    { header: "created_at", key: "created_at", width: 22 },
    { header: "submission_id", key: "submission_id", width: 15 },
  ];
  styleHeaderRow(sheet);

  for (const p of plans) {
    sheet.addRow({
      id: p.id,
      employee_id: employeeId,
      employee_kr_id: p.employee_kr_id,
      employee_kr_title: p.employeeKr?.title || "",
      cycle_id: cycleId,
      cycle_name: cycle.name,
      month_number: p.month_number,
      title: p.title,
      description: p.description || "",
      adoption_mode: p.adoption_mode,
      weight_pct: dec(p.weight_pct),
      metric_definition_id: p.metric_definition_id || "",
      metric_name: p.metricDefinition?.name || "",
      start_value: dec(p.start_value),
      target_value: dec(p.target_value),
      current_value: dec(p.current_value),
      progress_pct: dec(p.progress_pct),
      contribute_to_score: p.contribute_to_score,
      contribute_to_value: p.contribute_to_value,
      plan_status: p.plan_status,
      aligned_manager_plan_id: p.aligned_manager_plan_id || "",
      reviewer_id: p.reviewer_id || "",
      rejection_note: p.rejection_note || "",
      created_at: p.created_at,
      submission_id: p.submission_id || "",
    });
  }

  const safeCycleName = cycle.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const monthSuffix = monthNumber ? `_M${monthNumber}` : "";
  const filename = `monthly_plans_${employeeId}_${safeCycleName}${monthSuffix}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename };
}

// ─── Weekly Plan Export ──────────────────────────────────────────────────────

export async function exportWeeklyPlans(
  companyId: number,
  employeeId: string,
  employeeMonthPlanId: number,
  weekNumber?: number,
): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
  const monthPlan = await prisma.employeeMonthPlan.findFirst({
    where: { id: employeeMonthPlanId, company_id: companyId, owner_id: employeeId },
    include: {
      employeeKr: {
        include: { employeeObjective: { include: { cycle: true } } },
      },
    },
  });
  if (!monthPlan) throw new Error("Monthly plan not found or not owned by you.");

  const where: any = {
    company_id: companyId,
    owner_id: employeeId,
    employee_month_plan_id: employeeMonthPlanId,
  };
  if (weekNumber) where.week_number = weekNumber;

  const plans = await prisma.weeklyPlan.findMany({
    where,
    include: {
      monthPlan: { select: { id: true, title: true } },
      metricDefinition: { select: { id: true, name: true } },
    },
    orderBy: [{ week_number: "asc" }, { created_at: "asc" }],
  });

  const cycle = monthPlan.employeeKr.employeeObjective.cycle;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  const sheet = wb.addWorksheet("Weekly Plans");

  sheet.columns = [
    { header: "id", key: "id", width: 10 },
    { header: "employee_id", key: "employee_id", width: 18 },
    { header: "employee_month_plan_id", key: "employee_month_plan_id", width: 24 },
    { header: "month_plan_title", key: "month_plan_title", width: 40 },
    { header: "week_number", key: "week_number", width: 14 },
    { header: "title", key: "title", width: 40 },
    { header: "adoption_mode", key: "adoption_mode", width: 18 },
    { header: "weight_pct", key: "weight_pct", width: 14 },
    { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
    { header: "metric_name", key: "metric_name", width: 25 },
    { header: "start_value", key: "start_value", width: 15 },
    { header: "target_value", key: "target_value", width: 15 },
    { header: "current_value", key: "current_value", width: 15 },
    { header: "progress_pct", key: "progress_pct", width: 14 },
    { header: "contribute_to_score", key: "contribute_to_score", width: 22 },
    { header: "contribute_to_value", key: "contribute_to_value", width: 22 },
    { header: "plan_status", key: "plan_status", width: 16 },
    { header: "aligned_manager_plan_id", key: "aligned_manager_plan_id", width: 26 },
    { header: "created_at", key: "created_at", width: 22 },
    { header: "submission_id", key: "submission_id", width: 15 },
  ];
  styleHeaderRow(sheet);

  for (const p of plans) {
    sheet.addRow({
      id: p.id,
      employee_id: employeeId,
      employee_month_plan_id: p.employee_month_plan_id,
      month_plan_title: p.monthPlan?.title || "",
      week_number: p.week_number,
      title: p.title,
      adoption_mode: p.adoption_mode,
      weight_pct: dec(p.weight_pct),
      metric_definition_id: p.metric_definition_id || "",
      metric_name: p.metricDefinition?.name || "",
      start_value: dec(p.start_value),
      target_value: dec(p.target_value),
      current_value: dec(p.current_value),
      progress_pct: dec(p.progress_pct),
      contribute_to_score: p.contribute_to_score,
      contribute_to_value: p.contribute_to_value,
      plan_status: p.plan_status,
      aligned_manager_plan_id: p.aligned_manager_plan_id || "",
      created_at: p.created_at,
      submission_id: p.submission_id || "",
    });
  }

  const safeCycleName = cycle.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const weekSuffix = weekNumber ? `_W${weekNumber}` : "";
  const filename = `weekly_plans_${employeeId}_${safeCycleName}_M${monthPlan.month_number}${weekSuffix}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename };
}


export async function exportCompanyObjectives(cycleId: number): Promise<Buffer> {
  const objectives = await prisma.companyObjective.findMany({
    where: { cycle_id: cycleId },
    include: { keyResults: true }
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Company OKRs");

  sheet.columns = [
    { header: "cycle_id", key: "cycle_id", width: 12 },
    { header: "objective_title", key: "objective_title", width: 40 },
    { header: "objective_description", key: "objective_description", width: 50 },
    { header: "key_result_title", key: "key_result_title", width: 40 },
    { header: "key_result_description", key: "key_result_description", width: 50 },
    { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
    { header: "unit_of_measure", key: "unit_of_measure", width: 18 },
    { header: "target_value", key: "target_value", width: 15 },
    { header: "start_value", key: "start_value", width: 15 },
    { header: "weight_percent", key: "weight_percent", width: 16 }
  ];

  for (const obj of objectives) {
    if (obj.keyResults.length === 0) {
      sheet.addRow({
        cycle_id: obj.cycle_id,
        objective_title: obj.title,
        objective_description: obj.description || ""
      });
    } else {
      for (const kr of obj.keyResults) {
        sheet.addRow({
          cycle_id: obj.cycle_id,
          objective_title: obj.title,
          objective_description: obj.description || "",
          key_result_title: kr.title,
          key_result_description: kr.description || "",
          metric_definition_id: kr.metric_definition_id,
          unit_of_measure: kr.unit_of_measure || "",
          target_value: kr.target_value,
          start_value: kr.start_value,
          weight_percent: kr.weight_percent
        });
      }
    }
  }

  sheet.getRow(1).font = { bold: true };
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
