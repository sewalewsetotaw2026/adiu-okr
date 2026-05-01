import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrExecutionMode } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  rollupFromEmployeeObjective,
  syncCurrentValueCascadeFromWeeklyPlan,
  syncCurrentValueCascadeFromDailyPlan,
  syncCurrentValueCascadeAfterDailyPlanDelete,
  cascadeCurrentValueFromEmployeeObjective,
} from "src/services/okrRollupService";
import { getOrCreateFallbackMetric } from "src/services/okrMetricService";
import { validateStatusTransition } from "src/services/okrStatusTransitionService";
import {
  validateTitleAndDescription,
  validateDuplicateKR,
  validateMetricRequirement,
  validateNotArchived,
  validateSafePublish,
} from "./okrValidationService";
import { resolveConfigValue } from "./okrConfigResolverService";
import { validateWeightsBeforePublish } from "./okrWeightValidationService";

import {
  validateMonthSequence,
  validateWeekSequence,
  validatePlanningCadence,
  validateWeeklyPlanDependencies,
  validateLowerLayerStartBeforeParentPublish,
} from "./okrPlanningGateValidator";
import { checkWeightLimit } from "./okrWeightValidationService";
import { validateMetricAlignment } from "./okrMetricAlignmentValidator";
import { markEmployeeKrAsComplete } from "./okrCompletionService";
import { computeMeasurementSnapshot } from "src/services/okrMeasurementService";

async function tryRollupEmployeeObjective(
  objectiveId: number,
  reason: string,
  deep: boolean = false,
) {
  try {
    await rollupFromEmployeeObjective(objectiveId, prisma, deep);
  } catch (error) {
    console.warn(`Auto-rollup after ${reason} failed:`, error);
  }
}

// ─── Employee Objectives ──────────────────────────────────────────────────────

export async function listEmployeeObjectives(
  userId: string | string[],
  companyId: number,
  cycleId: number,
) {
  const userFilter = Array.isArray(userId) ? { in: userId } : userId;

  return prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      user_id: userFilter,
      cycle_id: cycleId,
    },
    orderBy: { created_at: "asc" },
    include: {
      contributor: {
        select: {
          id: true,
          company_kr_id: true,
          employee_kr_id: true,
          role_type: true,
          is_required_for_completion: true,
        },
      },
      parentCompanyKr: {
        select: {
          id: true,
          title: true,
          objective: {
            select: { id: true, title: true, cycle_id: true },
          },
        },
      },
      parentEmployeeKr: {
        select: {
          id: true,
          title: true,
          employeeObjective: {
            select: { id: true, title: true, user_id: true },
          },
        },
      },
      _count: { select: { keyResults: true } },
    },
  });
}

export async function listEmployeeObjectivesForCycle(
  companyId: number,
  cycleId: number,
) {
  return prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
    },
    orderBy: { created_at: "asc" },
    include: {
      contributor: {
        select: {
          id: true,
          company_kr_id: true,
          role_type: true,
          is_required_for_completion: true,
        },
      },
      parentCompanyKr: {
        select: {
          id: true,
          title: true,
          objective: {
            select: { id: true, title: true, cycle_id: true },
          },
        },
      },
      _count: { select: { keyResults: true } },
    },
  });
}

export async function listAssignedKRsForEmployee(
  companyId: number,
  userId: string,
  cycleId?: number,
  includeAdopted = false,
) {
  let effectiveCycleId = cycleId;
  if (!effectiveCycleId) {
    const openCycle = await prisma.okrCycle.findFirst({
      where: { company_id: companyId, status: "OPEN" },
      select: { id: true },
    });
    effectiveCycleId = openCycle?.id;
  }

  // 1. Broadly resolve the user to get both ID variants (numeric and employee_id)
  const parsedId = parseInt(userId);
  const userOrClauses: any[] = [{ employee_id: userId }];
  if (!isNaN(parsedId) && parsedId > 0) {
    userOrClauses.push({ id: parsedId });
  }
  const targetUser = await prisma.appUser.findFirst({
    where: {
      OR: userOrClauses,
      company_id: companyId,
    },
    select: { id: true, employee_id: true },
  });

  const idVariants = [
    String(targetUser?.id || ""),
    targetUser?.employee_id || "",
  ].filter((v) => !!v);

  if (idVariants.length === 0) {
    // If we can't find a user by the provided ID, fallback to searching by the string exactly
    idVariants.push(userId);
  }

  const where: any = {
    company_id: companyId,
    user_id: { in: idVariants },
    status_code: { in: ["active", "assigned"] },
    ...(includeAdopted ? {} : { employeeObjectives: { is: null } }),
  };

  if (effectiveCycleId) {
    where.OR = [
      {
        companyKr: {
          objective: { cycle_id: effectiveCycleId },
        },
      },
      {
        employeeKr: {
          employeeObjective: { cycle_id: effectiveCycleId },
        },
      },
    ];
  }

  console.log(
    `[DEBUG listAssignedKRs] userId=${userId}, idVariants=${JSON.stringify(idVariants)}, cycleId=${effectiveCycleId}, includeAdopted=${includeAdopted}`,
  );
  console.log(`[DEBUG listAssignedKRs] where=`, JSON.stringify(where, null, 2));

  const assignments = await prisma.krContributor.findMany({
    where,
    orderBy: { assigned_at: "asc" },
    include: {
      companyKr: {
        select: {
          id: true,
          title: true,
          description: true,
          status_code: true,
          objective: {
            select: {
              id: true,
              title: true,
              cycle_id: true,
            },
          },
        },
      },
      employeeKr: {
        select: {
          id: true,
          title: true,
          description: true,
          status_code: true,
          employeeObjective: {
            select: {
              id: true,
              title: true,
              user_id: true,
              cycle_id: true,
            },
          },
        },
      },
      employeeObjectives: {
        select: {
          id: true,
          title: true,
          status_code: true,
          created_at: true,
        },
      },
    },
  });

  console.log(
    `[DEBUG listAssignedKRs] Found ${assignments.length} assignments:`,
    assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      company_kr_id: a.company_kr_id,
      emp_kr_id: a.employee_kr_id,
      has_obj: !!a.employeeObjectives,
    })),
  );

  return assignments.map((a) => ({
    contributor_id: a.id,
    user_id: a.user_id,
    role_type: a.role_type,
    assigned_at: a.assigned_at,
    company_kr: a.companyKr,
    employee_kr: a.employeeKr,
    employee_objective: a.employeeObjectives || null,
    can_adopt: !a.employeeObjectives,
  }));
}

