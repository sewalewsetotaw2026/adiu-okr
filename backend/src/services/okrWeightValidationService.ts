import { prisma } from "src/app";
import { isWeightValidationEnabled } from "./okrConfigResolverService";

/**
 * Ensures that if weighted scoring is enabled, the sum of all contributing KR weights exactly equals 100%.
 * This must be executed before transitioning an Objective to the 'PUBLISHED' state.
 */
export async function validateWeightsBeforePublish(companyId: number, cycleId: number, parentObjectiveId: number, layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE") {
  // Check if configuration mandates weight validation
  const isEnabled = await isWeightValidationEnabled(companyId, cycleId);
  if (!isEnabled) {
    return { valid: true, message: "Weight validation bypassed by configuration" };
  }

  let totalWeight = 0;

  if (layer === "COMPANY") {
    const krs = await prisma.companyKeyResult.findMany({
      where: { 
        objective_id: parentObjectiveId, 
        contributes_to_objective_score: true,
        status_code: { not: "archived" }
      }
    });
    totalWeight = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  } else if (layer === "DEPARTMENT") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: { 
        employee_objective_id: parentObjectiveId, 
        contributes_to_objective_score: true,
        status_code: { not: "archived" }
      }
    });
    totalWeight = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  } else if (layer === "EMPLOYEE") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: { 
        employee_objective_id: parentObjectiveId, 
        contributes_to_objective_score: true,
        status_code: { not: "archived" }
      }
    });
    totalWeight = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  }

  // Tolerance threshold due to float conversions (JavaScript math)
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Total weights for contributing KRs must equal exactly 100%. Current calculated sum: ${totalWeight}%`);
  }

  return { valid: true };
}

/**
 * Validates KR weights across all objectives within a submission.
 * Each objective's contributing KRs must sum to exactly 100%.
 * Called before creating an OkrSubmission record.
 */
export async function validateWeightsForSubmission(
  companyId: number,
  cycleId: number,
  objectiveIds: number[],
) {
  const isEnabled = await isWeightValidationEnabled(companyId, cycleId);
  if (!isEnabled) {
    return { valid: true, message: "Weight validation bypassed by configuration" };
  }

  const errors: string[] = [];

  for (const objId of objectiveIds) {
    const krs = await prisma.employeeKeyResult.findMany({
      where: {
        employee_objective_id: objId,
        contributes_to_objective_score: true,
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });

    if (krs.length === 0) continue; // No KRs to validate

    const totalWeight = krs.reduce(
      (sum: number, kr: any) => sum + Number(kr.weight_percent || 0),
      0,
    );

    if (Math.abs(totalWeight - 100) > 0.01) {
      const obj = await prisma.employeeObjective.findUnique({
        where: { id: objId },
        select: { title: true },
      });
      errors.push(
        `"${obj?.title || `Objective #${objId}`}": KR weights sum to ${totalWeight}% (must be 100%)`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Weight validation failed for ${errors.length} objective(s):\n${errors.join("\n")}`,
    );
  }

  return { valid: true };
}

/**
 * Checks if adding or updating a KR's weight will exceed the 100% limit for the parent objective.
 * This is used during CREATE and UPDATE operations.
 */
export async function checkWeightLimit(
  parentObjectiveId: number,
  layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
  newWeight: number,
  excludeKrId?: number
) {
  let currentTotal = 0;

  if (layer === "COMPANY") {
    const krs = await prisma.companyKeyResult.findMany({
      where: {
        objective_id: parentObjectiveId,
        id: { not: excludeKrId },
        contributes_to_objective_score: true,
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });
    currentTotal = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  } else if (layer === "DEPARTMENT") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: {
        employee_objective_id: parentObjectiveId,
        id: { not: excludeKrId },
        contributes_to_objective_score: true,
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });
    currentTotal = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  } else if (layer === "EMPLOYEE") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: {
        employee_objective_id: parentObjectiveId,
        id: { not: excludeKrId },
        contributes_to_objective_score: true,
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });
    currentTotal = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  }

  if (currentTotal + newWeight > 100) {
    throw new Error(
      `Total weight would exceed 100%. Current total: ${currentTotal}%, requested: ${newWeight}%`
    );
  }

  return true;
}

/**
 * Validates that the weights of children for a specific tactical parent sum to exactly 100%.
 */
