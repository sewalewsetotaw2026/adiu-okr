import { prisma } from "src/app";
import {
  getCadencePermissionByConfiguredCadence,
  getPlanningCadence,
  isCadenceAllowedForRole,
  isMonthlyPlanRequired,
} from "./okrConfigResolverService";

/**
 * Validates that a department planning phase can commence.
 * Rule: Department planning is blocked until the parent Company KR is published.
 */
export async function validateDepartmentPlanningStart(
  companyId: number,
  companyKrId: number,
) {
  const companyKr = await prisma.companyKeyResult.findFirst({
    where: { id: companyKrId, company_id: companyId },
  });
  if (!companyKr) throw new Error("Parent Company KR not found.");
  if (companyKr.status_code !== "published") {
    throw new Error(
      `Cannot start department planning. Parent Company KR '${companyKr.title}' is not published.`,
    );
  }
}

/**
 * Validates that sequentially, Month 2 cannot exist unless Month 1 exists.
 * Helps prevent fragmentation in monthly planning.
 */
export async function validateMonthSequence(
  companyId: number,
  parentKrId: number,
  newMonthNumber: number,
  layer: "DEPARTMENT" | "EMPLOYEE",
) {
  if (newMonthNumber === 1) return; // Month 1 is always okay to create

  const expectedPreviousMonth = newMonthNumber - 1;

  if (layer === "DEPARTMENT") {
    const previousMonth = await prisma.employeeMonthPlan.findFirst({
      where: {
        employeeObjective: { chosen_parent_kr_id: parentKrId },
        month_number: expectedPreviousMonth,
      },
    });
    if (!previousMonth) {
      throw new Error(
        `Cannot plan Month ${newMonthNumber} without Month ${expectedPreviousMonth} existing.`,
      );
    }
  } else if (layer === "EMPLOYEE") {
    // Employee month plans are now sequenced by DepartmentMonthPlan order.
    // Sequencing validation is handled at the DepartmentMonthPlan level.
    return;
  }
}

/**
 * Ensures child planning records have proper parent linkage.
 */
export async function validateParentLinkage(
  childEntityType: string,
  parentId?: number,
) {
  if (!parentId) {
    throw new Error(
      `Parent linkage metric or ID is required for ${childEntityType} planning.`,
    );
  }
}

/**
 * Ensures a lower layer does not execute before its immediate parent is published.
 */
export async function validateLowerLayerStartBeforeParentPublish(
  layer: "DEPARTMENT" | "EMPLOYEE",
  parentId: number,
  parentType: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
) {
  if (layer === "EMPLOYEE") {
    if (parentType === "DEPARTMENT") {
      const parentKr = await prisma.employeeKeyResult.findUnique({
        where: { id: parentId },
      });
      if (!parentKr) throw new Error("Parent Department KR not found.");
      if (parentKr.status_code !== "published") {
        throw new Error(
          "Cannot start employee planning. Parent Department KR is not published.",
        );
      }
    } else if (parentType === "EMPLOYEE") {
      const parentKr = await prisma.employeeKeyResult.findUnique({
        where: { id: parentId },
      });
      if (!parentKr) throw new Error("Parent Employee KR not found.");
      if (!["approved", "published"].includes(parentKr.status_code)) {
        throw new Error(
          "Cannot start employee planning. Parent Employee KR must be approved or published.",
        );
      }
    }
  }
}

/**
 * Validates that the requested planning cadence matches the configuration.
 */
export async function validatePlanningCadence(
  companyId: number,
  cycleId: number | undefined,
  departmentId: number | undefined,
  requestedCadence: "MONTHLY" | "WEEKLY" | "DAILY",
  actorRole?: string,
) {
  const configuredCadence = await getPlanningCadence(
    companyId,
    cycleId,
    departmentId,
  );
  const cadencePermissions =
    getCadencePermissionByConfiguredCadence(configuredCadence);

  const isAllowedByCadence =
    requestedCadence === "MONTHLY"
      ? cadencePermissions.allow_monthly
      : requestedCadence === "WEEKLY"
        ? cadencePermissions.allow_weekly
        : cadencePermissions.allow_daily;

  if (!isAllowedByCadence) {
    throw new Error(
      `${requestedCadence} planning is disabled by configuration. Current planning cadence is ${configuredCadence}.`,
    );
  }

  if (actorRole) {
    const rolePermission = await isCadenceAllowedForRole({
      companyId,
      requestedCadence,
      roleCode: actorRole,
      cycleId,
      departmentId,
    });

    if (!rolePermission.allowed) {
      throw new Error(
        `${requestedCadence} planning is not available for level '${rolePermission.level}' based on level configuration.`,
      );
    }
  }
}

/**
 * Ensures a weekly plan requires a parent monthly plan if configured to do so.
 */
export async function validateWeeklyPlanDependencies(
  companyId: number,
  cycleId: number | undefined,
  departmentId: number | undefined,
  employeeMonthPlanId?: number,
) {
  const requiresValidMonth = await isMonthlyPlanRequired(
    companyId,
    cycleId,
    departmentId,
  );
  if (requiresValidMonth && !employeeMonthPlanId) {
    throw new Error(
      "A valid month plan ID is required to create a weekly plan based on current configurations.",
    );
  }
}

/**
 * Enforces sequential creation of weekly plans (e.g. Week 1 before Week 2)
 */
export async function validateWeekSequence(
  employeeKrId: number,
  weekNumber: number,
) {
  if (weekNumber === 1) return; // week 1 always allowed

  // Check if weekNumber - 1 exists
  const prevWeek = await prisma.weeklyPlan.findFirst({
    where: { employee_kr_id: employeeKrId, week_number: weekNumber - 1 },
  });

  if (!prevWeek) {
    throw new Error(
      `Cannot create Week ${weekNumber} plan. You must create the Week ${weekNumber - 1} plan first.`,
    );
  }
}