export async function getEmployeeObjectiveDetail(
  id: number,
  companyId: number,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
    include: {
      cycle: true,
      contributor: true,
      parentCompanyKr: {
        include: {
          metricDefinition: true,
          objective: {
            select: { id: true, title: true, cycle_id: true },
          },
        },
      },
      parentEmployeeKr: {
        include: {
          metricDefinition: true,
          employeeObjective: {
            select: { id: true, title: true, user_id: true },
          },
        },
      },
      monthPlans: {
        include: {
          items: {
            include: { employeeKr: true },
          },
          weeklyPlans: {
            include: {
              tasks: {
                include: {
                  dailyPlans: { orderBy: { created_at: "asc" } },
                },
              },
              employeeKr: { select: { title: true } },
            },
            orderBy: { week_number: "asc" },
          },
        },
        orderBy: { month_number: "asc" },
      },
      keyResults: {
        include: {
          metricDefinition: true,
          contributors: {
            include: {
              employeeObjectives: true,
              user: { include: { employee: true } },
            },
          },
          subtasks: { orderBy: { created_at: "asc" } },
          progressUpdates: { orderBy: { created_at: "desc" } },
          _count: {
            select: {
              monthPlanItems: true,
              weeklyPlans: true,
              subtasks: true,
              progressUpdates: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!objective) throw new Error("Employee objective not found.");

  const activityLog = await prisma.okrActivityLog.findMany({
    where: { entity_type: "EMPLOYEE_OBJECTIVE", entity_id: id },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return { ...objective, activityLog };
}

interface AdoptAssignedKRInput {
  companyId: number;
  contributorId?: number;
  companyKrId?: number;
  employeeKrId?: number;
  cycleId?: number;
  executionMode: OkrExecutionMode;
  title?: string;
  description?: string;
  assignmentUserId: string;
  actorId: string;
}

export async function adoptAssignedKR(input: AdoptAssignedKRInput) {
  if (!["DIRECT_ADOPTION", "CUSTOMIZED"].includes(input.executionMode)) {
    throw new Error("execution_mode must be DIRECT_ADOPTION or CUSTOMIZED.");
  }

  if (!input.contributorId && !input.companyKrId && !input.employeeKrId) {
    throw new Error(
      "Either contributor_id, company_kr_id or employee_kr_id is required.",
    );
  }

  const contributor = await prisma.krContributor.findFirst({
    where: {
      company_id: input.companyId,
      ...(input.contributorId ? { id: input.contributorId } : {}),
      ...(!input.contributorId && input.companyKrId
        ? {
          company_kr_id: input.companyKrId,
          user_id: input.assignmentUserId,
        }
        : {}),
      ...(!input.contributorId && input.employeeKrId
        ? {
          employee_kr_id: input.employeeKrId,
          user_id: input.assignmentUserId,
        }
        : {}),
    },
    include: {
      companyKr: {
        include: {
          objective: {
            select: { id: true, cycle_id: true },
          },
        },
      },
      employeeKr: {
        include: {
          employeeObjective: {
            select: { id: true, cycle_id: true },
          },
        },
      },
    },
  });

  if (!contributor) {
    throw new Error("Contributor not found.");
  }

  if (input.companyKrId && contributor.company_kr_id !== input.companyKrId) {
    throw new Error("company_kr_id does not match contributor assignment.");
  }

  if (
    input.cycleId &&
    (contributor.companyKr?.objective.cycle_id ||
      contributor.employeeKr?.employeeObjective.cycle_id) !== input.cycleId
  ) {
    throw new Error("cycle_id does not match the assigned parent KR cycle.");
  }

  if (!["active", "assigned"].includes(contributor.status_code)) {
    throw new Error(
      "Only active or assigned contributor assignments can be adopted.",
    );
  }

  // Ensure parent KR is actionable before adoption starts
  const parentKrId = contributor.company_kr_id || contributor.employee_kr_id;
  const parentType = contributor.company_kr_id ? "COMPANY" : "EMPLOYEE";

  await validateLowerLayerStartBeforeParentPublish(
    "EMPLOYEE",
    parentKrId!,
    parentType,
  );

  const existingObjective = await prisma.employeeObjective.findUnique({
    where: { kr_contributor_id: contributor.id },
  });
  if (existingObjective) {
    return { objective: existingObjective, created: false };
  }

  if (input.executionMode === "CUSTOMIZED" && !input.title?.trim()) {
    throw new Error("A custom title is required for CUSTOMIZED adoption mode.");
  }

  const isDirectAdoption = input.executionMode === "DIRECT_ADOPTION";
  const parentTitle =
    contributor.companyKr?.title ||
    contributor.employeeKr?.title ||
    "Untitled Parent KR";

  const finalTitle = isDirectAdoption ? parentTitle : input.title!.trim();

  const finalDescription = isDirectAdoption
    ? contributor.companyKr?.description ||
    contributor.employeeKr?.description ||
    `Directly adopting assigned KR: ${parentTitle}`
    : input.description?.trim() || null;

  if (input.executionMode === "CUSTOMIZED") {
    validateTitleAndDescription(finalTitle, finalDescription || undefined);
  }

  const objective = await prisma.employeeObjective.create({
    data: {
      company_id: input.companyId,
      cycle_id:
        contributor.companyKr?.objective.cycle_id ||
        contributor.employeeKr?.employeeObjective.cycle_id ||
        0,
      kr_contributor_id: contributor.id,
      chosen_parent_kr_id: contributor.company_kr_id,
      chosen_parent_employee_kr_id: contributor.employee_kr_id,
      user_id: contributor.user_id,
      title: finalTitle,
      description: finalDescription,
      status_code: "draft",
      created_by: input.actorId,
    },
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: objective.id,
    actorId: input.actorId,
    action: isDirectAdoption
      ? "employee_objective_adopted"
      : "employee_objective_customized",
    description: isDirectAdoption
      ? `Employee objective created by direct adoption from parent KR "${contributor.companyKr?.title || contributor.employeeKr?.title}"`
      : `Employee objective created in customized mode from parent KR "${contributor.companyKr?.title || contributor.employeeKr?.title}"`,
    metadata: {
      contributor_id: contributor.id,
      chosen_parent_kr_id: contributor.company_kr_id,
      chosen_parent_employee_kr_id: contributor.employee_kr_id,
      execution_mode: input.executionMode,
    },
  });

  if (contributor.status_code === "assigned") {
    await prisma.krContributor.update({
      where: { id: contributor.id },
      data: { status_code: "active" },
    });
  }

  return { objective, created: true };
}

// ─── Execution Mode ───────────────────────────────────────────────────────────

export async function selectExecutionMode(
  employeeKrId: number,
  companyId: number,
  executionMode: OkrExecutionMode,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: employeeKrId, company_id: companyId },
  });
  if (!kr) throw new Error("Employee key result not found.");
  if (kr.status_code !== "draft") {
    if (kr.execution_mode === executionMode) return kr;
    throw new Error("Execution mode can only be changed on draft key results.");
  }

  if (kr.execution_mode === executionMode) return kr;

  const monthPlanCount = await prisma.employeeMonthPlan.count({
    where: { employee_objective_id: employeeKrId },
  });
  if (monthPlanCount > 0) {
    throw new Error(
      "Execution mode cannot be changed. Month planning has already begun.",
    );
  }

  const updated = await prisma.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: { execution_mode: executionMode },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: employeeKrId,
    actorId,
    action: "execution_mode_selected",
    description: `Execution mode set to ${executionMode} for employee KR "${kr.title}"`,
    metadata: { execution_mode: executionMode },
  });

  return updated;
}

// ─── Employee Key Results ─────────────────────────────────────────────────────

interface CreateEmployeeKRInput {
  companyId: number;
  employeeObjectiveId: number;
  title: string;
  description?: string;
  metricDefinitionId: number;
  unitOfMeasure?: string;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToScore?: boolean;
  contributesToValue?: boolean;
  isMandatory?: boolean;
  executionMode: OkrExecutionMode;
  createdBy: string;
  contributorUserId?: string;
  contributorUserIds?: string[];
  contributorRoleType?: string;
  isRequiredForCompletion?: boolean;
}

async function syncEmployeeObjectiveValueColumns(
  objectiveId: number,
  companyId: number,
) {
  const krs = await prisma.employeeKeyResult.findMany({
    where: {
      employee_objective_id: objectiveId,
      company_id: companyId,
    },
    select: {
      target_value: true,
      current_value: true,
      contributes_to_objective_value: true,
    },
  });

  const aggregate = krs.reduce(
    (acc, kr) => {
      if (kr.contributes_to_objective_value === false) return acc;
      acc.target = acc.target.add(new Decimal(kr.target_value || 0));
      const currentLike = kr.current_value ?? new Decimal(0);
      acc.current = acc.current.add(new Decimal(currentLike || 0));
      return acc;
    },
    { target: new Decimal(0), current: new Decimal(0) },
  );

  const progress = aggregate.target.gt(0)
    ? aggregate.current.div(aggregate.target).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await prisma.employeeObjective.update({
    where: { id: objectiveId },
    data: {
      current_value: aggregate.current,
      target_value: aggregate.target,
      progress_percent: progress,
    },
  });

  // NEW: Cascade current_value upward through parent linkage (recursion)
  await cascadeCurrentValueFromEmployeeObjective(objectiveId);
}

async function syncWeeklyPlanValueColumns(
  krId: number,
  weekNumber: number,
  companyId: number,
) {
  // 1. Sum up all WeeklyTasks for this plan
  const weeklyPlan = await prisma.weeklyPlan.findFirst({
    where: {
      employee_kr_id: krId,
      week_number: weekNumber,
      company_id: companyId,
    },
    include: { tasks: true },
  });

  if (!weeklyPlan) return;

  const totalCurrent = weeklyPlan.tasks.reduce(
    (sum, t) => sum.add(new Decimal(t.current_value || 0)),
    new Decimal(0),
  );

  const totalTarget = weeklyPlan.tasks.reduce(
    (sum, t) => sum.add(new Decimal(t.target_value || 0)),
    new Decimal(0),
  );

  const progress = totalTarget.gt(0)
    ? totalCurrent.div(totalTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await prisma.weeklyPlan.update({
    where: { id: weeklyPlan.id },
    data: {
      current_value: totalCurrent,
      target_value: totalTarget,
      progress_percent: progress,
    },
  });
}

async function syncEmployeeKrValueColumns(krId: number, companyId: number) {
  // 1. Get all month plan items for this KR
  const monthPlanItems = await prisma.employeeMonthPlanItem.findMany({
    where: {
      employee_kr_id: krId,
      company_id: companyId,
    },
    include: {
      monthPlan: true,
    },
  });

  if (monthPlanItems.length === 0) return;

  // 2. For each month plan item, sync its current_value from its weekly plans
  for (const item of monthPlanItems) {
    const weeklyPlans = await prisma.weeklyPlan.findMany({
      where: {
        employee_kr_id: krId,
        employee_month_plan_id: item.employee_month_plan_id,
        company_id: companyId,
      },
      select: {
        current_value: true,
      },
    });

    let itemCurrent = new Decimal(0);
    let hasWeeklyPlans = weeklyPlans.length > 0;

    if (hasWeeklyPlans) {
      itemCurrent = weeklyPlans.reduce(
        (sum, wp) => sum.add(new Decimal(wp.current_value || 0)),
        new Decimal(0),
      );
    } else {
      // If no weekly plans, look for the latest ProgressUpdate for this specific month
      // (assuming it's a direct monthly update)
      const latestUpdate = await prisma.progressUpdate.findFirst({
        where: {
          employee_kr_id: krId,
          month_number: item.monthPlan.month_number,
          week_number: null, // specifically for monthly level
          company_id: companyId,
        },
        orderBy: { created_at: "desc" },
      });
      if (latestUpdate) {
        itemCurrent = new Decimal(latestUpdate.current_value || 0);
      }
    }

    await prisma.employeeMonthPlanItem.update({
      where: { id: item.id },
      data: { current_value: itemCurrent },
    });

    // Also update the parent month plan current_value/progress
    const allItemsInPlan = await prisma.employeeMonthPlanItem.findMany({
      where: { employee_month_plan_id: item.employee_month_plan_id },
      select: { current_value: true, target_value: true },
    });

    const planCurrent = allItemsInPlan.reduce(
      (s, i) => s.add(new Decimal(i.current_value || 0)),
      new Decimal(0),
    );
    const planTarget = allItemsInPlan.reduce(
      (s, i) => s.add(new Decimal(i.target_value || 0)),
      new Decimal(0),
    );
    const planProgress = planTarget.gt(0)
      ? planCurrent.div(planTarget).mul(100).toDecimalPlaces(2)
      : new Decimal(0);

    await prisma.employeeMonthPlan.update({
      where: { id: item.employee_month_plan_id },
      data: {
        current_value: planCurrent,
        target_value: planTarget,
        progress_percent: planProgress,
      },
    });

    // Update our local reference for the final rollup
    item.current_value = itemCurrent as any;
  }

  // 3. Roll up all month plan item values into the Key Result
  const krTotalCurrent = monthPlanItems.reduce(
    (sum, item) => sum.add(new Decimal(item.current_value || 0)),
    new Decimal(0),
  );

  const kr = await prisma.employeeKeyResult.findUnique({
    where: { id: krId },
    select: { target_value: true },
  });

  const krTarget = new Decimal(kr?.target_value ?? 0);
  const krProgress = krTarget.gt(0)
    ? krTotalCurrent.div(krTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await prisma.employeeKeyResult.update({
    where: { id: krId },
    data: {
      current_value: krTotalCurrent,
      progress_percent: krProgress,
    },
  });
}

export async function createEmployeeKR(input: CreateEmployeeKRInput) {
  await validateNotArchived(
    input.companyId,
    input.employeeObjectiveId,
    "EMPLOYEE",
  );
  validateTitleAndDescription(input.title, input.description);
  await validateDuplicateKR(
    input.companyId,
    input.title,
    input.employeeObjectiveId,
    "EMPLOYEE",
  );
  await validateMetricRequirement(
    input.companyId,
    input.metricDefinitionId,
    input.contributesToValue,
  );

  let metricId = input.metricDefinitionId;
  let isValid = false;

  if (metricId && !isNaN(Number(metricId)) && Number(metricId) > 0) {
    const exists = await prisma.okrMetricDefinition.findFirst({
      where: { id: Number(metricId), company_id: input.companyId },
    });
    if (exists) isValid = true;
  }

  if (!isValid) {
    const defaultMetric = await getOrCreateFallbackMetric(input.companyId);
    metricId = defaultMetric.id;
  }

  const empObj = await prisma.employeeObjective.findFirst({
    where: { id: input.employeeObjectiveId, company_id: input.companyId },
  });
  if (!empObj) throw new Error("Employee objective not found.");

  const krCount = await prisma.employeeKeyResult.count({
    where: { employee_objective_id: input.employeeObjectiveId },
  });
  const maxKrs =
    (await resolveConfigValue({
      companyId: input.companyId,
      configKey: "max_krs_per_objective",
      cycleId: empObj.cycle_id,
    })) || 6;
  if (krCount >= Number(maxKrs)) {
    throw new Error(
      `Maximum of ${maxKrs} key results per employee objective reached.`,
    );
  }

  if (input.executionMode === "DIRECT_ADOPTION" && krCount >= 1) {
    throw new Error(
      "Direct adoption mode only supports a single KR mirroring the parent. Cannot decompose further.",
    );
  }

  // Weight Limit Check
  if (input.weightPercent && input.contributesToScore !== false) {
    await checkWeightLimit(
      input.employeeObjectiveId,
      "EMPLOYEE",
      input.weightPercent,
    );
  }

  // Metric Check against parent KR (Company KR or Employee KR)
  if (
    (empObj.chosen_parent_kr_id ||
      (empObj as any).chosen_parent_employee_kr_id) &&
    metricId
  ) {
    let parentMetricId: number | null = null;
    if (empObj.chosen_parent_kr_id) {
      const parentKr = await prisma.companyKeyResult.findUnique({
        where: { id: empObj.chosen_parent_kr_id },
        select: { metric_definition_id: true },
      });
      parentMetricId = parentKr?.metric_definition_id || null;
    } else if ((empObj as any).chosen_parent_employee_kr_id) {
      const parentKr = await prisma.employeeKeyResult.findUnique({
        where: { id: (empObj as any).chosen_parent_employee_kr_id },
        select: { metric_definition_id: true },
      });
      parentMetricId = parentKr?.metric_definition_id || null;
    }

    if (parentMetricId) {
      await validateMetricAlignment(
        input.companyId,
        parentMetricId,
        Number(metricId),
      );
    }
  }

  const hasContributorUserId =
    typeof input.contributorUserId === "string" &&
    input.contributorUserId.trim().length > 0;
  const hasContributorUserIds =
    Array.isArray(input.contributorUserIds) &&
    input.contributorUserIds.length > 0;

  const allContributorIds = Array.from(
    new Set([
      ...(hasContributorUserId ? [input.contributorUserId!] : []),
      ...(hasContributorUserIds ? input.contributorUserIds! : []),
    ]),
  ).filter((id) => id && id.trim().length > 0);

  const kr = await prisma.$transaction(async (tx) => {
    const createdKr = await tx.employeeKeyResult.create({
      data: {
        company_id: input.companyId,
        employee_objective_id: input.employeeObjectiveId,
        title: input.title,
        description: input.description,
        metric_definition_id: metricId,
        unit_of_measure: input.unitOfMeasure,
        target_value: input.targetValue,
        current_value: input.currentValue,
        weight_percent: input.weightPercent,
        contributes_to_objective_score: input.contributesToScore ?? true,
        contributes_to_objective_value: input.contributesToValue ?? true,
        is_mandatory_for_completion: input.isMandatory ?? false,
        execution_mode: input.executionMode,
        status_code: "draft",
        created_by: input.createdBy,
      },
      include: { metricDefinition: true },
    });

    for (const uid of allContributorIds) {
      const role =
        uid === input.contributorUserId
          ? input.contributorRoleType || "EMPLOYEE"
          : "EMPLOYEE";

      const isReq =
        uid === input.contributorUserId
          ? (input.isRequiredForCompletion ?? true)
          : true;

      await tx.krContributor.create({
        data: {
          company_id: input.companyId,
          employee_kr_id: createdKr.id,
          user_id: uid,
          role_type: role as any,
          is_required_for_completion: isReq,
          status_code: "active",
          assigned_by: input.createdBy,
        },
      });
    }

    return createdKr;
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "EMPLOYEE_KR",
    entityId: kr.id,
    actorId: input.createdBy,
    action: "employee_kr_created",
    description: `Employee KR "${kr.title}" created`,
    metadata: {
      employee_objective_id: input.employeeObjectiveId,
      contributor_count: allContributorIds.length,
    },
  });

  await syncEmployeeObjectiveValueColumns(
    input.employeeObjectiveId,
    input.companyId,
  );

  return kr;
}

export async function updateEmployeeKR(
  id: number,
  companyId: number,
  input: Partial<CreateEmployeeKRInput>,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Key result not found.");

  await validateNotArchived(companyId, kr.employee_objective_id, "EMPLOYEE");

  if (input.title !== undefined) {
    validateTitleAndDescription(input.title, input.description);
  }
  if (!kr) throw new Error("Employee key result not found.");
  if (kr.status_code !== "draft") {
    throw new Error("Only draft key results can be edited.");
  }

  if (input.title && input.title !== kr.title) {
    await validateDuplicateKR(
      companyId,
      input.title,
      kr.employee_objective_id,
      "EMPLOYEE",
      id,
    );
  }

  if (input.metricDefinitionId || input.contributesToValue !== undefined) {
    const metricToCheck =
      input.metricDefinitionId !== undefined
        ? input.metricDefinitionId
        : kr.metric_definition_id;
    const valueContrib =
      input.contributesToValue !== undefined
        ? input.contributesToValue
        : kr.contributes_to_objective_value;
    await validateMetricRequirement(companyId, metricToCheck, valueContrib);
  }

  // Weight Limit Check
  if (
    input.weightPercent &&
    (input.contributesToScore ?? kr.contributes_to_objective_score)
  ) {
    await checkWeightLimit(
      kr.employee_objective_id,
      "EMPLOYEE",
      input.weightPercent,
      id,
    );
  }

  // Metric Check against parent KR
  const metricToCheck =
    input.metricDefinitionId !== undefined
      ? input.metricDefinitionId
      : kr.metric_definition_id;
  const empObj = await prisma.employeeObjective.findFirst({
    where: { id: kr.employee_objective_id, company_id: companyId },
  });
  if (
    (empObj?.chosen_parent_kr_id ||
      (empObj as any)?.chosen_parent_employee_kr_id) &&
    metricToCheck
  ) {
    let parentMetricId: number | null = null;
    if (empObj?.chosen_parent_kr_id) {
      const parentKr = await prisma.companyKeyResult.findUnique({
        where: { id: empObj.chosen_parent_kr_id },
        select: { metric_definition_id: true },
      });
      parentMetricId = parentKr?.metric_definition_id || null;
    } else if ((empObj as any)?.chosen_parent_employee_kr_id) {
      const parentKr = await prisma.employeeKeyResult.findUnique({
        where: { id: (empObj as any).chosen_parent_employee_kr_id },
        select: { metric_definition_id: true },
      });
      parentMetricId = parentKr?.metric_definition_id || null;
    }

    if (parentMetricId) {
      await validateMetricAlignment(companyId, parentMetricId, metricToCheck);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.employeeKeyResult.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        metric_definition_id: input.metricDefinitionId,
        unit_of_measure: input.unitOfMeasure,
        target_value: input.targetValue,
        current_value: input.currentValue,
        weight_percent: input.weightPercent,
        contributes_to_objective_score: input.contributesToScore,
        contributes_to_objective_value: input.contributesToValue,
        is_mandatory_for_completion: input.isMandatory,
      },
      include: { metricDefinition: true },
    });

    if (input.contributorUserIds !== undefined) {
      // Sync contributors: delete those not in the new list, add those not in the old list
      const currentContributors = await tx.krContributor.findMany({
        where: { employee_kr_id: id },
        select: { user_id: true },
      });
      const currentIds = currentContributors.map((c) => c.user_id);
      const newIds = input.contributorUserIds;

      const toDelete = currentIds.filter((cid) => !newIds.includes(cid));
      const toAdd = newIds.filter((nid) => !currentIds.includes(nid));

      if (toDelete.length > 0) {
        const adopted = await tx.krContributor.findMany({
          where: { employee_kr_id: id, user_id: { in: toDelete } },
          include: { employeeObjectives: true },
        });

        const adoptedIds = adopted
          .filter((c) => !!c.employeeObjectives)
          .map((c) => c.user_id);

        if (adoptedIds.length > 0) {
          throw new Error(
            `Cannot unassign users who have already adopted this KR: ${adoptedIds.join(", ")}`,
          );
        }

        await tx.krContributor.deleteMany({
          where: { employee_kr_id: id, user_id: { in: toDelete } },
        });
      }

      for (const nid of toAdd) {
        await tx.krContributor.create({
          data: {
            company_id: companyId,
            employee_kr_id: id,
            user_id: nid,
            role_type: "EMPLOYEE",
            is_required_for_completion: true,
            status_code: "active",
            assigned_by: (input as any).createdBy || "system", // Fallback if createdBy not passed
          },
        });
      }
    }

    return res;
  });

  await syncEmployeeObjectiveValueColumns(kr.employee_objective_id, companyId);

  return updated;
}

