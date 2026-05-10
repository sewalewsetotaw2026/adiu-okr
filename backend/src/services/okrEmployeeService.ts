import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrExecutionMode, OkrContributorRoleType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { recalculateRollUp } from "src/services/okrRollupService";
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
import { assignContributor } from "./okrContributorService";

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

async function tryRollupChain(
  nodeType: "daily_plan" | "weekly_plan" | "employee_key_result" | "employee_objective",
  nodeId: number,
  reason: string
) {
  try {
    await recalculateRollUp(nodeType, nodeId);
  } catch (error) {
    console.warn(`[AutoRollup] Failed for ${nodeType} ${nodeId} after ${reason}:`, error);
  }
}

async function tryRollupEmployeeObjective(objectiveId: number, reason: string) {
  return tryRollupChain("employee_objective", objectiveId, reason);
}

// ─── Employee Objectives ──────────────────────────────────────────────────────

export async function listEmployeeObjectives(
  userId: string | string[],
  companyId: number,
  cycleId: number,
) {
  const userFilter = Array.isArray(userId) ? { in: userId } : userId;

  const objectives = await prisma.employeeObjective.findMany({
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
      keyResults: {
        include: {
          metricDefinition: true,
          progressUpdates: { orderBy: { created_at: "desc" }, take: 1 },
        },
      },
      comments: {
        orderBy: { created_at: "desc" },
      },
      _count: { select: { keyResults: true } },
    },
  });

  const allAuthorIds = new Set<string>();
  objectives.forEach((o) => {
    if (o.reviewer_id) allAuthorIds.add(o.reviewer_id);
    o.comments.forEach((c) => allAuthorIds.add(c.author_id));
    o.keyResults.forEach((kr) => {
      if (kr.reviewer_id) allAuthorIds.add(kr.reviewer_id);
    });
  });

  const authors = await prisma.employee.findMany({
    where: { id: { in: Array.from(allAuthorIds) } },
    select: { id: true, full_name: true },
  });
  const authorMap = new Map(authors.map((r) => [r.id, r.full_name]));

  return objectives.map((o) => ({
    ...o,
    reviewer_name: o.reviewer_id ? authorMap.get(o.reviewer_id) : null,
    reviewerName: o.reviewer_id ? authorMap.get(o.reviewer_id) : null,
    feedbackNote: o.rejection_note,
    comments: o.comments.map((c) => ({
      ...c,
      authorName: authorMap.get(c.author_id) || "Reviewer",
      author_name: authorMap.get(c.author_id) || "Reviewer",
    })),
    keyResults: o.keyResults.map((kr) => ({
      ...kr,
      reviewerName: kr.reviewer_id ? authorMap.get(kr.reviewer_id) : null,
      feedbackNote: kr.rejection_note,
    })),
  }));
}

export async function listEmployeeObjectivesForCycle(
  companyId: number,
  cycleId: number,
) {
  const objectives = await prisma.employeeObjective.findMany({
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
      keyResults: {
        include: {
          metricDefinition: true,
          progressUpdates: { orderBy: { created_at: "desc" }, take: 1 },
        },
      },
      comments: {
        orderBy: { created_at: "desc" },
      },
      _count: { select: { keyResults: true } },
    },
  });

  const allAuthorIds = new Set<string>();
  objectives.forEach((o) => {
    if (o.reviewer_id) allAuthorIds.add(o.reviewer_id);
    o.comments.forEach((c) => allAuthorIds.add(c.author_id));
    o.keyResults.forEach((kr) => {
      if (kr.reviewer_id) allAuthorIds.add(kr.reviewer_id);
    });
  });

  const authors = await prisma.employee.findMany({
    where: { id: { in: Array.from(allAuthorIds) } },
    select: { id: true, full_name: true },
  });
  const authorMap = new Map(authors.map((r) => [r.id, r.full_name]));

  return objectives.map((o) => ({
    ...o,
    reviewerName: o.reviewer_id ? authorMap.get(o.reviewer_id) : null,
    feedbackNote: o.rejection_note,
    comments: o.comments.map((c) => ({
      ...c,
      authorName: authorMap.get(c.author_id) || "Reviewer",
      author_name: authorMap.get(c.author_id) || "Reviewer",
    })),
    keyResults: o.keyResults.map((kr) => ({
      ...kr,
      reviewerName: kr.reviewer_id ? authorMap.get(kr.reviewer_id) : null,
      feedbackNote: kr.rejection_note,
    })),
  }));
}

