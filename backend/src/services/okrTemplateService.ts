import ExcelJS from "exceljs";

// ─── Column Definitions ──────────────────────────────────────────────────────


const COMPANY_COLUMNS: Partial<ExcelJS.Column>[] = [
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

const QUARTERLY_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "employee_id", key: "employee_id", width: 18 },
  { header: "cycle_id", key: "cycle_id", width: 12 },
  { header: "parent_kr_type", key: "parent_kr_type", width: 18 },
  { header: "parent_kr_id", key: "parent_kr_id", width: 15 },
  { header: "execution_mode", key: "execution_mode", width: 20 },
  { header: "objective_title", key: "objective_title", width: 40 },
  { header: "objective_description", key: "objective_description", width: 50 },
  { header: "key_result_title", key: "key_result_title", width: 40 },
  { header: "key_result_description", key: "key_result_description", width: 50 },
  { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
  { header: "unit_of_measure", key: "unit_of_measure", width: 18 },
  { header: "target_value", key: "target_value", width: 15 },
  { header: "start_value", key: "start_value", width: 15 },
  { header: "weight_percent", key: "weight_percent", width: 16 },
  { header: "contributes_to_score", key: "contributes_to_score", width: 22 },
  { header: "contributes_to_value", key: "contributes_to_value", width: 22 },
  { header: "is_mandatory", key: "is_mandatory", width: 14 },
];

const MONTHLY_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "employee_id", key: "employee_id", width: 18 },
  { header: "employee_kr_id", key: "employee_kr_id", width: 18 },
  { header: "cycle_id", key: "cycle_id", width: 12 },
  { header: "month_number", key: "month_number", width: 15 },
  { header: "title", key: "title", width: 40 },
  { header: "description", key: "description", width: 50 },
  { header: "adoption_mode", key: "adoption_mode", width: 18 },
  { header: "weight_pct", key: "weight_pct", width: 14 },
  { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
  { header: "start_value", key: "start_value", width: 15 },
  { header: "target_value", key: "target_value", width: 15 },
  { header: "contribute_to_score", key: "contribute_to_score", width: 22 },
  { header: "contribute_to_value", key: "contribute_to_value", width: 22 },
  { header: "aligned_manager_plan_id", key: "aligned_manager_plan_id", width: 26 },
];