export async function deleteEmployeeKR(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Employee key result not found.");
  if (kr.status_code !== "draft") {
    throw new Error("Only draft key results can be deleted.");
  }

  await prisma.employeeKeyResult.delete({ where: { id } });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: id,
    actorId,
    action: "employee_kr_deleted",
    description: `Employee KR "${kr.title}" deleted`,
  });

  await syncEmployeeObjectiveValueColumns(kr.employee_objective_id, companyId);

  return { deleted: true };
}

export async function listEmployeeKRs(
  employeeObjectiveId: number,
  companyId: number,
) {
  const krs = await prisma.employeeKeyResult.findMany({
    where: {
      employee_objective_id: employeeObjectiveId,
      company_id: companyId,
    },
    orderBy: { created_at: "asc" },
    include: {
      metricDefinition: true,
      progressUpdates: {
        take: 1,
        orderBy: { created_at: "desc" },
      },
      _count: {
        select: {
          monthPlanItems: true,
          weeklyPlans: true,
          subtasks: true,
          progressUpdates: true,
        },
      },
    },
  });

  // Since approvalLogs is polymorphic, we fetch the latest log for each KR manually
  const krIds = krs.map((k) => k.id);
  const logs = await prisma.okrApprovalLog.findMany({
    where: {
      company_id: companyId,
      entity_type: "EMPLOYEE_KR",
      entity_id: { in: krIds },
    },
    orderBy: { action_date: "desc" },
  });

  return krs.map((k) => {
    const latestLog = logs.find((l) => l.entity_id === k.id);
    return {
      ...k,
      approvalLogs: latestLog ? [latestLog] : [],
    };
  });
}

// ─── Employee Month Plans ─────────────────────────────────────────────────────

interface MonthPlanItemInput {
  employeeKrId: number;
  title: string;
  targetValue: number;
  currentValue: number;
  parentMonthPlanItemId?: number;
  note?: string;
}

interface CreateEmpMonthPlanInput {
  companyId: number;
  employeeObjectiveId: number;
  monthNumber: number;
  title: string;
  description?: string;
  items: MonthPlanItemInput[];
  createdBy: string;
  actorRole?: string;
}

export async function createEmployeeMonthPlan(input: CreateEmpMonthPlanInput) {
  // 1. Validate the employee objective exists and is in actionable state
  const empObj = await prisma.employeeObjective.findFirst({
    where: { id: input.employeeObjectiveId, company_id: input.companyId },
    include: { cycle: true },
  });
  if (!empObj) throw new Error("Employee objective not found.");
  if (!["draft", "approved", "published"].includes(empObj.status_code)) {
    throw new Error(
      "Employee objective must be at least in draft or approved state before planning.",
    );
  }

  // 3. Validate no existing plan for this (month_number, objective) pair
  const existingPlan = await prisma.employeeMonthPlan.findUnique({
    where: {
      month_number_employee_objective_id: {
        month_number: input.monthNumber,
        employee_objective_id: input.employeeObjectiveId,
      },
    },
  });
  if (existingPlan) {
    throw new Error(
      "A monthly plan already exists for this month and objective.",
    );
  }

  // 4. Validate items are not empty
  if (!input.items || input.items.length === 0) {
    throw new Error(
      "At least one key result item must be selected for the monthly plan.",
    );
  }

  // 5. Validate all item KRs belong to this objective
  const validKrs = await prisma.employeeKeyResult.findMany({
    where: {
      employee_objective_id: input.employeeObjectiveId,
      company_id: input.companyId,
    },
    select: {
      id: true,
      title: true,
      employeeObjective: { select: { chosen_parent_employee_kr_id: true } },
    },
  });
  const validKrIds = new Set(validKrs.map((k) => k.id));
  for (const item of input.items) {
    if (!validKrIds.has(item.employeeKrId)) {
      throw new Error(
        `Key result ${item.employeeKrId} does not belong to this employee objective.`,
      );
    }
  }

  // 6. Multiple items per KR are now allowed — no duplicate check needed

  // 7. Calculate aggregate target (no dept target to check against anymore)
  const itemTotal = input.items.reduce((sum, i) => sum + i.targetValue, 0);

  // 8. Hierarchical Planning Validation (Manager must plan first)
  const parentKrIds = validKrs
    .map((k) => k.employeeObjective?.chosen_parent_employee_kr_id)
    .filter((id): id is number => !!id);

  if (parentKrIds.length > 0) {
    // Use the EmployeeMonthPlan alignment — check that each item has a valid parent_employee_month_plan_item_id
    const { validateMonthlyAlignment } =
      await import("src/services/okrManagerPlanService");
    for (const item of input.items) {
      await validateMonthlyAlignment(
        input.employeeObjectiveId,
        item.parentMonthPlanItemId ?? null,
        input.companyId,
      );
    }
  }

  // 9. Planning cadence enforcement
  await validatePlanningCadence(
    input.companyId,
    empObj.cycle_id,
    undefined,
    "MONTHLY",
    input.actorRole,
  );

  // 9. Create plan header + items in a single transaction
  const plan = await prisma.$transaction(async (tx) => {
    const header = await tx.employeeMonthPlan.create({
      data: {
        company_id: input.companyId,
        month_number: input.monthNumber,
        employee_objective_id: input.employeeObjectiveId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status_code: "draft",
        created_by: input.createdBy,
      },
    });

    await tx.employeeMonthPlanItem.createMany({
      data: input.items.map((item) => ({
        company_id: input.companyId,
        employee_month_plan_id: header.id,
        employee_kr_id: item.employeeKrId,
        title: item.title?.trim() || "Untitled",
        target_value: item.targetValue,
        current_value: item.currentValue,
        parent_employee_month_plan_item_id: item.parentMonthPlanItemId || null,
        note: item.note,
      })),
    });

    return tx.employeeMonthPlan.findUnique({
      where: { id: header.id },
      include: {
        items: {
          include: {
            employeeKr: {
              select: { id: true, title: true, target_value: true },
            },
          },
        },
      },
    });
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "EMPLOYEE_MONTH_PLAN",
    entityId: plan!.id,
    actorId: input.createdBy,
    action: "employee_month_plan_created",
    description: `Monthly plan "${input.title}" created for Month ${input.monthNumber}`,
    metadata: {
      month_number: input.monthNumber,
      employee_objective_id: input.employeeObjectiveId,
      item_count: input.items.length,
      total_target: itemTotal,
    },
  });

  for (const item of input.items) {
    await syncEmployeeKrValueColumns(item.employeeKrId, input.companyId);
  }
  await syncEmployeeObjectiveValueColumns(
    input.employeeObjectiveId,
    input.companyId,
  );

  // Perform rollup in the background to avoid blocking the response
  tryRollupEmployeeObjective(
    input.employeeObjectiveId,
    "employee month plan creation",
  ).catch((err) => console.error("Background rollup failed:", err));

  const alignment = await checkMonthlyAlignment(
    input.employeeObjectiveId,
    input.monthNumber,
    input.companyId,
  );

  return { ...plan, alignment };
}

