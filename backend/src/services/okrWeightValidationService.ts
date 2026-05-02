import { prisma } from "src/app";
import { isWeightValidationEnabled } from "./okrConfigResolverService";

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Ensures all KR weights (direct + indirect combined) sum to exactly 100%.
 * Computes and persists `normalized_weight` for each KR based on its group (direct vs indirect).
 * Validates that direct KRs meet the mandatory minimum target threshold.
 */
export async function validateWeightsBeforePublish(companyId: number, cycleId: number, parentObjectiveId: number, layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE") {
  const isEnabled = await isWeightValidationEnabled(companyId, cycleId);
  if (!isEnabled) {
    return { valid: true, message: "Weight validation bypassed by configuration" };
  }

  let krs: any[] = [];
  let parentObj: any = null;

  if (layer === "COMPANY") {
    krs = await prisma.companyKeyResult.findMany({
      where: {
        objective_id: parentObjectiveId,
        status_code: { not: "archived" }
      }
    });
    parentObj = await prisma.companyObjective.findUnique({ where: { id: parentObjectiveId } });
  } else {
    krs = await prisma.employeeKeyResult.findMany({
      where: {
        employee_objective_id: parentObjectiveId,
        status_code: { not: "archived" }
      }
    });
    parentObj = await prisma.employeeObjective.findUnique({ where: { id: parentObjectiveId } });
  }

  const totalWeight = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);

  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Total weights for all KRs (direct + indirect) must equal exactly 100%. Current sum: ${totalWeight}%`);
  }

  const directKrs = krs.filter(kr => kr.is_direct !== false);
  const indirectKrs = krs.filter(kr => kr.is_direct === false);

  const directWeightSum = directKrs.reduce((sum, kr) => sum + Number(kr.weight_percent || 0), 0);
  const indirectWeightSum = indirectKrs.reduce((sum, kr) => sum + Number(kr.weight_percent || 0), 0);

  const parentTarget = new Decimal(parentObj?.target_value || 0);

  // Compute and persist normalized weights, and validate minimum targets for direct KRs
  for (const kr of krs) {
    const rawWeight = Number(kr.weight_percent || 0);
    const isDirect = kr.is_direct !== false;
    
    let normalizedWeight = new Decimal(0);
    if (isDirect && directWeightSum > 0) {
      normalizedWeight = new Decimal(rawWeight).div(directWeightSum).mul(100).toDecimalPlaces(2);
    } else if (!isDirect && indirectWeightSum > 0) {
      normalizedWeight = new Decimal(rawWeight).div(indirectWeightSum).mul(100).toDecimalPlaces(2);
    }

    if (isDirect && parentTarget.gt(0)) {
      const minTarget = parentTarget.mul(normalizedWeight).div(100);
      const currentTarget = new Decimal(kr.target_value || 0);
      
      if (currentTarget.lt(minTarget)) {
        throw new Error(`Validation Error: Direct KR "${kr.title}" has a target value (${currentTarget.toString()}) below the minimum required threshold (${minTarget.toDecimalPlaces(2).toString()}) based on its normalized weight (${normalizedWeight.toString()}%).`);
      }
    }

    if (layer === "COMPANY") {
      await prisma.companyKeyResult.update({
        where: { id: kr.id },
        data: { normalized_weight: normalizedWeight }
      });
    } else {
      await prisma.employeeKeyResult.update({
        where: { id: kr.id },
        data: { normalized_weight: normalizedWeight }
      });
    }
  }

  return { valid: true };
}

/**
 * Checks if adding/updating a KR weight will exceed the 100% shared pool.
 * Both direct and indirect KRs count toward the same 100% limit.
 */
export async function checkWeightLimit(
  parentObjectiveId: number,
  layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
  newWeight: number,
  isDirect: boolean = true,
  excludeKrId?: number
) {
  // NOTE: isDirect parameter kept for API compatibility but no longer exempts indirect KRs
  let currentTotal = 0;

  if (layer === "COMPANY") {
    const krs = await prisma.companyKeyResult.findMany({
      where: {
        objective_id: parentObjectiveId,
        id: { not: excludeKrId },
        // No is_direct filter — all KRs share the pool
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });
    currentTotal = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  } else {
    const krs = await prisma.employeeKeyResult.findMany({
      where: {
        employee_objective_id: parentObjectiveId,
        id: { not: excludeKrId },
        // No is_direct filter — all KRs share the pool
        status_code: { not: "archived" },
      },
      select: { weight_percent: true },
    });
    currentTotal = krs.reduce((sum: number, kr: any) => sum + Number(kr.weight_percent || 0), 0);
  }

  if (currentTotal + newWeight > 100) {
    throw new Error(
      `Total weight would exceed 100%. Current total (direct + indirect): ${currentTotal}%, requested: ${newWeight}%`
    );
  }

  return true;
}

/**
 * Validates that the weights of plan children (weekly plans under a monthly plan,
 * daily plans under a weekly task, etc.) sum to exactly 100%.
 * Per spec: all children (direct + indirect) share the same 100% pool at each level.
 */
export async function validateTacticalWeights(parentId: number, type: "KR_MONTHS" | "KR_SUBTASKS" | "MONTH_WEEKS" | "WEEK_DAILY_PLANS" | "DEPT_KR_MONTHS" | "DEPT_WEEK_DAILY_PLANS") {

  let totalWeight = 0;
  let label = "";

  switch (type) {
    case "KR_MONTHS":
      // Monthly plan items don't carry weight_percent — validation skipped.
      totalWeight = 100;
      label = "Monthly Plans for Objective KR";
      break;

    case "KR_SUBTASKS":
      const subtasks = await prisma.subtask.findMany({
        // No is_direct filter — all subtasks (direct + indirect) share 100%
        where: { employee_kr_id: parentId, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      totalWeight = subtasks.reduce((sum: number, s: any) => sum + Number(s.weight_percent || 0), 0);
      label = "Subtasks for Objective KR";
      break;

    case "MONTH_WEEKS":
      const weeks = await prisma.weeklyPlan.findMany({
        // No is_direct filter — all weekly plans (direct + indirect) share 100%
        where: { employee_month_plan_id: parentId, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      totalWeight = weeks.reduce((sum: number, w: any) => sum + Number(w.weight_percent || 0), 0);
      label = "Weekly Plans for Month";
      break;

    case "WEEK_DAILY_PLANS":
      const dailyPlans = await prisma.dailyPlan.findMany({
        // No is_direct filter — all daily plans (direct + indirect) share 100%
        where: { weekly_task_id: parentId, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      totalWeight = dailyPlans.reduce((sum: number, m: any) => sum + Number(m.weight_percent || 0), 0);
      label = "Daily Plans for Weekly Task";
      break;

    case "DEPT_KR_MONTHS":
      // Monthly plans are item-based, no weight_percent — skip
      totalWeight = 100;
      label = "Department Monthly Plans";
      break;

    case "DEPT_WEEK_DAILY_PLANS":
      const dDailyPlans = await prisma.dailyPlan.findMany({
        where: { weekly_task_id: parentId, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      totalWeight = dDailyPlans.reduce((sum: number, m: any) => sum + Number(m.weight_percent || 0), 0);
      label = "Department Daily Plans";
      break;
  }

  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Total weights for ${label} (direct + indirect) must equal exactly 100%. Current sum: ${totalWeight}%`);
  }

  return true;
}