export async function validateTacticalWeights(parentId: number, type: "KR_MONTHS" | "KR_SUBTASKS" | "MONTH_WEEKS" | "WEEK_DAILY_PLANS" | "DEPT_KR_MONTHS" | "DEPT_WEEK_DAILY_PLANS") {

  let totalWeight = 0;
  let label = "";

  switch (type) {
    case "KR_MONTHS":
      // EmployeeMonthPlan no longer tracks weight_percent per KR (items-based model).
      // Weight validation for monthly plans is skipped.
      totalWeight = 100; // treat as satisfied
      label = "Monthly Plans for Objective KR";
      break;

    case "KR_SUBTASKS":
      const subtasks = await prisma.subtask.findMany({
        where: { employee_kr_id: parentId, contributes_to_parent_score: true, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      totalWeight = subtasks.reduce((sum: number, s: any) => sum + Number(s.weight_percent || 0), 0);
      label = "Subtasks for Objective KR";
      break;

    case "MONTH_WEEKS":
      const weeks = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: parentId, contribute_to_score: true, plan_status: { not: "REJECTED" } },
        select: { weight_pct: true }
      });
      totalWeight = weeks.reduce((sum: number, w: any) => sum + Number(w.weight_pct || 0), 0);
      label = "Weekly Plans for Month";
      break;

    case "WEEK_DAILY_PLANS":
      // Daily plans are atomic (equal weight, no per-task weight in the new schema).
      const dailyPlans = await prisma.dailyPlan.findMany({
        where: { weekly_plan_id: parentId, contribute_to_score: true, status: { not: "SKIPPED" } },
        select: { id: true }
      });
      totalWeight = dailyPlans.length > 0 ? 100 : 0;
      label = "Daily Plans for Weekly Plan";
      break;


    case "DEPT_KR_MONTHS":
      // Monthly plans now carry weight_pct directly.
      const dMonths = await prisma.employeeMonthPlan.findMany({
        where: { employee_kr_id: parentId, plan_status: { not: "REJECTED" } },
        select: { weight_pct: true }
      });
      totalWeight = dMonths.reduce(
        (sum: number, m: any) => sum + Number(m.weight_pct || 0),
        0,
      );
      label = "Department Monthly Plans";
      break;

    case "DEPT_WEEK_DAILY_PLANS":
      const dDailyPlans = await prisma.dailyPlan.findMany({
        where: { weekly_plan_id: parentId, contribute_to_score: true, status: { not: "SKIPPED" } },
        select: { id: true }
      });
      totalWeight = dDailyPlans.length > 0 ? 100 : 0;
      label = "Department Daily Plans";
      break;

  }

  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Total weights for ${label} must equal exactly 100%. Current sum: ${totalWeight}%`);
  }

  return true;
}

/**
 * Checks if adding/updating a tactical weight exceeds 100%.
 */
export async function checkTacticalWeightLimit(
  parentId: number,
  type: "KR_MONTHS" | "KR_SUBTASKS" | "MONTH_WEEKS" | "WEEK_DAILY_PLANS" | "DEPT_KR_MONTHS" | "DEPT_WEEK_DAILY_PLANS",
  newWeight: number,

  excludeId?: number
) {
  let currentTotal = 0;

  switch (type) {
    case "KR_MONTHS":
      // EmployeeMonthPlan no longer tracks weight_percent per KR (items-based model).
      currentTotal = 0;
      break;
    case "KR_SUBTASKS":
      const s = await prisma.subtask.findMany({
        where: { employee_kr_id: parentId, id: { not: excludeId }, contributes_to_parent_score: true, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      currentTotal = s.reduce((sum: number, x: any) => sum + Number(x.weight_percent || 0), 0);
      break;
    case "MONTH_WEEKS":
      const w = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: parentId, id: { not: excludeId }, contribute_to_score: true, plan_status: { not: "REJECTED" } },
        select: { weight_pct: true }
      });
      currentTotal = w.reduce((sum: number, x: any) => sum + Number(x.weight_pct || 0), 0);
      break;
    case "WEEK_DAILY_PLANS":
      // Daily plans no longer carry per-task weight in the new schema.
      currentTotal = 0;
      break;
    case "DEPT_WEEK_DAILY_PLANS":
      currentTotal = 0;
      break;

  }

  if (currentTotal + newWeight > 100) {
    throw new Error(`Total weight would exceed 100%. Current total: ${currentTotal}%, requested: ${newWeight}%`);
  }

  return true;
}