export async function createOrUpdateKRMonthPlan(input: {
  companyId: number;
  employeeKrId: number;
  monthNumber: number;
  targetValue: number;
  currentValue: number;
  description?: string;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  weightPercent?: number;
  createdBy: string;
  actorRole?: string;
}) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: { employeeObjective: true },
  });
  if (!kr) throw new Error("Key result not found.");

  if (
    !["draft", "approved", "published"].includes(
      kr.employeeObjective.status_code,
    )
  ) {
    throw new Error(
      "Employee objective must be at least in draft or approved state before planning.",
    );
  }

  // Hierarchical Planning Dependency: Check if manager has planned for this month
  const parentKrId = kr.employeeObjective.chosen_parent_employee_kr_id;
  if (parentKrId) {
    const managerPlanItem = await prisma.employeeMonthPlanItem.findFirst({
      where: {
        employee_kr_id: parentKrId,
        monthPlan: {
          month_number: input.monthNumber,
          // We don't strictly enforce manager status here,
          // but the plan must at least exist.
        },
      },
      include: { monthPlan: true },
    });

    if (!managerPlanItem) {
      throw new Error(
        `Manager has not yet planned for Month ${input.monthNumber}. Please wait for your manager to complete their planning.`,
      );
    }
  }

  // Check if a plan already exists for this objective and month
  let plan = await prisma.employeeMonthPlan.findUnique({
    where: {
      month_number_employee_objective_id: {
        month_number: input.monthNumber,
        employee_objective_id: kr.employee_objective_id,
      },
    },
    include: { items: true },
  });

  if (!plan) {
    // Create new plan header
    plan = (await prisma.$transaction(async (tx) => {
      const header = await tx.employeeMonthPlan.create({
        data: {
          company_id: input.companyId,
          month_number: input.monthNumber,
          employee_objective_id: kr.employee_objective_id,
          title: `Month ${input.monthNumber} Planning`,
          description:
            input.description || `Planning for Month ${input.monthNumber}`,
          status_code: "draft",
          created_by: input.createdBy,
        },
      });
      return tx.employeeMonthPlan.findUnique({
        where: { id: header.id },
        include: { items: true },
      });
    })) as any;
  }

  if (!plan) throw new Error("Failed to create or find monthly plan.");

  // Check if item already exists in the plan
  const existingItem = plan.items.find(
    (i) => i.employee_kr_id === input.employeeKrId,
  );

  if (existingItem) {
    await prisma.employeeMonthPlanItem.update({
      where: { id: existingItem.id },
      data: {
        target_value: input.targetValue,
        current_value: input.currentValue,
        note: input.description,
      },
    });
  } else {
    await prisma.employeeMonthPlanItem.create({
      data: {
        company_id: input.companyId,
        employee_month_plan_id: plan.id,
        employee_kr_id: input.employeeKrId,
        target_value: input.targetValue,
        current_value: input.currentValue,
        note: input.description,
      },
    });
  }

  await syncEmployeeKrValueColumns(input.employeeKrId, input.companyId);
  await syncEmployeeObjectiveValueColumns(
    kr.employee_objective_id,
    input.companyId,
  );

  tryRollupEmployeeObjective(
    kr.employee_objective_id,
    "employee month plan item update",
  ).catch((err) => console.error("Background rollup failed:", err));

  const alignment = await checkMonthlyAlignment(
    kr.employee_objective_id,
    input.monthNumber,
    input.companyId,
  );

  return {
    ...(await prisma.employeeMonthPlan.findUnique({
      where: { id: plan.id },
      include: {
        items: {
          include: {
            employeeKr: {
              select: { id: true, title: true, target_value: true },
            },
          },
        },
      },
    })),
    alignment,
  };
}

async function checkMonthlyAlignment(
  objectiveId: number,
  monthNumber: number,
  companyId: number,
) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: objectiveId },
    select: { chosen_parent_employee_kr_id: true },
  });

  if (!objective?.chosen_parent_employee_kr_id) return null;

  const parentKrId = objective.chosen_parent_employee_kr_id;

  // 1. Get manager's target for this month
  const managerItem = await prisma.employeeMonthPlanItem.findFirst({
    where: {
      employee_kr_id: parentKrId,
      monthPlan: {
        month_number: monthNumber,
        company_id: companyId,
      },
    },
    select: { target_value: true },
  });

  if (!managerItem) return null;

  // 2. Sum up all subordinates' targets for this manager's KR in this month
  const siblingItems = await prisma.employeeMonthPlanItem.findMany({
    where: {
      monthPlan: {
        month_number: monthNumber,
        company_id: companyId,
      },
      employeeKr: {
        employeeObjective: {
          chosen_parent_employee_kr_id: parentKrId,
        },
      },
    },
    select: { target_value: true },
  });

  const totalPlanned = siblingItems.reduce(
    (sum, item) => sum + Number(item.target_value),
    0,
  );
  const managerTarget = Number(managerItem.target_value);

  return {
    managerTarget,
    totalPlanned,
    isAligned: totalPlanned >= managerTarget,
    gap: Math.max(0, managerTarget - totalPlanned),
  };
}

export async function addMonthPlanItem(
  planId: number,
  companyId: number,
  item: MonthPlanItemInput,
  actorId: string,
) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id: planId, company_id: companyId },
    include: {
      items: true,
    },
  });
  if (!plan) throw new Error("Employee month plan not found.");
  if (plan.status_code !== "draft")
    throw new Error("Only draft plans can be modified.");

  // Validate KR belongs to the objective
  const kr = await prisma.employeeKeyResult.findFirst({
    where: {
      id: item.employeeKrId,
      employee_objective_id: plan.employee_objective_id,
      company_id: companyId,
    },
  });
  if (!kr) throw new Error("Key result does not belong to this objective.");

  // Multiple items per KR are now allowed — no duplicate check needed

  // Alignment validation for non-dept-heads
  if (item.parentMonthPlanItemId) {
    const { validateMonthlyAlignment } =
      await import("src/services/okrManagerPlanService");
    await validateMonthlyAlignment(
      plan.employee_objective_id,
      item.parentMonthPlanItemId,
      companyId,
    );
  }

  const newItem = await prisma.employeeMonthPlanItem.create({
    data: {
      company_id: companyId,
      employee_month_plan_id: planId,
      employee_kr_id: item.employeeKrId,
      title: item.title?.trim() || "Untitled",
      target_value: item.targetValue,
      current_value: item.currentValue,
      parent_employee_month_plan_item_id: item.parentMonthPlanItemId || null,
      note: item.note,
    },
    include: { employeeKr: { select: { id: true, title: true } } },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_MONTH_PLAN_ITEM",
    entityId: newItem.id,
    actorId,
    action: "month_plan_item_added",
    description: `KR "${kr.title}" (target: ${item.targetValue}) added to month plan ${planId}`,
  });

  await syncEmployeeKrValueColumns(item.employeeKrId, companyId);
  await syncEmployeeObjectiveValueColumns(
    plan.employee_objective_id,
    companyId,
  );

  tryRollupEmployeeObjective(
    plan.employee_objective_id,
    "employee month plan item added",
  ).catch((err) => console.error("Background rollup failed:", err));

  return newItem;
}

export async function removeMonthPlanItem(
  planId: number,
  itemId: number,
  companyId: number,
  actorId: string,
) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id: planId, company_id: companyId },
    include: { items: true },
  });
  if (!plan) throw new Error("Employee month plan not found.");
  if (plan.status_code !== "draft")
    throw new Error("Only draft plans can be modified.");

  const item = plan.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Plan item not found.");

  if (plan.items.length <= 1) {
    throw new Error(
      "Cannot remove the last item. A plan must have at least one key result.",
    );
  }

  await prisma.employeeMonthPlanItem.delete({ where: { id: itemId } });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_MONTH_PLAN_ITEM",
    entityId: itemId,
    actorId,
    action: "month_plan_item_removed",
    description: `KR item ${itemId} removed from month plan ${planId}`,
  });

  await syncEmployeeKrValueColumns(item.employee_kr_id, companyId);
  await syncEmployeeObjectiveValueColumns(
    plan.employee_objective_id,
    companyId,
  );

  tryRollupEmployeeObjective(
    plan.employee_objective_id,
    "employee month plan item removed",
  ).catch((err) => console.error("Background rollup failed:", err));

  return { deleted: true };
}

export async function updateEmployeeMonthPlan(
  id: number,
  companyId: number,
  input: {
    title?: string;
    description?: string;
  },
) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id, company_id: companyId },
    include: { employeeObjective: { select: { id: true } } },
  });
  if (!plan) throw new Error("Employee month plan not found.");
  if (plan.status_code !== "draft")
    throw new Error("Only draft month plans can be edited.");

  const updated = await prisma.employeeMonthPlan.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      description: input.description?.trim(),
    },
    include: {
      items: {
        include: {
          employeeKr: { select: { id: true, title: true, target_value: true } },
        },
      },
    },
  });

  tryRollupEmployeeObjective(
    plan.employeeObjective.id,
    "employee month plan update",
  ).catch((err) => console.error("Background rollup failed:", err));

  return updated;
}

export async function deleteEmployeeMonthPlan(id: number, companyId: number) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id, company_id: companyId },
    select: { employee_objective_id: true, status_code: true },
  });
  if (!plan) throw new Error("Employee month plan not found.");
  if (plan.status_code !== "draft")
    throw new Error("Only draft month plans can be deleted.");

  await prisma.employeeMonthPlan.delete({ where: { id } });

  await tryRollupEmployeeObjective(
    plan.employee_objective_id,
    "employee month plan delete",
  );

  return { deleted: true };
}