/**
 * Checks if adding/updating a tactical child's weight exceeds 100% shared pool.
 * All children (direct + indirect) count toward the same limit at each level.
 */
export async function checkTacticalWeightLimit(
  parentId: number,
  type: "KR_MONTHS" | "KR_SUBTASKS" | "MONTH_WEEKS" | "WEEK_DAILY_PLANS" | "DEPT_KR_MONTHS" | "DEPT_WEEK_DAILY_PLANS",
  newWeight: number,
  isDirect: boolean = true,
  excludeId?: number
) {
  // NOTE: isDirect kept for API compatibility — no longer exempts indirect items
  let currentTotal = 0;

  switch (type) {
    case "KR_MONTHS":
      currentTotal = 0; // item-based, no weights
      break;
    case "KR_SUBTASKS":
      const s = await prisma.subtask.findMany({
        where: { employee_kr_id: parentId, id: { not: excludeId }, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      currentTotal = s.reduce((sum: number, x: any) => sum + Number(x.weight_percent || 0), 0);
      break;
    case "MONTH_WEEKS":
      const w = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: parentId, id: { not: excludeId }, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      currentTotal = w.reduce((sum: number, x: any) => sum + Number(x.weight_percent || 0), 0);
      break;
    case "WEEK_DAILY_PLANS":
      const dp = await prisma.dailyPlan.findMany({
        where: { weekly_task_id: parentId, id: { not: excludeId }, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      currentTotal = dp.reduce((sum: number, x: any) => sum + Number(x.weight_percent || 0), 0);
      break;
    case "DEPT_WEEK_DAILY_PLANS":
      const ddp = await prisma.dailyPlan.findMany({
        where: { weekly_task_id: parentId, id: { not: excludeId }, status_code: { not: "archived" } },
        select: { weight_percent: true }
      });
      currentTotal = ddp.reduce((sum: number, x: any) => sum + Number(x.weight_percent || 0), 0);
      break;
  }

  if (currentTotal + newWeight > 100) {
    throw new Error(`Total weight would exceed 100%. Current total (direct + indirect): ${currentTotal}%, requested: ${newWeight}%`);
  }

  return true;
}
