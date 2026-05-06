import { prisma } from "src/app";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isDepartmentHead(
  userId: string,
  companyId: number,
): Promise<boolean> {
  const user = await prisma.appUser.findFirst({
    where: { employee_id: userId, company_id: companyId },
    select: { id: true, employee_id: true },
  });
  if (!user) return false;

  const dept = await prisma.department.findFirst({
    where: {
      company_id: companyId,
      head_user_id: user.id,
    },
  });

  return !!dept;
}

// ─── Alignment Lookup Endpoints (for employees) ──────────────────────────────

/**
 * Get manager month plan items for an employee to align to.
 * Traverses: employee's EmployeeObjective → chosen_parent_employee_kr_id →
 * parent KR owner (the manager) → their EmployeeMonthPlan records.
 *
 * Since a manager is just another employee, their plans live in the same
 * EmployeeMonthPlan / EmployeeMonthPlanItem tables.
 */
export async function getManagerMonthPlanItemsForEmployee(
  employeeUserId: string,
  monthNumber: number,
  companyId: number,
  cycleId: number,
) {
  // Find employee's objectives that have a parent employee KR
  const objectives = await prisma.employeeObjective.findMany({
    where: {
      user_id: employeeUserId,
      company_id: companyId,
      cycle_id: cycleId,
      chosen_parent_employee_kr_id: { not: null },
    },
    select: {
      id: true,
      chosen_parent_employee_kr_id: true,
      title: true,
    },
  });

  if (objectives.length === 0) return [];

  const parentKrIds = objectives
    .map((o) => o.chosen_parent_employee_kr_id)
    .filter((id): id is number => !!id);

  if (parentKrIds.length === 0) return [];

  // Find the manager's objectives via parent KR ownership
  const parentKrs = await prisma.employeeKeyResult.findMany({
    where: { id: { in: parentKrIds } },
    select: {
      id: true,
      employeeObjective: { select: { id: true, user_id: true } },
    },
  });

  const managerObjectiveIds = [
    ...new Set(parentKrs.map((kr) => kr.employeeObjective.id)),
  ];

  // Query the manager's own monthly plan records (per-KR in the new schema).
  return prisma.employeeMonthPlan.findMany({
    where: {
      employeeKr: { employee_objective_id: { in: managerObjectiveIds } },
      company_id: companyId,
      month_number: monthNumber,
      plan_status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "PUBLISHED"] },
    },
    include: {
      employeeKr: { select: { id: true, title: true, target_value: true } },
    },
  });
}

/**
 * Get manager weekly plan items for an employee to align to.
 * Same traversal logic — find the manager's own WeeklyPlan records.
 */
export async function getManagerWeeklyPlanItemsForEmployee(
  employeeUserId: string,
  weekNumber: number,
  companyId: number,
  cycleId: number,
) {
  const objectives = await prisma.employeeObjective.findMany({
    where: {
      user_id: employeeUserId,
      company_id: companyId,
      cycle_id: cycleId,
      chosen_parent_employee_kr_id: { not: null },
    },
    select: { chosen_parent_employee_kr_id: true },
  });

  const parentKrIds = objectives
    .map((o) => o.chosen_parent_employee_kr_id)
    .filter((id): id is number => !!id);

  if (parentKrIds.length === 0) return [];

  // Find the manager's objectives via parent KR ownership
  const parentKrs = await prisma.employeeKeyResult.findMany({
    where: { id: { in: parentKrIds } },
    select: {
      id: true,
      employeeObjective: { select: { id: true } },
    },
  });

  const managerObjectiveIds = [
    ...new Set(parentKrs.map((kr) => kr.employeeObjective.id)),
  ];

  // Query manager's own weekly plan records via their monthly plans.
  return prisma.weeklyPlan.findMany({
    where: {
      monthPlan: {
        employeeKr: { employee_objective_id: { in: managerObjectiveIds } },
      },
      company_id: companyId,
      week_number: weekNumber,
      plan_status: "PUBLISHED",
    },
    include: {
      monthPlan: {
        select: {
          employeeKr: {
            select: { id: true, title: true, target_value: true },
          },
        },
      },
      dailyPlans: true,
    },
  });
}

// ─── Alignment Validation ────────────────────────────────────────────────────

/**
 * Validates that an employee's plan item links to a valid manager plan item.
 * The referenced item must be an EmployeeMonthPlanItem belonging to the
 * manager's objective (via the parent KR hierarchy).
 *
 * Throws if:
 * - The employee has a parent KR (not dept head) AND no parent item ID is provided
 * - The referenced plan item doesn't exist or its parent plan isn't published
 */
export async function validateMonthlyAlignment(
  employeeObjectiveId: number,
  parentMonthPlanItemId: number | null | undefined,
  companyId: number,
) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    select: { user_id: true, chosen_parent_employee_kr_id: true },
  });

  if (!objective?.chosen_parent_employee_kr_id) {
    // No parent KR — this is a top-level employee (CEO or dept head), no alignment needed
    return;
  }

  // Check if user is department head
  const isHead = await isDepartmentHead(objective.user_id, companyId);
  if (isHead) return; // Dept heads can create orphan plans

  if (!parentMonthPlanItemId) {
    throw new Error(
      "Alignment to a manager monthly plan item is required. Please select the manager plan item this aligns to.",
    );
  }

  // The legacy EmployeeMonthPlanItem table was removed; alignment now points
  // directly at a manager's monthly plan id.
  const parentPlan = await prisma.employeeMonthPlan.findUnique({
    where: { id: parentMonthPlanItemId },
    select: { plan_status: true },
  });

  if (!parentPlan) {
    throw new Error("The referenced manager monthly plan does not exist.");
  }

  if (parentPlan.plan_status !== "PUBLISHED") {
    throw new Error(
      "The manager's monthly plan must be published before employees can align to it.",
    );
  }
}

export async function validateWeeklyAlignment(
  employeeObjectiveId: number,
  parentWeeklyPlanId: number | null | undefined,
  companyId: number,
) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    select: { user_id: true, chosen_parent_employee_kr_id: true },
  });

  if (!objective?.chosen_parent_employee_kr_id) return;

  const isHead = await isDepartmentHead(objective.user_id, companyId);
  if (isHead) return;

  if (!parentWeeklyPlanId) {
    throw new Error(
      "Alignment to a manager weekly plan is required. Please select the manager weekly plan this aligns to.",
    );
  }

  const parentPlan = await prisma.weeklyPlan.findUnique({
    where: { id: parentWeeklyPlanId },
    select: { plan_status: true },
  });

  if (!parentPlan) {
    throw new Error("The referenced manager weekly plan does not exist.");
  }

  if (parentPlan.plan_status !== "PUBLISHED") {
    throw new Error(
      "The manager's weekly plan must be published before employees can align to it.",
    );
  }
}

export { isDepartmentHead };