export async function listEmployeeMonthPlans(
  employeeObjectiveId: number,
  companyId: number,
) {
  const plans = await prisma.employeeMonthPlan.findMany({
    where: {
      employee_objective_id: employeeObjectiveId,
      company_id: companyId,
    },
    orderBy: { created_at: "asc" },
    include: {
      items: {
        include: {
          employeeKr: {
            select: {
              id: true,
              title: true,
              target_value: true,
              status_code: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });

  // Add alignment metadata to each plan
  const plansWithAlignment = await Promise.all(
    plans.map(async (p) => {
      const alignment = await checkMonthlyAlignment(
        p.employee_objective_id,
        p.month_number,
        companyId,
      );
      return { ...p, alignment };
    }),
  );

  return plansWithAlignment;
}

export async function listEmployeeKRMonthPlans(
  krId: number,
  companyId: number,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: krId, company_id: companyId },
    select: { employee_objective_id: true },
  });
  if (!kr) throw new Error("Key result not found.");

  return listEmployeeMonthPlans(kr.employee_objective_id, companyId);
}

// ─── Weekly Plans ─────────────────────────────────────────────────────────────

export interface WeeklyTaskInput {
  title: string;
  targetValue?: number;
  currentValue?: number;
  status_code?: string;
}

interface CreateWeeklyPlanInput {
  companyId: number;
  employeeKrId: number;
  employeeMonthPlanId: number;
  weekNumber: number;
  metricDefinitionId?: number;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  blockers?: string;
  title?: string;
  employeeMonthPlanItemId?: number;
  parentWeeklyPlanId?: number;
  parentWeeklyTaskId?: number;
  tasks?: WeeklyTaskInput[];
  createdBy: string;
  actorRole?: string;
}

interface WeeklyPlanItemInput {
  employeeKrId: number;
  employeeMonthPlanItemId?: number;
  targetValue: number;
  currentValue: number;
  metricDefinitionId?: number;
  blockers?: string;
  parentWeeklyTaskId?: number;
  tasks?: WeeklyTaskInput[];
}

interface CreateWeeklyPlansInput {
  companyId: number;
  employeeMonthPlanId: number;
  weekNumber: number;
  title?: string;
  description?: string;
  items: WeeklyPlanItemInput[];
  createdBy: string;
  actorRole?: string;
}

export async function createWeeklyPlan(input: CreateWeeklyPlanInput) {
  const empKr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: { employeeObjective: true },
  });
  if (!empKr) throw new Error("Employee key result not found.");
  if (!["approved", "published"].includes(empKr.status_code)) {
    throw new Error("Employee key result must be approved before planning.");
  }

  await validateNotArchived(
    input.companyId,
    empKr.employee_objective_id,
    "EMPLOYEE",
  );

  await validatePlanningCadence(
    input.companyId,
    empKr.employeeObjective.cycle_id,
    undefined,
    "WEEKLY",
    input.actorRole,
  );
  await validateWeeklyPlanDependencies(
    input.companyId,
    empKr.employeeObjective.cycle_id,
    undefined,
    input.employeeMonthPlanId,
  );

  if (input.weekNumber < 1 || input.weekNumber > 13) {
    throw new Error("week_number must be between 1 and 13.");
  }

  // B3: Sequential planning gate - verify week sequence
  await validateWeekSequence(input.employeeKrId, input.weekNumber);

  // B3b: Manager weekly alignment validation
  // If a parentWeeklyTaskId is provided, resolve the parent plan ID from the task
  let resolvedParentPlanId = input.parentWeeklyPlanId ?? null;
  if (input.parentWeeklyTaskId) {
    const parentTask = await prisma.weeklyTask.findUnique({
      where: { id: input.parentWeeklyTaskId },
      select: { weekly_plan_id: true },
    });
    if (!parentTask) {
      throw new Error("The referenced manager weekly task does not exist.");
    }
    resolvedParentPlanId = parentTask.weekly_plan_id;
  }

  if (empKr.employeeObjective.chosen_parent_employee_kr_id) {
    const { validateWeeklyAlignment } =
      await import("src/services/okrManagerPlanService");
    await validateWeeklyAlignment(
      empKr.employee_objective_id,
      resolvedParentPlanId,
      input.companyId,
    );
  }

  // Validate monthly plan exists and KR is in its items
  const monthPlan = await prisma.employeeMonthPlan.findFirst({
    where: { id: input.employeeMonthPlanId, company_id: input.companyId },
    include: { items: true },
  });
  if (!monthPlan) throw new Error("Linked month plan not found.");
  if (monthPlan.employee_objective_id !== empKr.employee_objective_id) {
    throw new Error("Month plan does not belong to this objective.");
  }
  const itemForKr = monthPlan.items.find(
    (i) => i.employee_kr_id === input.employeeKrId,
  );
  if (!itemForKr) {
    throw new Error(
      `Key result ${input.employeeKrId} is not selected in this monthly plan. Add it to the monthly plan first.`,
    );
  }

  const existing = await prisma.weeklyPlan.findFirst({
    where: {
      employee_kr_id: input.employeeKrId,
      employee_month_plan_id: input.employeeMonthPlanId,
      week_number: input.weekNumber,
      employee_month_plan_item_id: input.employeeMonthPlanItemId || null,
    },
  });

  const otherWeeks = await prisma.weeklyPlan.findMany({
    where: {
      employee_kr_id: input.employeeKrId,
      employee_month_plan_id: input.employeeMonthPlanId,
      id: { not: existing?.id },
    },
    select: { target_value: true },
  });

  const currentWeeklySum = otherWeeks.reduce(
    (sum, w) => sum + Number(w.target_value || 0),
    0,
  );
  const newTarget = input.targetValue || 0;
  const totalPlanned = currentWeeklySum + newTarget;
  const monthlyTarget = Number(itemForKr.target_value);
  const isLastWeek = input.weekNumber % 4 === 0 || input.weekNumber === 13; // Simple heuristic for month-end

  // Calculate aggregated values from tasks
  const tasksToCreate =
    input.tasks && input.tasks.length > 0
      ? input.tasks
      : [
        {
          title: input.title || "Weekly Tasks",
          targetValue: input.targetValue || 0,
          currentValue: input.currentValue || 0,
        },
      ];

  const totalTarget = tasksToCreate.reduce(
    (sum, t) => sum + (t.targetValue || 0),
    0,
  );
  const totalCurrent = tasksToCreate.reduce(
    (sum, t) => sum + (t.currentValue || 0),
    0,
  );

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: empKr.employeeObjective.cycle_id,
    targetValue: totalTarget,
    currentValue: totalCurrent,
  });

  if (existing) {
    if (
      (measurement.confidenceLevel === "AT_RISK" ||
        measurement.confidenceLevel === "OFF_TRACK") &&
      (!input.blockers || input.blockers.trim() === "")
    ) {
      throw new Error(
        `Confidence level '${measurement.confidenceLevel}' requires a detailed 'blockers' explanation.`,
      );
    }

    const plan = await prisma.weeklyPlan.update({
      where: { id: existing.id },
      data: {
        confidence_level: measurement.confidenceLevel,
        blockers: input.blockers,
        employee_month_plan_id: input.employeeMonthPlanId,
        employee_month_plan_item_id: input.employeeMonthPlanItemId,
        metric_definition_id: input.metricDefinitionId,
        target_value: totalTarget,
        current_value: totalCurrent,
        weight_percent: input.weightPercent,
        contributes_to_parent_score: input.contributesToParentScore,
        contributes_to_parent_value: input.contributesToParentValue,
      } as any,
    });

    await tryRollupEmployeeObjective(
      empKr.employee_objective_id,
      "employee weekly plan upsert",
    );

    return plan;
  }

  if (
    measurement.confidenceLevel === "AT_RISK" ||
    measurement.confidenceLevel === "OFF_TRACK"
  ) {
    if (!input.blockers || input.blockers.trim() === "") {
      throw new Error(
        `Confidence level '${measurement.confidenceLevel}' requires a detailed 'blockers' explanation.`,
      );
    }
  }

  const plan = await prisma.weeklyPlan.create({
    data: {
      company_id: input.companyId,
      employee_kr_id: input.employeeKrId,
      employee_month_plan_id: input.employeeMonthPlanId,
      employee_month_plan_item_id: input.employeeMonthPlanItemId,
      week_number: input.weekNumber,
      metric_definition_id: input.metricDefinitionId,
      target_value: totalTarget,
      current_value: totalCurrent,
      weight_percent: input.weightPercent,
      contributes_to_parent_score: input.contributesToParentScore ?? true,
      contributes_to_parent_value: input.contributesToParentValue ?? true,
      status_code: "draft",
      confidence_level: measurement.confidenceLevel,
      blockers: input.blockers,
      title: input.title,
      parent_weekly_plan_id: resolvedParentPlanId || null,
      parent_weekly_task_id: input.parentWeeklyTaskId || null,
      created_by: input.createdBy,
      tasks: {
        create: tasksToCreate.map((task) => ({
          company_id: input.companyId,
          title: task.title,
          target_value: task.targetValue,
          current_value: task.currentValue || 0,
          status_code: "draft",
        })),
      },
    } as any,
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "WEEKLY_PLAN",
    entityId: plan.id,
    actorId: input.createdBy,
    action: "weekly_plan_created",
    description: `Week ${input.weekNumber} plan created for employee KR "${empKr.title}"`,
  });

  await tryRollupEmployeeObjective(
    empKr.employee_objective_id,
    "employee weekly plan creation",
  );

  return plan;
}

export async function updateWeeklyPlan(
  id: number,
  companyId: number,
  input: {
    blockers?: string;
    employeeMonthPlanId?: number;
    metricDefinitionId?: number;
    targetValue?: number;
    currentValue?: number;
    weightPercent?: number;
    contributesToParentScore?: boolean;
    contributesToParentValue?: boolean;
    tasks?: WeeklyTaskInput[];
  },
) {
  const plan = await prisma.weeklyPlan.findFirst({
    where: { id, company_id: companyId },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            select: { cycle_id: true },
          },
        },
      },
    },
  });
  if (!plan) throw new Error("Weekly plan not found.");

  await validateNotArchived(
    companyId,
    plan.employeeKr.employee_objective_id,
    "EMPLOYEE",
  );

  // If tasks are provided, calculate totals
  let totalTarget = input.targetValue;
  let totalCurrent = input.currentValue;

  if (input.tasks && input.tasks.length > 0) {
    totalTarget = input.tasks.reduce((sum, t) => sum + (t.targetValue || 0), 0);
    totalCurrent = input.tasks.reduce(
      (sum, t) => sum + (t.currentValue || 0),
      0,
    );
  }

  const measurement = await computeMeasurementSnapshot({
    companyId,
    cycleId: plan.employeeKr.employeeObjective.cycle_id,
    targetValue:
      totalTarget !== undefined
        ? totalTarget
        : plan.target_value
          ? Number(plan.target_value)
          : null,
    currentValue:
      totalCurrent !== undefined
        ? totalCurrent
        : plan.current_value
          ? Number(plan.current_value)
          : null,
  });

  if (
    (measurement.confidenceLevel === "AT_RISK" ||
      measurement.confidenceLevel === "OFF_TRACK") &&
    (!input.blockers || input.blockers.trim() === "")
  ) {
    throw new Error(
      `Confidence level '${measurement.confidenceLevel}' requires a detailed 'blockers' explanation.`,
    );
  }

  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: {
      confidence_level: measurement.confidenceLevel as any,
      blockers: input.blockers,
      employee_month_plan_id: input.employeeMonthPlanId,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      contributes_to_parent_score: input.contributesToParentScore,
      contributes_to_parent_value: input.contributesToParentValue,
      tasks: input.tasks
        ? {
          deleteMany: {},
          create: input.tasks.map((t) => ({
            title: t.title,
            target_value: t.targetValue,
            current_value: t.currentValue || 0,
            company_id: companyId,
            status_code: "draft",
          })),
        }
        : undefined,
    } as any,
  });

  await syncCurrentValueCascadeFromWeeklyPlan(id);

  return updated;
}

export async function deleteWeeklyPlan(id: number, companyId: number) {
  const plan = await prisma.weeklyPlan.findFirst({
    where: { id, company_id: companyId },
    include: { employeeKr: true },
  });
  if (!plan) throw new Error("Weekly plan not found.");

  await validateNotArchived(
    companyId,
    plan.employeeKr.employee_objective_id,
    "EMPLOYEE",
  );

  if (plan.status_code !== "draft")
    throw new Error("Only draft weekly plans can be deleted.");

  await prisma.weeklyPlan.delete({ where: { id } });

  await tryRollupEmployeeObjective(
    plan.employeeKr.employee_objective_id,
    "employee weekly plan delete",
  );

  return { deleted: true };
}

export async function listWeeklyPlans(employeeKrId: number, companyId: number) {
  const plans = await prisma.weeklyPlan.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { week_number: "asc" },
    include: {
      employeeKr: { select: { title: true } },
      tasks: {
        include: {
          dailyPlans: { orderBy: { created_at: "asc" } },
          _count: { select: { dailyPlans: true } },
        },
      },
    },
  });

  // Fallback target_value from task to daily plan for UI consistency
  return plans.map((w: any) => ({
    ...w,
    tasks: (w.tasks || []).map((t: any) => ({
      ...t,
      dailyPlans: (t.dailyPlans || []).map((dp: any) => ({
        ...dp,
        task_title: t.title,
        target_value:
          dp.target_value && Number(dp.target_value) > 0
            ? dp.target_value
            : t.target_value || 0,
      })),
    })),
  }));
}

export async function createWeeklyPlans(input: CreateWeeklyPlansInput) {
  const results = [];
  for (const item of input.items) {
    const plan = await createWeeklyPlan({
      companyId: input.companyId,
      employeeKrId: item.employeeKrId,
      employeeMonthPlanItemId: item.employeeMonthPlanItemId,
      employeeMonthPlanId: input.employeeMonthPlanId,
      weekNumber: input.weekNumber,
      metricDefinitionId: item.metricDefinitionId,
      targetValue: item.targetValue,
      currentValue: item.currentValue,
      blockers: item.blockers || input.description,
      parentWeeklyTaskId: item.parentWeeklyTaskId,
      tasks: item.tasks,
      createdBy: input.createdBy,
      actorRole: input.actorRole,
    });
    results.push(plan);
  }

  return results;
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

interface CreateSubtaskInput {
  companyId: number;
  employeeKrId: number;
  title: string;
  description?: string;
  metricDefinitionId?: number;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  targetMonth?: number;
  targetWeek?: number;
  sequenceOrder?: number;
  createdBy: string;
}

export async function createSubtask(input: CreateSubtaskInput) {
  const empKr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: {
      employeeObjective: { select: { cycle_id: true } },
    },
  });
  if (!empKr) throw new Error("Employee key result not found.");
  if (!["approved", "published"].includes(empKr.status_code)) {
    throw new Error("Employee key result must be approved before execution.");
  }

  await validateNotArchived(
    input.companyId,
    empKr.employee_objective_id,
    "EMPLOYEE",
  );

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: empKr.employeeObjective.cycle_id,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
  });

  const subtask = await prisma.subtask.create({
    data: {
      company_id: input.companyId,
      employee_kr_id: input.employeeKrId,
      title: input.title,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      contributes_to_parent_score: input.contributesToParentScore ?? true,
      contributes_to_parent_value: input.contributesToParentValue ?? true,
      status_code: "todo",
      target_month: input.targetMonth,
      target_week: input.targetWeek,
      sequence_order: input.sequenceOrder ?? 0,
      created_by: input.createdBy,
    } as any,
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "SUBTASK",
    entityId: subtask.id,
    actorId: input.createdBy,
    action: "subtask_created",
    description: `Subtask "${subtask.title}" created for employee KR "${empKr.title}"`,
  });

  await tryRollupEmployeeObjective(
    empKr.employee_objective_id,
    "subtask creation",
  );

  return subtask;
}