const WEEKLY_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "employee_id", key: "employee_id", width: 18 },
  { header: "employee_month_plan_id", key: "employee_month_plan_id", width: 24 },
  { header: "week_number", key: "week_number", width: 14 },
  { header: "title", key: "title", width: 40 },
  { header: "adoption_mode", key: "adoption_mode", width: 18 },
  { header: "weight_pct", key: "weight_pct", width: 14 },
  { header: "metric_definition_id", key: "metric_definition_id", width: 22 },
  { header: "start_value", key: "start_value", width: 15 },
  { header: "target_value", key: "target_value", width: 15 },
  { header: "contribute_to_score", key: "contribute_to_score", width: 22 },
  { header: "contribute_to_value", key: "contribute_to_value", width: 22 },
  { header: "aligned_manager_plan_id", key: "aligned_manager_plan_id", width: 26 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function addInstructionSheet(wb: ExcelJS.Workbook, instructions: string[]) {
  const sheet = wb.addWorksheet("Instructions");
  sheet.columns = [
    { header: "Instructions", key: "text", width: 100 },
  ];
  styleHeaderRow(sheet);
  instructions.forEach((text) => {
    sheet.addRow({ text });
  });
}

// ─── Template Generators ─────────────────────────────────────────────────────

export async function generateQuarterlyTemplate(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Quarterly OKR");
  sheet.columns = QUARTERLY_COLUMNS;
  styleHeaderRow(sheet);

  // Add sample row
  sheet.addRow({
    employee_id: "EMP001",
    cycle_id: 1,
    parent_kr_type: "COMPANY",
    parent_kr_id: 1,
    execution_mode: "CUSTOMIZED",
    objective_title: "Increase revenue by 20%",
    objective_description: "",
    key_result_title: "Close 50 new deals",
    key_result_description: "",
    metric_definition_id: 1,
    unit_of_measure: "deals",
    target_value: 50,
    start_value: 0,
    weight_percent: 40,
    contributes_to_score: "TRUE",
    contributes_to_value: "TRUE",
    is_mandatory: "FALSE",
  });

  addInstructionSheet(wb, [
    "QUARTERLY OKR IMPORT TEMPLATE",
    "",
    "Required columns: employee_id, cycle_id, parent_kr_type, parent_kr_id, execution_mode, key_result_title, metric_definition_id, target_value",
    "objective_title is required when execution_mode = CUSTOMIZED. Ignored for DIRECT_ADOPTION.",
    "",
    "parent_kr_type: COMPANY or EMPLOYEE",
    "execution_mode: DIRECT_ADOPTION or CUSTOMIZED",
    "",
    "Rows with the same parent_kr_id will share one EmployeeObjective.",
    "contributes_to_score, contributes_to_value, is_mandatory accept TRUE/FALSE (default TRUE, TRUE, FALSE).",
    "",
    "Max 500 rows. Max file size 5MB.",
  ]);

  return wb.xlsx.writeBuffer();
}

export async function generateMonthlyTemplate(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Monthly Plans");
  sheet.columns = MONTHLY_COLUMNS;
  styleHeaderRow(sheet);

  sheet.addRow({
    employee_id: "EMP001",
    employee_kr_id: 1,
    cycle_id: 1,
    month_number: 1,
    title: "Month 1 - Initial outreach",
    description: "",
    adoption_mode: "DECOMPOSED",
    weight_pct: 40,
    metric_definition_id: "",
    start_value: 0,
    target_value: 20,
    contribute_to_score: "TRUE",
    contribute_to_value: "TRUE",
    aligned_manager_plan_id: "",
  });

  addInstructionSheet(wb, [
    "MONTHLY PLAN IMPORT TEMPLATE",
    "",
    "Required columns: employee_id, employee_kr_id, cycle_id, month_number, title",
    "weight_pct is required when adoption_mode = DECOMPOSED (default).",
    "",
    "month_number: 1, 2, or 3 (month within the quarter).",
    "adoption_mode: DIRECT or DECOMPOSED (default: DECOMPOSED).",
    "aligned_manager_plan_id: Optional. ID of manager's EmployeeMonthPlan to align to.",
    "",
    "Max 500 rows. Max file size 5MB.",
  ]);

  return wb.xlsx.writeBuffer();
}

export async function generateWeeklyTemplate(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kacha HRIS - OKR Module";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Weekly Plans");
  sheet.columns = WEEKLY_COLUMNS;
  styleHeaderRow(sheet);

  sheet.addRow({
    employee_id: "EMP001",
    employee_month_plan_id: 1,
    week_number: 1,
    title: "Week 1 - Setup and planning",
    adoption_mode: "DECOMPOSED",
    weight_pct: 25,
    metric_definition_id: "",
    start_value: 0,
    target_value: 5,
    contribute_to_score: "TRUE",
    contribute_to_value: "TRUE",
    aligned_manager_plan_id: "",
  });

  addInstructionSheet(wb, [
    "WEEKLY PLAN IMPORT TEMPLATE",
    "",
    "Required columns: employee_id, employee_month_plan_id, week_number, title",
    "weight_pct is required when adoption_mode = DECOMPOSED (default).",
    "",
    "week_number: 1–5 (week within the month).",
    "adoption_mode: DIRECT or DECOMPOSED (default: DECOMPOSED).",
    "aligned_manager_plan_id: Optional. ID of manager's WeeklyPlan to align to.",
    "",
    "Max 500 rows. Max file size 5MB.",
  ]);

  return wb.xlsx.writeBuffer();
}

export {
  QUARTERLY_COLUMNS,
  MONTHLY_COLUMNS,
  WEEKLY_COLUMNS,
};


export async function generateCompanyTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Company OKR Template");
  sheet.columns = COMPANY_COLUMNS;
  styleHeaderRow(sheet);
  sheet.addRow({
    cycle_id: 1,
    objective_title: "Expand Market Share",
    objective_description: "Focus on new regions",
    key_result_title: "Open 3 new branches",
    key_result_description: "In major cities",
    metric_definition_id: 1,
    unit_of_measure: "Branches",
    target_value: 3,
    start_value: 0,
    weight_percent: 100
  });
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