export async function listAssignedKRsForEmployee(
  companyId: number,
  userId: string,
  cycleId?: number,
  includeAdopted = false,
  departmentId?: number,
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
    status_code: { in: ["active", "assigned"] },
    user_id: { in: idVariants },
    ...(includeAdopted ? {} : { employeeObjectives: { is: null } }),
  };

  const andConditions: any[] = [];

  if (effectiveCycleId) {
    andConditions.push({
      OR: [
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
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  console.log(
    `[DEBUG listAssignedKRs] userId=${userId}, idVariants=${JSON.stringify(idVariants)}, cycleId=${effectiveCycleId}, includeAdopted=${includeAdopted}`,
  );
  console.log(`[DEBUG listAssignedKRs] where=`, JSON.stringify(where, null, 2));

  let assignments: any[] = await prisma.krContributor.findMany({
    where,
    orderBy: { assigned_at: "asc" },
    include: {
      companyKr: {
        select: {
          id: true,
          title: true,
          description: true,
          status_code: true,
          unit_of_measure: true,
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
          unit_of_measure: true,
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

  // If departmentId is provided (e.g. for a Dept Head), fetch KRs assigned to the whole department
  if (departmentId) {
    const deptKrs = await prisma.companyKrDepartment.findMany({
      where: {
        department_id: departmentId,
        company_id: companyId,
        ...(effectiveCycleId
          ? { companyKr: { objective: { cycle_id: effectiveCycleId } } }
          : {}),
      },
      select: {
        id: true,
        company_id: true,
        company_kr_id: true,
        department_id: true,
        required_target: true,
        weight_percent: true,
        created_at: true,
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
      },
    });

    for (const dk of deptKrs) {
      // Avoid duplicates if also directly assigned
      const alreadyIncluded = assignments.some(
        (a) => a.company_kr_id === dk.company_kr_id,
      );
      if (!alreadyIncluded && dk.companyKr) {
        // If not adopted yet, show as virtual assignment
        const existingObjective = await prisma.employeeObjective.findFirst({
          where: {
            user_id: userId,
            chosen_parent_kr_id: dk.company_kr_id,
            company_id: companyId,
          },
        });

        if (!existingObjective || includeAdopted) {
          assignments.push({
            id: 0, // Virtual ID
            company_id: companyId,
            company_kr_id: dk.company_kr_id,
            employee_kr_id: null,
            user_id: userId,
            role_type: "EMPLOYEE",
            status_code: "assigned",
            assigned_at: dk.created_at,
            updated_at: dk.created_at,
            required_target: dk.required_target,
            weight_percent: dk.weight_percent,
            companyKr: dk.companyKr,
            employeeKr: null,
            employeeObjectives: existingObjective || null,
            is_virtual: true,
          });
        }
      }
    }
  }

  // 2. Filter out self-owned KRs (where the user is already the owner of the objective containing the KR)
  // to prevent "adoption loops" where a user adopts their own Key Result.
  if (!includeAdopted) {
    const originalCount = assignments.length;
    assignments = assignments.filter((a) => {
      if (a.employeeKr?.employeeObjective?.user_id) {
        const ownerId = String(a.employeeKr.employeeObjective.user_id);
        if (idVariants.includes(ownerId)) return false;
      }
      return true;
    });
    if (assignments.length < originalCount) {
      console.log(
        `[DEBUG listAssignedKRs] Filtered out ${originalCount - assignments.length} self-owned KRs.`,
      );
    }
  }

  console.log(
    `[DEBUG listAssignedKRs] Found ${assignments.length} total (inc dept) assignments:`,
    assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      company_kr_id: a.company_kr_id,
      is_virtual: !!a.is_virtual,
      has_obj: !!a.employeeObjectives,
    })),
  );

  return assignments.map((a) => ({
    contributor_id: a.id,
    user_id: a.user_id,
    role_type: a.role_type,
    assigned_at: a.assigned_at,
    required_target: a.required_target != null ? Number(a.required_target) : null,
    weight_percent: a.weight_percent != null ? Number(a.weight_percent) : null,
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
      keyResults: {
        include: {
          metricDefinition: true,
          contributors: {
            include: {
              user: {
                include: {
                  employee: {
                    select: {
                      id: true,
                      full_name: true,
                    },
                  },
                },
              },
            },
          },
          progressUpdates: {
            take: 1,
            orderBy: { created_at: "desc" },
          },
          _count: {
            select: {
              monthlyPlans: true,
              subtasks: true,
              progressUpdates: true,
            },
          },
          comments: {
            orderBy: { created_at: "desc" },
          },
        },
        orderBy: { created_at: "asc" },
      },
      comments: {
        orderBy: { created_at: "desc" },
      },
    },
  });
  if (!objective) throw new Error("Employee objective not found.");

  const allAuthorIds = new Set<string>();
  if (objective.reviewer_id) allAuthorIds.add(objective.reviewer_id);
  objective.comments.forEach((c) => allAuthorIds.add(c.author_id));
  objective.keyResults.forEach((kr) => {
    if (kr.reviewer_id) allAuthorIds.add(kr.reviewer_id);
  });

  const authors = await prisma.employee.findMany({
    where: { id: { in: Array.from(allAuthorIds) } },
    select: { id: true, full_name: true },
  });
  const authorMap = new Map(authors.map((r) => [r.id, r.full_name]));

  const activityLog = await prisma.okrActivityLog.findMany({
    where: { entity_type: "EMPLOYEE_OBJECTIVE", entity_id: id },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return {
    ...objective,
    reviewerName: objective.reviewer_id
      ? authorMap.get(objective.reviewer_id)
      : null,
    feedbackNote: objective.rejection_note,
    comments: (objective.comments || []).map((c) => ({
      ...c,
      authorName: authorMap.get(c.author_id) || "Reviewer",
      author_name: authorMap.get(c.author_id) || "Reviewer",
    })),
    keyResults: objective.keyResults.map((kr) => ({
      ...kr,
      reviewerName: kr.reviewer_id ? authorMap.get(kr.reviewer_id) : null,
      feedbackNote: kr.rejection_note,
      comments: (kr.comments || []).map((c) => ({
        ...c,
        authorName: authorMap.get(c.author_id) || "Reviewer",
        author_name: authorMap.get(c.author_id) || "Reviewer",
      })),
    })),
    activityLog,
  };
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

export async function adoptAssignedKR(
  input: AdoptAssignedKRInput,
) {
  if (!["DIRECT_ADOPTION", "CUSTOMIZED"].includes(input.executionMode)) {
    throw new Error("execution_mode must be DIRECT_ADOPTION or CUSTOMIZED.");
  }

  if (!input.contributorId && !input.companyKrId && !input.employeeKrId) {
    throw new Error("Either contributor_id, company_kr_id or employee_kr_id is required.");
  }

  let contributor: any = await prisma.krContributor.findFirst({
    where: {
      company_id: input.companyId,
      ...(input.contributorId && input.contributorId > 0
        ? { id: input.contributorId }
        : {}),
      ...((!input.contributorId || input.contributorId <= 0) &&
        input.companyKrId
        ? {
          company_kr_id: input.companyKrId,
          user_id: input.assignmentUserId,
        }
        : {}),
      ...((!input.contributorId || input.contributorId <= 0) &&
        input.employeeKrId
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

  // If not found, check if it was assigned to a department the user heads
  if (!contributor && input.companyKrId) {
    const deptAssignment = await prisma.companyKrDepartment.findFirst({
      where: {
        company_kr_id: input.companyKrId,
        company_id: input.companyId,
      },
    });

    if (deptAssignment) {
      // Create a real contributor record for this user now that they've decided to adopt it
      contributor = await prisma.krContributor.create({
        data: {
          company_id: input.companyId,
          company_kr_id: input.companyKrId,
          user_id: input.assignmentUserId,
          role_type: "EMPLOYEE",
          status_code: "active",
          assigned_by: "SYSTEM_DEPT_ADOPTION",
        },
        include: {
          companyKr: {
            include: {
              objective: { select: { id: true, cycle_id: true } },
            },
          },
          employeeKr: {
            include: {
              employeeObjective: { select: { id: true, cycle_id: true } },
            },
          },
        },
      });
    }
  }

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
    contributor.companyKr?.title || contributor.employeeKr?.title || "Untitled Parent KR";

  const finalTitle = isDirectAdoption ? parentTitle : input.title!.trim();

  const finalDescription = isDirectAdoption
    ? (contributor.companyKr?.description ||
      contributor.employeeKr?.description ||
      `Directly adopting assigned KR: ${parentTitle}`)
    : input.description?.trim() || null;

  if (input.executionMode === "CUSTOMIZED") {
    validateTitleAndDescription(finalTitle, finalDescription || undefined);
  }

  const objective = await prisma.employeeObjective.create({
    data: {
      company_id: input.companyId,
      cycle_id: contributor.companyKr?.objective.cycle_id || contributor.employeeKr?.employeeObjective.cycle_id || 0,
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
    where: { employee_kr_id: employeeKrId },
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
  weightPercent?: number;
  contributesToScore?: boolean;
  contributesToValue?: boolean;
  isMandatory?: boolean;
  executionMode: OkrExecutionMode;
  createdBy: string;
  assignUsers?: {
    userId: string;
    requiredTarget?: number;
    weightPercent?: number;
  }[];
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
  if ((empObj.chosen_parent_kr_id || (empObj as any).chosen_parent_employee_kr_id) && metricId) {
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

  const kr = await prisma.employeeKeyResult.create({
    data: {
      company_id: input.companyId,
      employee_objective_id: input.employeeObjectiveId,
      title: input.title,
      description: input.description,
      metric_definition_id: metricId,
      unit_of_measure: input.unitOfMeasure,
      target_value: input.targetValue,
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

  await logActivity({
    companyId: input.companyId,
    entityType: "EMPLOYEE_KR",
    entityId: kr.id,
    actorId: input.createdBy,
    action: "employee_kr_created",
    description: `Employee KR "${kr.title}" created`,
    metadata: { employee_objective_id: input.employeeObjectiveId },
  });

  // Handle contributor assignments if provided
  if (input.assignUsers && input.assignUsers.length > 0) {
    for (const assignment of input.assignUsers) {
      try {
        await assignContributor({
          companyId: input.companyId,
          employeeKrId: kr.id,
          userId: assignment.userId,
          roleType: "EMPLOYEE", // Default for employee-level KR
          requiredTarget: assignment.requiredTarget,
          weightPercent: assignment.weightPercent,
          assignedBy: input.createdBy,
        });
      } catch (err: any) {
        console.error(`Failed to assign contributor ${assignment.userId} to KR ${kr.id}:`, err.message);
        // We continue with others even if one fails
      }
    }
  }

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
  if ((empObj?.chosen_parent_kr_id || (empObj as any)?.chosen_parent_employee_kr_id) && metricToCheck) {
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
      await validateMetricAlignment(
        companyId,
        parentMetricId,
        metricToCheck,
      );
    }
  }

  return prisma.employeeKeyResult.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      unit_of_measure: input.unitOfMeasure,
      target_value: input.targetValue,
      weight_percent: input.weightPercent,
      contributes_to_objective_score: input.contributesToScore,
      contributes_to_objective_value: input.contributesToValue,
      is_mandatory_for_completion: input.isMandatory,
    },
    include: { metricDefinition: true },
  });
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
          monthlyPlans: true,
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

// ─── Employee Month/Weekly Plans (LEGACY) ───────────────────────────────────
// Removed in the OKR Planning Overhaul (Phase 8).
// The corrected hierarchy lives in src/services/okrPlanningService.ts and is
// exposed under /api/v1/okr/key-results/:krId/monthly-plans, etc.
// ─────────────────────────────────────────────────────────────────────────────

// listWeeklyPlans (legacy) — removed; use GET /okr/monthly-plans/:monthlyId/weekly-plans

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
      final_score: measurement.finalScore,
      final_value: measurement.finalValue,
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
      final_score: measurement.finalScore,
      final_value: measurement.finalValue,
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

// ─── Daily Plans (LEGACY) ──────────────────────────────────────────────────
// Removed in the OKR Planning Overhaul (Phase 8).
// The corrected daily plan flow lives in src/services/okrPlanningService.ts.
// ─────────────────────────────────────────────────────────────────────────────


// ─── Progress Updates ─────────────────────────────────────────────────────────

interface SubmitProgressInput {
  companyId: number;
  employeeKrId: number;
  weekNumber?: number;
  monthNumber?: number;
  currentValue?: number;
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
    throw new Error("Employee key result must be approved or active before execution.");
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

  if (input.weekNumber && input.monthNumber) {
    // Find the weekly plan for this KR+week to resolve the target.
    // Weekly plans are now children of monthly plans, so traverse through monthPlan.employee_kr_id.
    const weeklyPlan = await prisma.weeklyPlan.findFirst({
      where: {
        week_number: input.weekNumber,
        monthPlan: {
          employee_kr_id: input.employeeKrId,
          month_number: input.monthNumber,
        },
      },
    });
    if (weeklyPlan?.target_value) {
      effectiveTarget = Number(weeklyPlan.target_value);
    } else {
      // Fall back to the monthly plan target for the same KR.
      const monthlyPlan = await prisma.employeeMonthPlan.findFirst({
        where: {
          employee_kr_id: input.employeeKrId,
          month_number: input.monthNumber,
        },
        orderBy: { created_at: "desc" },
      });
      if (monthlyPlan?.target_value) {
        effectiveTarget = Number(monthlyPlan.target_value);
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
      current_value: measurement.currentValue,
      confidence_level: measurement.confidenceLevel,
      blockers: input.blockers,
      comment: input.comment,
      is_completed: input.isCompleted ?? false,
      updated_by: input.updatedBy,
      cycle_label: input.cycleLabel,
    },
  });

  // Also update final_value / current_value state on KR itself for fast reads
  if (input.currentValue !== undefined || input.isCompleted !== undefined) {
    await prisma.employeeKeyResult.update({
      where: { id: input.employeeKrId },
      data: {
        final_score:
          measurement.finalScore !== null
            ? measurement.finalScore
            : empKr.final_score,
        final_value:
          measurement.finalValue !== null
            ? measurement.finalValue
            : empKr.final_value,
      },
    });

    // Sync current_value to the relevant WeeklyPlan for rollup visibility.
    if (input.weekNumber) {
      const weeklyPlan = await prisma.weeklyPlan.findFirst({
        where: {
          week_number: input.weekNumber,
          monthPlan: { employee_kr_id: input.employeeKrId },
        },
      });

      if (weeklyPlan) {
        await prisma.weeklyPlan.update({
          where: { id: weeklyPlan.id },
          data: {
            current_value:
              measurement.currentValue !== null &&
                measurement.currentValue !== undefined
                ? String(measurement.currentValue)
                : weeklyPlan.current_value,
            progress_pct: measurement.finalScore ?? weeklyPlan.progress_pct,
          },
        });
      }
    }
  }

  await tryRollupChain("employee_key_result", input.employeeKrId, "progress update");

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

  // 1. Fetch only submittable objectives
  const submittableObjectives = await prisma.employeeObjective.findMany({
    where: {
      id: { in: objectiveIds || [] },
      company_id: companyId,
      status_code: { in: ["draft", "rejected"] },
    },
    select: { id: true },
  });

  for (const obj of submittableObjectives) {
    await submitEmployeeObjective(obj.id, companyId, actorId);
    submittedObjectives++;
  }

  // 2. Fetch only submittable KRs
  const submittableKRs = await prisma.employeeKeyResult.findMany({
    where: {
      id: { in: krIds || [] },
      company_id: companyId,
      status_code: { in: ["draft", "rejected"] },
    },
    select: { id: true },
  });

  for (const kr of submittableKRs) {
    await submitEmployeeKeyResult(kr.id, companyId, actorId);
    submittedKeyResults++;
  }

  return {
    submittedObjectives,
    submittedKeyResults,
  };
}