export async function updateSubtask(
  id: number,
  companyId: number,
  input: Partial<CreateSubtaskInput> & {
    statusCode?: string;
  },
) {
  const subtask = await prisma.subtask.findFirst({
    where: { id, company_id: companyId },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            select: { cycle_id: true },
          },
        },
      },
    },
  });
  if (!subtask) throw new Error("Subtask not found.");

  await validateNotArchived(
    companyId,
    subtask.employeeKr.employee_objective_id,
    "EMPLOYEE",
  );

  const measurement = await computeMeasurementSnapshot({
    companyId,
    cycleId: subtask.employeeKr.employeeObjective.cycle_id,
    targetValue:
      input.targetValue !== undefined
        ? input.targetValue
        : subtask.target_value
          ? Number(subtask.target_value)
          : null,
    currentValue:
      input.currentValue !== undefined
        ? input.currentValue
        : subtask.current_value
          ? Number(subtask.current_value)
          : null,
  });

  const updated = await prisma.subtask.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      contributes_to_parent_score: input.contributesToParentScore,
      contributes_to_parent_value: input.contributesToParentValue,
      status_code: input.statusCode,
      target_month: input.targetMonth,
      target_week: input.targetWeek,
      sequence_order: input.sequenceOrder,
      completed_at: input.statusCode === "completed" ? new Date() : undefined,
    } as any,
  });

  await tryRollupEmployeeObjective(
    subtask.employeeKr.employee_objective_id,
    "subtask update",
  );

  return updated;
}

export async function deleteSubtask(id: number, companyId: number) {
  const subtask = await prisma.subtask.findFirst({
    where: { id, company_id: companyId },
    include: {
      employeeKr: {
        select: { employee_objective_id: true },
      },
    },
  });
  if (!subtask) throw new Error("Subtask not found.");

  await prisma.subtask.delete({ where: { id } });

  await tryRollupEmployeeObjective(
    subtask.employeeKr.employee_objective_id,
    "subtask delete",
  );

  return { deleted: true };
}

export async function listSubtasks(employeeKrId: number, companyId: number) {
  return prisma.subtask.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { sequence_order: "asc" },
  });
}

// ─── Daily Plans ───────────────────────────────────────────────────────────────

interface CreateDailyPlanInput {
  companyId: number;
  weeklyTaskId: number;
  title: string;
  weeklyTaskRef?: string;
  completionDay:
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
  description?: string;
  metricDefinitionId?: number;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  createdBy: string;
}

async function resolveWeeklyTaskRefForDailyPlan(params: {
  companyId: number;
  employeeKrId: number;
  weekNumber: number;
  weeklyTaskRef: string;
}) {
  const normalized = params.weeklyTaskRef.trim();
  // if (!normalized) {
  //   throw new Error("weekly_task_ref is required for daily plans.");
  // }

  // We no longer strictly require a matching subtask to exist.
  // This allows for flexible daily planning without pre-defined subtasks.
  return normalized;
}

interface DailyPlanItemInput {
  weeklyTaskId: number;
  targetValue: number;
  currentValue: number;
  metricDefinitionId?: number;
}

interface CreateDailyPlansInput {
  companyId: number;
  completionDay: string;
  title?: string;
  description?: string;
  weeklyTaskRef?: string;
  items: DailyPlanItemInput[];
  createdBy: string;
  actorRole?: string;
}

export async function createDailyPlan(input: CreateDailyPlanInput) {
  if (!input.completionDay) {
    throw new Error("completion_day is required for daily plans.");
  }

  const task = await prisma.weeklyTask.findFirst({
    where: { id: input.weeklyTaskId, company_id: input.companyId },
    include: {
      weeklyPlan: {
        include: {
          employeeKr: {
            include: {
              employeeObjective: {
                select: { cycle_id: true },
              },
            },
          },
        },
      },
    },
  });
  if (!task) throw new Error("Weekly task not found.");
  const plan = task.weeklyPlan;

  const normalizedWeeklyTaskRef = await resolveWeeklyTaskRefForDailyPlan({
    companyId: input.companyId,
    employeeKrId: plan.employee_kr_id,
    weekNumber: plan.week_number,
    weeklyTaskRef: input.weeklyTaskRef || "",
  });

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: plan.employeeKr.employeeObjective.cycle_id,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
  });

  // Target Consumption Validation: Ensure sum of daily targets aligns with weekly task target
  const otherDays = await prisma.dailyPlan.findMany({
    where: {
      weekly_task_id: input.weeklyTaskId,
      company_id: input.companyId,
    },
    select: { target_value: true },
  });

  const currentDailySum = otherDays.reduce(
    (sum, d) => sum + Number(d.target_value || 0),
    0,
  );
  const newDailyTarget = input.targetValue || Number(task.target_value || 0);
  const totalDailyPlanned = currentDailySum + newDailyTarget;
  const weeklyTaskTarget = Number(task.target_value || 0);

  // Logic: Can be more (stretch), but tracks alignment
  const isDailyExceeding = totalDailyPlanned > weeklyTaskTarget;

  const dailyPlan = await prisma.dailyPlan.create({
    data: {
      company_id: input.companyId,
      weekly_task_id: input.weeklyTaskId,
      title: input.title,
      weekly_task_ref: normalizedWeeklyTaskRef,
      completion_day: input.completionDay as any,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      target_value: newDailyTarget,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      contributes_to_parent_score: input.contributesToParentScore ?? true,
      contributes_to_parent_value: input.contributesToParentValue ?? true,
      status_code: "published",
      created_by: input.createdBy,
    } as any,
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "DAILY_PLAN",
    entityId: dailyPlan.id,
    actorId: input.createdBy,
    action: "daily_plan_created",
    description: `Daily Plan "${dailyPlan.title}" created for week task ${task.id}`,
  });

  await tryRollupEmployeeObjective(
    plan.employeeKr.employee_objective_id,
    "daily plan creation",
  );

  // Cascade current_value from daily plan upward through the entire hierarchy
  try {
    await syncCurrentValueCascadeFromDailyPlan(dailyPlan.id);
  } catch (err) {
    console.warn(
      "Current-value cascade after daily plan creation failed:",
      err,
    );
  }

  return dailyPlan;
}

export async function createDailyPlans(input: CreateDailyPlansInput) {
  if (!input.completionDay) {
    throw new Error("completion_day is required for daily plans.");
  }
  if (!input.items || input.items.length === 0) {
    throw new Error("At least one item is required to create daily plans.");
  }

  const dailyPlans: any[] = [];

  for (const item of input.items) {
    const task = await prisma.weeklyTask.findFirst({
      where: { id: item.weeklyTaskId, company_id: input.companyId },
      include: {
        weeklyPlan: {
          include: {
            employeeKr: {
              include: {
                employeeObjective: {
                  select: { cycle_id: true, id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!task) continue;
    const plan = task.weeklyPlan;

    // Optional: check execution mode here

    // Normalize reference
    const normalizedWeeklyTaskRef = await resolveWeeklyTaskRefForDailyPlan({
      companyId: input.companyId,
      employeeKrId: plan.employee_kr_id,
      weekNumber: plan.week_number,
      weeklyTaskRef: input.weeklyTaskRef || "",
    });

    const measurement = await computeMeasurementSnapshot({
      companyId: input.companyId,
      cycleId: plan.employeeKr.employeeObjective.cycle_id,
      targetValue: item.targetValue,
      currentValue: item.currentValue,
    });

    const otherDays = await prisma.dailyPlan.findMany({
      where: {
        weekly_task_id: item.weeklyTaskId,
        company_id: input.companyId,
      },
      select: { target_value: true },
    });

    const currentDailySum = otherDays.reduce(
      (sum, d) => sum + Number(d.target_value || 0),
      0,
    );
    const newDailyTarget = item.targetValue || 0;
    const totalDailyPlanned = currentDailySum + newDailyTarget;
    const weeklyTaskTarget = Number(task.target_value || 0);

    const isDailyExceeding = totalDailyPlanned > weeklyTaskTarget; // stretch

    // Check existing
    const existing = await prisma.dailyPlan.findFirst({
      where: {
        company_id: input.companyId,
        weekly_task_id: item.weeklyTaskId,
        completion_day: input.completionDay as any,
      },
    });

    if (existing) {
      const updated = await prisma.dailyPlan.update({
        where: { id: existing.id },
        data: {
          title: input.title || existing.title,
          description: input.description,
          weekly_task_ref: normalizedWeeklyTaskRef || existing.weekly_task_ref,
          target_value: measurement.targetValue,
          current_value: measurement.currentValue,
          metric_definition_id: item.metricDefinitionId,
          progress_percent: measurement.progressPercent,
          confidence_level: measurement.confidenceLevel as any,
          updated_at: new Date(),
        } as any,
      });
      dailyPlans.push(updated);
      await logActivity({
        companyId: input.companyId,
        entityType: "DAILY_PLAN",
        entityId: updated.id,
        actorId: input.createdBy,
        action: "daily_plan_updated",
        description: `Daily Plan "${updated.title}" updated for week task ${task.id}`,
      });
    } else {
      const dailyPlan = await prisma.dailyPlan.create({
        data: {
          company_id: input.companyId,
          weekly_task_id: item.weeklyTaskId,
          title: input.title || "Daily Plan",
          weekly_task_ref: normalizedWeeklyTaskRef,
          completion_day: input.completionDay as any,
          description: input.description,
          metric_definition_id: item.metricDefinitionId,
          target_value: measurement.targetValue,
          current_value: measurement.currentValue,
          progress_percent: measurement.progressPercent,
          confidence_level: measurement.confidenceLevel as any,
          status_code: "published",
          created_by: input.createdBy,
        } as any,
      });
      dailyPlans.push(dailyPlan);
      await logActivity({
        companyId: input.companyId,
        entityType: "DAILY_PLAN",
        entityId: dailyPlan.id,
        actorId: input.createdBy,
        action: "daily_plan_created",
        description: `Daily Plan "${dailyPlan.title}" created for week task ${task.id}`,
      });
    }

    await tryRollupEmployeeObjective(
      plan.employeeKr.employee_objective_id,
      "batch daily plan creation",
    );

    // Cascade current_value from the last created/updated daily plan
    const lastDailyPlan = dailyPlans[dailyPlans.length - 1];
    if (lastDailyPlan) {
      try {
        await syncCurrentValueCascadeFromDailyPlan(lastDailyPlan.id);
      } catch (err) {
        console.warn(
          "Current-value cascade after batch daily plan creation failed:",
          err,
        );
      }
    }
  }

  return dailyPlans;
}

export async function updateDailyPlan(
  id: number,
  companyId: number,
  input: {
    title?: string;
    weeklyTaskRef?: string;
    completionDay?:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
    description?: string;
    statusCode?: string;
    metricDefinitionId?: number;
    targetValue?: number;
    currentValue?: number;
    weightPercent?: number;
    contributesToParentScore?: boolean;
    contributesToParentValue?: boolean;
  },
) {
  const dailyPlan = await prisma.dailyPlan.findFirst({
    where: { id, company_id: companyId },
    include: {
      weeklyTask: {
        include: {
          weeklyPlan: {
            include: {
              employeeKr: {
                select: {
                  employee_objective_id: true,
                  employeeObjective: {
                    select: { cycle_id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!dailyPlan) throw new Error("Daily Plan not found.");

  let normalizedWeeklyTaskRef: string | undefined;
  if (input.weeklyTaskRef !== undefined) {
    normalizedWeeklyTaskRef = await resolveWeeklyTaskRefForDailyPlan({
      companyId,
      employeeKrId: dailyPlan.weeklyTask.weeklyPlan.employee_kr_id,
      weekNumber: dailyPlan.weeklyTask.weeklyPlan.week_number,
      weeklyTaskRef: input.weeklyTaskRef,
    });
  }

  const measurement = await computeMeasurementSnapshot({
    companyId,
    cycleId:
      dailyPlan.weeklyTask.weeklyPlan.employeeKr.employeeObjective.cycle_id,
    targetValue:
      input.targetValue !== undefined
        ? input.targetValue
        : dailyPlan.target_value
          ? Number(dailyPlan.target_value)
          : null,
    currentValue:
      input.currentValue !== undefined
        ? input.currentValue
        : dailyPlan.current_value
          ? Number(dailyPlan.current_value)
          : null,
  });

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: {
      title: input.title,
      weekly_task_ref: normalizedWeeklyTaskRef,
      completion_day: input.completionDay as any,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      contributes_to_parent_score: input.contributesToParentScore,
      contributes_to_parent_value: input.contributesToParentValue,
      status_code: input.statusCode,
      completed_at: input.statusCode === "completed" ? new Date() : undefined,
    } as any,
  });

  await tryRollupEmployeeObjective(
    dailyPlan.weeklyTask.weeklyPlan.employeeKr.employee_objective_id,
    "daily plan update",
  );

  // Cascade current_value from daily plan upward through the entire hierarchy
  try {
    await syncCurrentValueCascadeFromDailyPlan(id);
  } catch (err) {
    console.warn("Current-value cascade after daily plan update failed:", err);
  }

  return updated;
}

export async function deleteDailyPlan(id: number, companyId: number) {
  const dailyPlan = await prisma.dailyPlan.findFirst({
    where: { id, company_id: companyId },
    include: {
      weeklyTask: {
        include: {
          weeklyPlan: {
            include: {
              employeeKr: {
                select: { employee_objective_id: true },
              },
            },
          },
        },
      },
    },
  });
  if (!dailyPlan) throw new Error("Daily Plan not found.");

  const weeklyTaskIdForCascade = dailyPlan.weeklyTask.id;

  await prisma.dailyPlan.delete({ where: { id } });

  await tryRollupEmployeeObjective(
    dailyPlan.weeklyTask.weeklyPlan.employeeKr.employee_objective_id,
    "daily plan delete",
  );

  // Cascade current_value from the weekly task level upward (daily is already deleted)
  try {
    await syncCurrentValueCascadeAfterDailyPlanDelete(weeklyTaskIdForCascade);
  } catch (err) {
    console.warn("Current-value cascade after daily plan delete failed:", err);
  }

  return { deleted: true };
}

export async function listDailyPlans(weeklyPlanId: number, companyId: number) {
  const tasks = await prisma.weeklyTask.findMany({
    where: { weekly_plan_id: weeklyPlanId, company_id: companyId },
    include: { dailyPlans: { orderBy: { created_at: "asc" } } },
  });
  return tasks.flatMap((t) => t.dailyPlans);
}

// ─── Progress Updates ─────────────────────────────────────────────────────────

interface SubmitProgressInput {
  companyId: number;
  employeeKrId: number;
  weekNumber?: number;
  monthNumber?: number;
  completionDay?: string;
  dailyPlanId?: number;
  currentValue?: number;
  targetValue?: number;
  blockers?: string;
  comment?: string;
  isCompleted?: boolean;
  updatedBy: string;
  cycleLabel?: string;
}

export async function submitProgressUpdate(input: SubmitProgressInput) {
  const empKr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: {
      metricDefinition: true,
      employeeObjective: {
        select: { cycle_id: true },
      },
    },
  });

  if (!empKr) throw new Error("Employee key result not found.");
  if (!["approved", "published", "active"].includes(empKr.status_code)) {
    throw new Error(
      "Employee key result must be approved or active before execution.",
    );
  }

  const { metricDefinition } = empKr;
  if (!metricDefinition) {
    throw new Error("Metric definition not found for this key result.");
  }

  const category = metricDefinition.category;

  // Validate BINARY
  if (category === "BINARY" || metricDefinition.allows_binary_completion) {
    if (input.isCompleted === undefined && input.currentValue === undefined) {
      throw new Error(
        `Metric '${metricDefinition.name}' is binary. 'isCompleted' boolean is required.`,
      );
    }
  }

  // Validate PERCENTAGE
  if (category === "PERCENTAGE") {
    if (input.currentValue === undefined) {
      throw new Error(
        `Metric '${metricDefinition.name}' is percentage. 'currentValue' is required.`,
      );
    }
    if (input.currentValue < 0 || input.currentValue > 100) {
      throw new Error(
        `Metric '${metricDefinition.name}' expects a 'currentValue' between 0 and 100.`,
      );
    }
  }

  // Validate NUMERIC / CURRENCY
  if (category === "NUMERIC" || category === "CURRENCY") {
    if (input.currentValue === undefined && !input.isCompleted) {
      throw new Error(
        `Metric '${metricDefinition.name}' requires a 'currentValue'.`,
      );
    }
  }

  // Common: ensuring positive values if numerical
  if (input.currentValue !== undefined && input.currentValue < 0) {
    throw new Error(`'currentValue' cannot be negative.`);
  }

  let effectiveCurrentValue = input.currentValue;
  if (
    (category === "BINARY" || metricDefinition.allows_binary_completion) &&
    effectiveCurrentValue === undefined &&
    input.isCompleted !== undefined
  ) {
    if (input.isCompleted) {
      effectiveCurrentValue = empKr.target_value
        ? Number(empKr.target_value)
        : 100;
    } else {
      effectiveCurrentValue = 0;
    }
  }

  // Context-aware target resolution: look at the item's target in the month plan
  let effectiveTarget = empKr.target_value ? Number(empKr.target_value) : null;

  if (input.dailyPlanId) {
    const daily = await prisma.dailyPlan.findUnique({
      where: { id: input.dailyPlanId },
    });
    if (daily?.target_value) {
      effectiveTarget = Number(daily.target_value);
    }
  } else if (input.weekNumber && input.monthNumber) {
    // Find the weekly plan for this KR+week to resolve the target
    const weeklyPlan = await prisma.weeklyPlan.findFirst({
      where: {
        employee_kr_id: input.employeeKrId,
        week_number: input.weekNumber,
      },
    });
    if (weeklyPlan?.target_value) {
      effectiveTarget = Number(weeklyPlan.target_value);
    } else {
      // Fall back to the month plan item target
      const monthPlanItem = await prisma.employeeMonthPlanItem.findFirst({
        where: { employee_kr_id: input.employeeKrId },

        orderBy: { created_at: "desc" },
      });
      if (monthPlanItem?.target_value) {
        effectiveTarget = Number(monthPlanItem.target_value);
      }
    }
  }

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: empKr.employeeObjective?.cycle_id,
    targetValue: effectiveTarget,
    currentValue: effectiveCurrentValue,
    useCurrentAsPercentWhenNoTarget: category === "PERCENTAGE",
  });

  // Validate Confidence / Blocker
  if (
    measurement.confidenceLevel === "AT_RISK" ||
    measurement.confidenceLevel === "OFF_TRACK"
  ) {
    const hasExplanation =
      (input.blockers && input.blockers.trim() !== "") ||
      (input.comment && input.comment.trim() !== "");

    if (!hasExplanation) {
      throw new Error(
        `Confidence level '${measurement.confidenceLevel}' requires a detailed explanation (blockers or comment).`,
      );
    }
  }

  const update = await prisma.progressUpdate.create({
    data: {
      company_id: input.companyId,
      employee_kr_id: input.employeeKrId,
      week_number: input.weekNumber,
      month_number: input.monthNumber,
      completion_day: input.completionDay as any,
      daily_plan_id: input.dailyPlanId,
      current_value: measurement.currentValue,
      confidence_level: measurement.confidenceLevel,
      blockers: input.blockers,
      comment: input.comment,
      is_completed: input.isCompleted ?? false,
      updated_by: input.updatedBy,
      cycle_label: input.cycleLabel,
    },
  });

  // Also update current_value state on KR itself for fast reads
  if (input.currentValue !== undefined || input.isCompleted !== undefined) {
    await prisma.employeeKeyResult.update({
      where: { id: input.employeeKrId },
      data: {
        current_value:
          measurement.currentValue !== null
            ? measurement.currentValue
            : empKr.current_value,
      },
    });

    // Sync status and description to the relevant DailyPlan if applicable
    if (input.dailyPlanId || (input.weekNumber && input.completionDay)) {
      const dailyPlan = input.dailyPlanId
        ? await prisma.dailyPlan.findUnique({
          where: { id: input.dailyPlanId },
        })
        : await prisma.dailyPlan.findFirst({
          where: {
            company_id: input.companyId,
            completion_day: input.completionDay as any,
            weeklyTask: {
              weeklyPlan: {
                employee_kr_id: input.employeeKrId,
                week_number: input.weekNumber,
              },
            },
          },
        });

      if (dailyPlan) {
        await prisma.dailyPlan.update({
          where: { id: dailyPlan.id },
          data: {
            current_value: measurement.currentValue,
            progress_percent: measurement.progressPercent,
            status_code: input.isCompleted
              ? "completed"
              : input.blockers
                ? "blocked"
                : "active",
            description: input.blockers || dailyPlan.description,
          },
        });
      }
    }

    // centralized sync calls that handle recursion and all levels from Daily/Weekly up to Company
    try {
      if (input.dailyPlanId) {
        await syncCurrentValueCascadeFromDailyPlan(input.dailyPlanId);
      } else if (input.weekNumber) {
        const wp = await prisma.weeklyPlan.findFirst({
          where: {
            employee_kr_id: input.employeeKrId,
            week_number: input.weekNumber,
          },
        });
        if (wp) {
          await syncCurrentValueCascadeFromWeeklyPlan(wp.id);
        } else {
          // Fallback if no weekly plan exists
          await syncEmployeeKrValueColumns(input.employeeKrId, input.companyId);
        }
      } else {
        await syncEmployeeKrValueColumns(input.employeeKrId, input.companyId);
      }

      // Always sync objective and rollup scores
      await syncEmployeeObjectiveValueColumns(
        empKr.employee_objective_id,
        input.companyId,
      );
      await tryRollupEmployeeObjective(
        empKr.employee_objective_id,
        "progress update",
        true,
      );
    } catch (err) {
      console.warn("Progress update cascade failed:", err);
    }
  }

  await logActivity({
    companyId: input.companyId,
    entityType: "PROGRESS_UPDATE",
    entityId: update.id,
    actorId: input.updatedBy,
    action: "progress_submitted",
    description: `Progress update submitted for employee KR "${empKr.title}"${measurement.currentValue !== null ? ` — value: ${measurement.currentValue}` : ""}`,
    metadata: {
      current_value: measurement.currentValue,
      confidence_level: measurement.confidenceLevel,
      is_completed: input.isCompleted,
      metric_type: category,
      progress_percent: measurement.progressPercent,
    },
  });

  // Trigger completion logic if conditions are met
  const reachedTarget =
    metricDefinition.requires_target_value &&
    empKr.target_value &&
    measurement.currentValue !== null &&
    new Decimal(measurement.currentValue).gte(new Decimal(empKr.target_value));

  const shouldMarkComplete =
    input.isCompleted ||
    (reachedTarget && metricDefinition.allows_binary_completion);

  if (shouldMarkComplete && empKr.status_code !== "completed") {
    try {
      await markEmployeeKrAsComplete(
        input.companyId,
        input.employeeKrId,
        input.updatedBy,
      );
    } catch (_compErr) {
      console.warn("Auto-completion failed:", _compErr);
    }
  }

  // Auto-trigger rollup: recompute KR score and roll up to parent objective
  await tryRollupEmployeeObjective(
    empKr.employee_objective_id,
    "progress update",
  );

  // Return metric info in response payload too
  return { ...update, _metricCat: category };
}

export async function listProgressHistory(
  employeeKrId: number,
  companyId: number,
) {
  return prisma.progressUpdate.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { created_at: "desc" },
  });
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export async function submitEmployeeObjective(
  id: number,
  companyId: number,
  actorId: string,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
  });
  if (!objective) throw new Error("Employee objective not found.");

  if (
    objective.status_code === "submitted" ||
    objective.status_code === "pending_approval"
  ) {
    return objective;
  }
  if (objective.status_code === "published") {
    throw new Error("Published objectives cannot be submitted for review.");
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "pending_approval",
  });

  const updated = await prisma.employeeObjective.update({
    where: { id },
    data: { status_code: "pending_approval" },
  });

  await prisma.employeeKeyResult.updateMany({
    where: {
      employee_objective_id: id,
    },
    data: {
      status_code: "pending_approval",
    },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: updated.id,
    actorId,
    action: "submit_for_review",
    description: `Employee objective "${updated.title}" submitted for approval`,
  });

  return updated;
}

export async function submitEmployeeKeyResult(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Employee key result not found.");

  if (kr.status_code === "submitted" || kr.status_code === "pending_approval") {
    return kr;
  }
  if (kr.status_code === "published") {
    throw new Error("Published key results cannot be submitted for review.");
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_KR",
    fromStatus: kr.status_code,
    toStatus: "pending_approval",
  });

  const updated = await prisma.employeeKeyResult.update({
    where: { id },
    data: { status_code: "pending_approval" },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: updated.id,
    actorId,
    action: "submit_for_review",
    description: `Employee key result "${updated.title}" submitted for approval`,
  });

  return updated;
}

export async function publishEmployeeObjective(
  id: number,
  companyId: number,
  actorId: string,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
  });
  if (!objective) throw new Error("Employee objective not found.");
  if (objective.status_code === "published") {
    throw new Error("Employee objective is already published.");
  }

  // Validate before publishing
  await validateSafePublish(companyId, id, "EMPLOYEE", objective.cycle_id);
  await validateWeightsBeforePublish(
    companyId,
    objective.cycle_id,
    id,
    "EMPLOYEE",
  );

  const updated = await prisma.employeeObjective.update({
    where: { id },
    data: {
      status_code: "published",
      published_by: actorId,
      published_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: updated.id,
    actorId,
    action: "publish_action",
    description: `Employee objective "${updated.title}" published individually`,
  });

  return updated;
}

export async function publishEmployeeKeyResult(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Employee key result not found.");
  if (kr.status_code === "published") {
    throw new Error("Employee key result is already published.");
  }

  const objectiveId = kr.employee_objective_id;
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: objectiveId },
    select: { cycle_id: true },
  });

  if (objective) {
    await validateSafePublish(
      companyId,
      objectiveId,
      "EMPLOYEE",
      objective.cycle_id,
    );
    await validateWeightsBeforePublish(
      companyId,
      objective.cycle_id,
      objectiveId,
      "EMPLOYEE",
    );
  }

  const updated = await prisma.employeeKeyResult.update({
    where: { id },
    data: {
      status_code: "published",
      published_by: actorId,
      published_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: kr.id,
    actorId,
    action: "publish_action",
    description: `Employee key result "${kr.title}" published individually`,
  });

  return updated;
}

export async function bulkPublishEmployee(
  objectiveIds: number[],
  krIds: number[],
  companyId: number,
  actorId: string,
) {
  let publishedObjCount = 0;
  let publishedKrCount = 0;

  if (objectiveIds && objectiveIds.length > 0) {
    // Bulk validation
    for (const objId of objectiveIds) {
      const obj = await prisma.employeeObjective.findUnique({
        where: { id: objId },
        select: { cycle_id: true },
      });
      if (obj) {
        await validateSafePublish(companyId, objId, "EMPLOYEE", obj.cycle_id);
        await validateWeightsBeforePublish(
          companyId,
          obj.cycle_id,
          objId,
          "EMPLOYEE",
        );
      }
    }

    const updatedObjs = await prisma.employeeObjective.updateMany({
      where: {
        id: { in: objectiveIds },
        company_id: companyId,
        status_code: "approved",
      },
      data: {
        status_code: "published",
        published_by: actorId,
        published_at: new Date(),
      },
    });
    publishedObjCount = updatedObjs.count;

    for (const objId of objectiveIds) {
      await logActivity({
        companyId,
        entityType: "EMPLOYEE_OBJECTIVE",
        entityId: objId,
        actorId,
        action: "publish_action",
        description: `Employee objective published via bulk action`,
      });
    }
  }

  if (krIds && krIds.length > 0) {
    // Bulk validation for KRs
    for (const krId of krIds) {
      const kr = await prisma.employeeKeyResult.findUnique({
        where: { id: krId },
        select: { employee_objective_id: true },
      });
      if (kr) {
        const obj = await prisma.employeeObjective.findUnique({
          where: { id: kr.employee_objective_id },
          select: { cycle_id: true },
        });
        if (obj) {
          await validateSafePublish(
            companyId,
            kr.employee_objective_id,
            "EMPLOYEE",
            obj.cycle_id,
          );
          await validateWeightsBeforePublish(
            companyId,
            obj.cycle_id,
            kr.employee_objective_id,
            "EMPLOYEE",
          );
        }
      }
    }

    const updatedKrs = await prisma.employeeKeyResult.updateMany({
      where: {
        id: { in: krIds },
        company_id: companyId,
        status_code: "approved",
      },
      data: {
        status_code: "published",
        published_by: actorId,
        published_at: new Date(),
      },
    });
    publishedKrCount = updatedKrs.count;

    for (const krId of krIds) {
      await logActivity({
        companyId,
        entityType: "EMPLOYEE_KR",
        entityId: krId,
        actorId,
        action: "publish_action",
        description: `Employee key result published via bulk action`,
      });
    }
  }

  return {
    publishedObjectives: publishedObjCount,
    publishedKeyResults: publishedKrCount,
  };
}

export async function bulkSubmitEmployee(
  objectiveIds: number[],
  krIds: number[],
  companyId: number,
  actorId: string,
) {
  let submittedObjectives = 0;
  let submittedKeyResults = 0;

  for (const id of objectiveIds || []) {
    await submitEmployeeObjective(id, companyId, actorId);
    submittedObjectives++;
  }

  for (const id of krIds || []) {
    await submitEmployeeKeyResult(id, companyId, actorId);
    submittedKeyResults++;
  }

  return {
    submittedObjectives,
    submittedKeyResults,
  };
}

async function submitEmployeeMonthPlan(
  id: number,
  companyId: number,
  actorId: string,
) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Employee month plan not found.");

  if (
    plan.status_code === "submitted" ||
    plan.status_code === "pending_approval"
  ) {
    return plan;
  }
  if (plan.status_code === "published") {
    throw new Error("Published month plans cannot be submitted for review.");
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_MONTH_PLAN",
    fromStatus: plan.status_code,
    toStatus: "pending_approval",
  });

  const updated = await prisma.employeeMonthPlan.update({
    where: { id },
    data: { status_code: "pending_approval" },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_MONTH_PLAN",
    entityId: id,
    actorId,
    action: "submit_for_review",
    description: `Employee month plan "${updated.title}" submitted for approval`,
  });

  return updated;
}

async function submitEmployeeWeeklyPlan(
  id: number,
  companyId: number,
  actorId: string,
) {
  const plan = await prisma.weeklyPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Weekly plan not found.");

  if (
    plan.status_code === "submitted" ||
    plan.status_code === "pending_approval"
  ) {
    return plan;
  }
  if (plan.status_code === "published") {
    throw new Error("Published weekly plans cannot be submitted for review.");
  }

  await validateStatusTransition({
    companyId,
    entityType: "WEEKLY_PLAN",
    fromStatus: plan.status_code,
    toStatus: "pending_approval",
  });

  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: { status_code: "pending_approval" },
  });

  // Also transition tasks if they are not already published
  await prisma.weeklyTask.updateMany({
    where: {
      weekly_plan_id: id,
      company_id: companyId,
      status_code: { not: "published" },
    },
    data: {
      status_code: "pending_approval",
    },
  });

  await prisma.dailyPlan.updateMany({
    where: {
      weeklyTask: {
        weekly_plan_id: id,
      },
      company_id: companyId,
      status_code: { not: "published" },
    },
    data: {
      status_code: "pending_approval",
    },
  });

  await logActivity({
    companyId,
    entityType: "WEEKLY_PLAN",
    entityId: id,
    actorId,
    action: "submit_for_review",
    description: `Weekly plan #${id} submitted for approval`,
  });

  return updated;
}

async function submitEmployeeDailyPlan(
  id: number,
  companyId: number,
  actorId: string,
) {
  const plan = await prisma.dailyPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Daily plan not found.");

  if (
    plan.status_code === "submitted" ||
    plan.status_code === "pending_approval"
  ) {
    return plan;
  }
  if (plan.status_code === "published") {
    throw new Error("Published daily plans cannot be submitted for review.");
  }

  await validateStatusTransition({
    companyId,
    entityType: "DAILY_PLAN",
    fromStatus: plan.status_code,
    toStatus: "pending_approval",
  });

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: { status_code: "pending_approval" },
  });

  await logActivity({
    companyId,
    entityType: "DAILY_PLAN",
    entityId: id,
    actorId,
    action: "submit_for_review",
    description: `Daily plan "${updated.title}" submitted for approval`,
  });

  return updated;
}

export async function bulkSubmitEmployeePlanning(
  monthPlanIds: number[],
  weeklyPlanIds: number[],
  dailyPlanIds: number[],
  companyId: number,
  actorId: string,
) {
  let submittedMonthPlans = 0;
  let submittedWeeklyPlans = 0;
  let submittedDailyPlans = 0;
  const failed: Array<{
    entity_type: string;
    entity_id: number;
    reason: string;
  }> = [];

  for (const id of monthPlanIds || []) {
    try {
      await submitEmployeeMonthPlan(id, companyId, actorId);
      submittedMonthPlans++;
    } catch (error: any) {
      failed.push({
        entity_type: "EMPLOYEE_MONTH_PLAN",
        entity_id: id,
        reason: error?.message || "Unknown error",
      });
    }
  }

  for (const id of weeklyPlanIds || []) {
    try {
      await submitEmployeeWeeklyPlan(id, companyId, actorId);
      submittedWeeklyPlans++;
    } catch (error: any) {
      failed.push({
        entity_type: "WEEKLY_PLAN",
        entity_id: id,
        reason: error?.message || "Unknown error",
      });
    }
  }

  for (const id of dailyPlanIds || []) {
    try {
      await submitEmployeeDailyPlan(id, companyId, actorId);
      submittedDailyPlans++;
    } catch (error: any) {
      failed.push({
        entity_type: "DAILY_PLAN",
        entity_id: id,
        reason: error?.message || "Unknown error",
      });
    }
  }

  return {
    submittedMonthPlans,
    submittedWeeklyPlans,
    submittedDailyPlans,
    failed_count: failed.length,
    failed,
  };
}

export async function bulkPublishEmployeePlanning(
  monthPlanIds: number[],
  weeklyPlanIds: number[],
  dailyPlanIds: number[],
  companyId: number,
  actorId: string,
) {
  let publishedMonthPlans = 0;
  let publishedWeeklyPlans = 0;
  let publishedDailyPlans = 0;
  const failed: Array<{
    entity_type: string;
    entity_id: number;
    reason: string;
  }> = [];

  if (monthPlanIds?.length) {
    for (const id of monthPlanIds) {
      try {
        const plan = await prisma.employeeMonthPlan.findFirst({
          where: { id, company_id: companyId },
        });
        if (!plan) throw new Error("Employee month plan not found.");

        await validateStatusTransition({
          companyId,
          entityType: "EMPLOYEE_MONTH_PLAN",
          fromStatus: plan.status_code,
          toStatus: "published",
        });

        await prisma.employeeMonthPlan.update({
          where: { id },
          data: {
            status_code: "published",
            published_by: actorId,
            published_at: new Date(),
          },
        });

        await logActivity({
          companyId,
          entityType: "EMPLOYEE_MONTH_PLAN",
          entityId: id,
          actorId,
          action: "publish_action",
          description: `Employee month plan #${id} published via bulk action`,
        });
        publishedMonthPlans++;
      } catch (error: any) {
        failed.push({
          entity_type: "EMPLOYEE_MONTH_PLAN",
          entity_id: id,
          reason: error?.message || "Unknown error",
        });
      }
    }
  }

  if (weeklyPlanIds?.length) {
    for (const id of weeklyPlanIds) {
      try {
        const plan = await prisma.weeklyPlan.findFirst({
          where: { id, company_id: companyId },
        });
        if (!plan) throw new Error("Weekly plan not found.");

        await validateStatusTransition({
          companyId,
          entityType: "WEEKLY_PLAN",
          fromStatus: plan.status_code,
          toStatus: "published",
        });

        await prisma.weeklyPlan.update({
          where: { id },
          data: {
            status_code: "published",
            published_by: actorId,
            published_at: new Date(),
          } as any,
        });
        await prisma.weeklyTask.updateMany({
          where: { weekly_plan_id: id },
          data: {
            status_code: "published",
          },
        });

        // Also publish tasks
        await prisma.weeklyTask.updateMany({
          where: {
            weekly_plan_id: id,
            company_id: companyId,
          },
          data: {
            status_code: "published",
          },
        });

        await prisma.dailyPlan.updateMany({
          where: {
            weeklyTask: {
              weekly_plan_id: id,
            },
            company_id: companyId,
          },
          data: {
            status_code: "published",
          },
        });

        await logActivity({
          companyId,
          entityType: "WEEKLY_PLAN",
          entityId: id,
          actorId,
          action: "publish_action",
          description: `Weekly plan #${id} published via bulk action`,
        });
        publishedWeeklyPlans++;
      } catch (error: any) {
        failed.push({
          entity_type: "WEEKLY_PLAN",
          entity_id: id,
          reason: error?.message || "Unknown error",
        });
      }
    }
  }

  if (dailyPlanIds?.length) {
    for (const id of dailyPlanIds) {
      try {
        const plan = await prisma.dailyPlan.findFirst({
          where: { id, company_id: companyId },
        });
        if (!plan) throw new Error("Daily plan not found.");

        await validateStatusTransition({
          companyId,
          entityType: "DAILY_PLAN",
          fromStatus: plan.status_code,
          toStatus: "published",
        });

        await prisma.dailyPlan.update({
          where: { id },
          data: {
            status_code: "published",
          },
        });

        await logActivity({
          companyId,
          entityType: "DAILY_PLAN",
          entityId: id,
          actorId,
          action: "publish_action",
          description: `Daily plan #${id} published via bulk action`,
        });
        publishedDailyPlans++;
      } catch (error: any) {
        failed.push({
          entity_type: "DAILY_PLAN",
          entity_id: id,
          reason: error?.message || "Unknown error",
        });
      }
    }
  }

  return {
    publishedMonthPlans,
    publishedWeeklyPlans,
    publishedDailyPlans,
    failed_count: failed.length,
    failed,
  };
}
