import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import {
  publishDepartmentPlan,
  submitDepartmentPlan,
  approveDepartmentPlan,
} from "src/services/okrPublishOrchestrator";
import { checkWeightLimit } from "./okrWeightValidationService";
import {
  validateDepartmentPlanningStart,
  validateMonthSequence,
  validatePlanningCadence,
} from "./okrPlanningGateValidator";
import { validateMetricAlignment } from "./okrMetricAlignmentValidator";
import { OkrExecutionMode } from "@prisma/client";
import { getOrCreateFallbackMetric } from "./okrMetricService";
import { validateStatusTransition } from "src/services/okrStatusTransitionService";
import {
  validateTitleAndDescription,
  validateDuplicateKR,
  validateMetricRequirement,
  validateSafePublish,
} from "./okrValidationService";
import { resolveConfigValue } from "./okrConfigResolverService";
import { validateWeightsBeforePublish } from "./okrWeightValidationService";
import { processApprovalAction } from "./okrManagerService";
import { rollupEmployeeKR } from "src/services/okrRollupService";
import { computeMeasurementSnapshot } from "src/services/okrMeasurementService";

async function tryRollupDepartmentKr(employeeKrId: number, reason: string) {
  try {
    await rollupEmployeeKR(employeeKrId);
  } catch (error) {
    console.warn(`Auto-rollup after ${reason} failed:`, error);
  }
}

async function logActivitySafely(
  payload: Parameters<typeof logActivity>[0],
  context: string,
) {
  try {
    await logActivity(payload);
  } catch (error) {
    // Do not fail the business operation after successful writes because of audit log issues.
    console.warn(`[OKR Activity Log] ${context} failed:`, error);
  }
}

// ─── Department Objectives ────────────────────────────────────────────────────

export async function listDepartmentObjectives(
  companyId: number,
  departmentId: number,
  cycleId: number,
) {
  return prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      user_id: {
        in: await prisma.employment
          .findMany({
            where: {
              department_id: departmentId,
              is_active: true,
              company_id: companyId,
            },
            select: { employee_id: true },
          })
          .then((ems) =>
            ems
              .map((e) => e.employee_id)
              .filter((id): id is string => id !== null),
          ),
      },
    },
    orderBy: { created_at: "asc" },
    include: {
      parentCompanyKr: {
        select: {
          id: true,
          title: true,
          is_direct: true,
          is_mandatory_for_completion: true,
          objective: { select: { id: true, title: true, status_code: true } },
        },
      },
      _count: { select: { keyResults: true } },
    },
  });
}

export async function listPendingDepartmentObjectives(
  companyId: number,
  cycleId: number,
) {
  return prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      status_code: { in: ["pending_approval", "submitted"] },
    },
    orderBy: { updated_at: "desc" },
    include: {
      contributor: {
        include: {
          employeeKr: {
            include: {
              employeeObjective: {
                include: {
                  user: {
                    include: {
                      employee: {
                        include: {
                          employments: {
                            where: { is_active: true },
                            include: { department: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      parentCompanyKr: {
        select: {
          id: true,
          title: true,
          objective: { select: { id: true, title: true } },
        },
      },
      _count: { select: { keyResults: true } },
    },
  });
}

export async function listPendingDepartmentKeyResults(
  companyId: number,
  cycleId: number,
  departmentId?: number,
) {
  return prisma.employeeKeyResult.findMany({
    where: {
      company_id: companyId,
      status_code: { in: ["pending_approval", "submitted"] },
      employeeObjective: {
        cycle_id: cycleId,
        ...(departmentId
          ? {
              user_id: {
                in: await prisma.employment
                  .findMany({
                    where: {
                      department_id: departmentId,
                      is_active: true,
                      company_id: companyId,
                    },
                    select: { employee_id: true },
                  })
                  .then((ems) =>
                    ems
                      .map((e) => e.employee_id)
                      .filter((id): id is string => id !== null),
                  ),
              },
            }
          : {}),
      },
    },
    orderBy: { updated_at: "desc" },
    include: {
      employeeObjective: {
        select: {
          id: true,
          title: true,
          status_code: true,
          user: {
            include: {
              employee: {
                include: {
                  employments: {
                    where: { is_active: true },
                    include: { department: true },
                  },
                },
              },
            },
          },
        },
      },
      metricDefinition: {
        select: { id: true, code: true, name: true, category: true },
      },
    },
  });
}

export async function getDepartmentObjectiveDetail(
  id: number,
  companyId: number,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
    include: {
      cycle: true,
      parentCompanyKr: {
        include: {
          metricDefinition: true,
          objective: { select: { id: true, title: true, status_code: true } },
        },
      },
      keyResults: {
        include: {
          metricDefinition: true,
          // EmployeeKeyResult uses weekPlans/subtasks/dailyPlans instead of monthPlans in some versions
          // but I'll check what relations it has.
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!objective) throw new Error("Department objective not found.");

  const activityLog = await prisma.okrActivityLog.findMany({
    where: { entity_type: "EMPLOYEE_OBJECTIVE", entity_id: id },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return { ...objective, activityLog };
}

export const createDepartmentObjective = async (data: {
  companyId: number;
  departmentId: number;
  companyKrId: number; // This is the Company KR ID
  cycleId?: number;
  executionMode: OkrExecutionMode;
  title?: string;
  description?: string;
  createdBy: string;
}) => {
  // Resolve the head of the department
  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
    select: { head: { select: { employee_id: true } } },
  });

  const targetUserId = department?.head?.employee_id;
  if (!targetUserId) {
    throw new Error(
      "This department does not have a designated head. Please assign a department head first.",
    );
  }

  const contributor = await prisma.krContributor.findFirst({
    where: {
      company_id: data.companyId,
      company_kr_id: data.companyKrId,
      user_id: targetUserId,
    },
    include: {
      companyKr: {
        include: { objective: { select: { cycle_id: true } } },
      },
    },
  });

  if (!contributor) {
    throw new Error(
      `Cannot create a Department Objective. The Company KR has not been assigned to the department head (${targetUserId}).`,
    );
  }

  const isAdoption = data.executionMode === "DIRECT_ADOPTION";
  const finalTitle = isAdoption
    ? contributor.companyKr?.title || ""
    : data.title || contributor.companyKr?.title || "";
  const finalDescription = isAdoption
    ? contributor.companyKr?.description || `Directly adopting: ${finalTitle}`
    : data.description || contributor.companyKr?.description;

  if (data.executionMode === "CUSTOMIZED") {
    validateTitleAndDescription(finalTitle, finalDescription || undefined);
  }

  // Check if objective already exists for this contributor
  const existingObjective = await prisma.employeeObjective.findUnique({
    where: { kr_contributor_id: contributor.id },
  });

  let objective;
  if (!existingObjective) {
    // Create new objective
    objective = await prisma.employeeObjective.create({
      data: {
        company_id: data.companyId,
        cycle_id:
          data.cycleId || contributor.companyKr?.objective.cycle_id || 0,
        user_id: contributor.user_id,
        kr_contributor_id: contributor.id,
        chosen_parent_kr_id: contributor.company_kr_id,
        title: finalTitle,
        description: finalDescription,
        status_code: "draft",
        created_by: data.createdBy,
      },
    });

    // Update contributor status
    await prisma.krContributor.update({
      where: { id: contributor.id },
      data: { status_code: "active" },
    });
  } else {
    // Update existing objective
    if (
      existingObjective.status_code !== "draft" &&
      existingObjective.status_code !== "assigned"
    ) {
      throw new Error(
        "Cannot modify an objective that is already submitted or published.",
      );
    }

    objective = await prisma.employeeObjective.update({
      where: { id: existingObjective.id },
      data: {
        title: finalTitle,
        description: finalDescription,
        status_code: "draft",
      },
    });
  }

  await logActivity({
    companyId: data.companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: objective.id,
    actorId: data.createdBy,
    action: isAdoption ? "department_adopted" : "department_customized",
    description: `Department Objective created via ${data.executionMode} for Company KR #${contributor.company_kr_id}`,
  });

  return objective;
};

export async function adoptCompanyKR(
  companyId: number,
  departmentId: number,
  companyKrId: number,
  actorId: string,
) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, company_id: companyId },
    select: {
      id: true,
      head_user_id: true,
      head: { select: { employee_id: true } },
    },
  });
  if (!department) {
    throw new Error("Department not found in this company.");
  }

  const targetUserId = department.head?.employee_id;
  if (!targetUserId) {
    throw new Error(
      "This department does not have a designated head. Please assign a department head first.",
    );
  }

  const kr = await prisma.companyKeyResult.findFirst({
    where: { id: companyKrId, company_id: companyId },
    include: {
      objective: { select: { cycle_id: true } },
    },
  });
  if (!kr) throw new Error("Company key result not found.");

  await validateDepartmentPlanningStart(companyId, companyKrId);

  // Check if assigned to the department head
  const assignment = await prisma.krContributor.findFirst({
    where: {
      user_id: targetUserId,
      company_kr_id: companyKrId,
      company_id: companyId,
    },
  });

  if (!assignment) {
    throw new Error(
      `Cannot adopt Company KR. It must first be assigned to the department head (${targetUserId}).`,
    );
  }

  const existing = await prisma.employeeObjective.findUnique({
    where: { kr_contributor_id: assignment.id },
  });

  let objective;
  if (!existing) {
    objective = await prisma.employeeObjective.create({
      data: {
        company_id: companyId,
        cycle_id: kr.objective.cycle_id,
        user_id: targetUserId,
        title: kr.title,
        description: kr.description || `Adopted from company KR: ${kr.title}`,
        status_code: "draft",
        chosen_parent_kr_id: companyKrId,
        kr_contributor_id: assignment.id,
        created_by: actorId,
      },
    });

    await prisma.krContributor.update({
      where: { id: assignment.id },
      data: { status_code: "active" },
    });
  } else {
    if (
      existing.status_code !== "draft" &&
      existing.status_code !== "assigned"
    ) {
      throw new Error(
        "This company key result has already been adopted and is beyond draft status.",
      );
    }

    objective = await prisma.employeeObjective.update({
      where: { id: existing.id },
      data: {
        title: kr.title,
        description: kr.description || `Adopted from company KR: ${kr.title}`,
        status_code: "draft",
      },
    });
  }

  await logActivity({
    companyId,
    entityType: "COMPANY_KR",
    entityId: companyKrId,
    actorId,
    action: "department_adopted",
    description: `Department #${departmentId} adopted company KR "${kr.title}" for head ${targetUserId}`,
    metadata: { department_id: departmentId, user_id: targetUserId },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: objective.id,
    actorId,
    action: "department_objective_created",
    description: `Department objective created via adoption of company KR "${kr.title}"`,
    metadata: {
      company_kr_id: companyKrId,
      department_id: departmentId,
      user_id: targetUserId,
    },
  });

  return objective;
}

export async function publishDepartmentObjective(
  id: number,
  companyId: number,
  actorId: string,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
    select: { cycle_id: true },
  });
  if (!objective) throw new Error("Department objective not found.");

  const result = await publishDepartmentPlan(
    companyId,
    objective.cycle_id,
    id,
    actorId,
  );
  return { published: true, snapshotId: result.snapshotId };
}

interface CreateDeptKRInput {
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
  isDirect?: boolean;
  isMandatory?: boolean;
  contributorUserId?: string;
  contributorUserIds?: string[];
  contributorRoleType?:
    | "EMPLOYEE"
    | "TEAM_LEADER"
    | "MANAGER"
    | "DIRECTOR"
    | "DEPARTMENT_HEAD";
  contributorRequiredForCompletion?: boolean;
  createdBy: string;
}

export async function createDepartmentKR(input: CreateDeptKRInput) {
  validateTitleAndDescription(input.title, input.description);

  const normalizedWeightPercent =
    input.weightPercent !== undefined ? Number(input.weightPercent) : undefined;
  if (
    normalizedWeightPercent !== undefined &&
    (!Number.isFinite(normalizedWeightPercent) ||
      normalizedWeightPercent < 0 ||
      normalizedWeightPercent > 100)
  ) {
    throw new Error("weight_percent must be a number between 0 and 100.");
  }

  const hasContributorUserId =
    typeof input.contributorUserId === "string" &&
    input.contributorUserId.trim().length > 0;
  const hasContributorUserIds =
    Array.isArray(input.contributorUserIds) &&
    input.contributorUserIds.length > 0;

  const hasContributorRoleType =
    typeof input.contributorRoleType === "string" &&
    input.contributorRoleType.trim().length > 0;

  if (hasContributorUserId && !hasContributorRoleType) {
    throw new Error(
      "contributor_role_type must be provided when assigning a single contributor via contributor_user_id.",
    );
  }

  if (
    input.contributorRequiredForCompletion !== undefined &&
    !hasContributorUserId &&
    !hasContributorUserIds
  ) {
    throw new Error(
      "is_required_for_completion can only be set when contributors are provided.",
    );
  }

  await validateDuplicateKR(
    input.companyId,
    input.title,
    input.employeeObjectiveId,
    "EMPLOYEE",
  );
  await validateMetricRequirement(
    input.companyId,
    input.metricDefinitionId,
    input.isDirect ?? input.contributesToValue,
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

  const deptObj = await prisma.employeeObjective.findFirst({
    where: { id: input.employeeObjectiveId, company_id: input.companyId },
    include: {
      parentCompanyKr: {
        include: { objective: { select: { status_code: true } } },
      },
    },
  });
  if (!deptObj) throw new Error("Department objective not found.");

  const allContributorIds = Array.from(
    new Set([
      ...(hasContributorUserId ? [input.contributorUserId!] : []),
      ...(hasContributorUserIds ? input.contributorUserIds! : []),
    ]),
  ).filter((id) => id && id.trim().length > 0);

  for (const uid of allContributorIds) {
    const userIdAsNum = parseInt(uid);
    const contributorUser = await prisma.appUser.findFirst({
      where: {
        OR: [
          { id: isNaN(userIdAsNum) ? undefined : userIdAsNum },
          { employee_id: uid },
        ],
        company_id: input.companyId,
        is_active: true,
      },
      select: { id: true, employee_id: true },
    });

    if (!contributorUser || !contributorUser.employee_id) {
      throw new Error(
        `Selected contributor user "${uid}" is not active, does not have an employee profile, or does not exist in this company.`,
      );
    }

    const contributorEmployment = await prisma.employment.findFirst({
      where: {
        company_id: input.companyId,
        employee_id: contributorUser.employee_id,
        is_active: true,
      },
      select: { id: true },
    });

    if (!contributorEmployment) {
      throw new Error(
        `Selected contributor "${uid}" must have an active employment record in this company.`,
      );
    }
  }

  await validateDepartmentPlanningStart(
    input.companyId,
    deptObj.chosen_parent_kr_id!,
  );

  if (metricId) {
    const parentKr = await prisma.companyKeyResult.findUnique({
      where: { id: deptObj.chosen_parent_kr_id! },
      select: { metric_definition_id: true },
    });
    await validateMetricAlignment(
      input.companyId,
      parentKr?.metric_definition_id,
      metricId,
      input.isDirect ?? input.contributesToValue ?? true,
    );
  }

  const krCount = await prisma.employeeKeyResult.count({
    where: { employee_objective_id: input.employeeObjectiveId },
  });
  const maxKrs =
    (await resolveConfigValue({
      companyId: input.companyId,
      configKey: "max_krs_per_objective",
      cycleId: deptObj.cycle_id,
    })) || 6;
  if (krCount >= Number(maxKrs)) {
    throw new Error(
      `Maximum of ${maxKrs} key results per department objective reached.`,
    );
  }

  if (
    normalizedWeightPercent !== undefined &&
    (input.contributesToScore ?? true)
  ) {
    await checkWeightLimit(
      input.employeeObjectiveId,
      "DEPARTMENT",
      normalizedWeightPercent,
      input.isDirect ?? input.contributesToScore ?? true,
    );
  }

  const { kr, contributors } = await prisma.$transaction(async (tx) => {
    const createdKr = await tx.employeeKeyResult.create({
      data: {
        company_id: input.companyId,
        employee_objective_id: input.employeeObjectiveId,
        title: input.title,
        description: input.description,
        metric_definition_id: metricId,
        unit_of_measure: input.unitOfMeasure,
        target_value: input.targetValue,
        weight_percent: normalizedWeightPercent,
        is_direct: input.isDirect ?? input.contributesToValue ?? input.contributesToScore ?? true,
        is_mandatory_for_completion: input.isMandatory ?? false,
        status_code: "draft",
        created_by: input.createdBy,
      },
      include: { metricDefinition: true },
    });

    const createdContributors = [];
    for (const uid of allContributorIds) {
      const role =
        uid === input.contributorUserId
          ? input.contributorRoleType || "EMPLOYEE"
          : "EMPLOYEE";

      const isReq =
        uid === input.contributorUserId
          ? (input.contributorRequiredForCompletion ?? true)
          : true;

      const c = await tx.krContributor.create({
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
      createdContributors.push(c);
    }

    return {
      kr: createdKr,
      contributors: createdContributors,
    };
  });

  await logActivitySafely(
    {
      companyId: input.companyId,
      entityType: "EMPLOYEE_KR",
      entityId: kr.id,
      actorId: input.createdBy,
      action: "department_kr_created",
      description: `Department KR "${kr.title}" created`,
      metadata: { employee_objective_id: input.employeeObjectiveId },
    },
    "department_kr_created",
  );

  if (contributors.length > 0) {
    for (const c of contributors) {
      await logActivitySafely(
        {
          companyId: input.companyId,
          entityType: "KR_CONTRIBUTOR",
          entityId: c.id,
          actorId: input.createdBy,
          action: "contributor_assigned",
          description: `User ${c.user_id} assigned as contributor (${c.role_type}) to department KR "${kr.title}"`,
          metadata: {
            employee_kr_id: kr.id,
            user_id: c.user_id,
            role_type: c.role_type,
            is_required_for_completion: c.is_required_for_completion,
            assignment_mode: "inline_create",
          },
        },
        "department_kr_inline_contributor_assigned",
      );
    }
  }

  return {
    ...kr,
    contributors,
  };
}

export async function updateDepartmentKR(
  id: number,
  companyId: number,
  input: Partial<CreateDeptKRInput>,
) {
  const normalizedWeightPercent =
    input.weightPercent !== undefined ? Number(input.weightPercent) : undefined;
  if (
    normalizedWeightPercent !== undefined &&
    (!Number.isFinite(normalizedWeightPercent) ||
      normalizedWeightPercent < 0 ||
      normalizedWeightPercent > 100)
  ) {
    throw new Error("weight_percent must be a number between 0 and 100.");
  }

  if (input.title !== undefined) {
    validateTitleAndDescription(input.title, input.description);
  }

  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Department key result not found.");
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

  if (input.metricDefinitionId || input.isDirect !== undefined || input.contributesToValue !== undefined) {
    const metricToCheck =
      input.metricDefinitionId !== undefined
        ? input.metricDefinitionId
        : kr.metric_definition_id;
    const valueContrib =
      input.isDirect !== undefined
        ? input.isDirect
        : input.contributesToValue !== undefined
          ? input.contributesToValue
          : kr.is_direct;
    await validateMetricRequirement(companyId, metricToCheck, valueContrib);
  }

  if (
    normalizedWeightPercent !== undefined &&
    (input.isDirect ?? input.contributesToScore ?? kr.is_direct)
  ) {
    await checkWeightLimit(
      kr.employee_objective_id,
      "DEPARTMENT",
      normalizedWeightPercent,
      input.isDirect ?? input.contributesToScore ?? kr.is_direct,
      id,
    );
  }

  return prisma.employeeKeyResult.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      unit_of_measure: input.unitOfMeasure,
      target_value: input.targetValue,
      weight_percent: normalizedWeightPercent,
      is_direct: input.isDirect ?? input.contributesToValue ?? input.contributesToScore,
      is_mandatory_for_completion: input.isMandatory,
    },
    include: { metricDefinition: true },
  });
}

export async function listDepartmentKRs(
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
      _count: { select: { monthPlanItems: true } },
    },
  });

  if (krs.length === 0) return [];

  const krIds = krs.map((kr) => kr.id);
  const approvalLogs = await prisma.okrApprovalLog.findMany({
    where: {
      entity_type: "EMPLOYEE_KR",
      entity_id: { in: krIds },
    },
    orderBy: { action_date: "desc" },
    select: {
      id: true,
      entity_id: true,
      action: true,
      comments: true,
      action_date: true,
    },
  });

  const latestLogByKrId = new Map<number, (typeof approvalLogs)[number]>();
  for (const log of approvalLogs) {
    if (!latestLogByKrId.has(log.entity_id)) {
      latestLogByKrId.set(log.entity_id, log);
    }
  }

  return krs.map((kr) => ({
    ...kr,
    current_value: kr.current_value,
    latest_approval_log: latestLogByKrId.get(kr.id) ?? null,
  }));
}

interface CreateMonthPlanInput {
  companyId: number;
  employeeKrId: number;
  monthNumber: number;
  description: string;
  metricDefinitionId?: number;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  isDirect?: boolean;
  createdBy: string;
  actorRole?: string;
}

export async function createMonthPlan(input: CreateMonthPlanInput) {
  const deptKr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: { employeeObjective: true },
  });
  if (!deptKr) throw new Error("Department key result not found.");

  if (input.monthNumber < 1 || input.monthNumber > 3) {
    throw new Error("month_number must be between 1 and 3.");
  }

  await validatePlanningCadence(
    input.companyId,
    deptKr.employeeObjective.cycle_id,
    undefined, // departmentId logic needed if required
    "MONTHLY",
    input.actorRole,
  );

  await validateMonthSequence(
    input.companyId,
    input.employeeKrId,
    input.monthNumber,
    "DEPARTMENT",
  );

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: deptKr.employeeObjective.cycle_id,
    departmentId: undefined, // departmentId logic
    targetValue: input.targetValue,
    currentValue: input.currentValue,
  });

  const existing = await prisma.employeeMonthPlan.findUnique({
    where: {
      month_number_employee_objective_id: {
        month_number: input.monthNumber,
        employee_objective_id: deptKr.employee_objective_id,
      },
    },
  });

  let plan;
  if (existing) {
    plan = await prisma.employeeMonthPlan.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        // EmployeeMonthPlan doesn't have metric_definition_id, target_value etc. in header
        // It has them in EmployeeMonthPlanItem
      } as any,
    });
    await logActivity({
      companyId: input.companyId,
      entityType: "EMPLOYEE_MONTH_PLAN",
      entityId: plan.id,
      actorId: input.createdBy,
      action: "month_plan_updated",
      description: `Month ${input.monthNumber} plan updated for department KR "${deptKr.title}"`,
      metadata: {
        employee_kr_id: input.employeeKrId,
        month_number: input.monthNumber,
      },
    });
  } else {
    plan = await prisma.employeeMonthPlan.create({
      data: {
        company_id: input.companyId,
        employee_objective_id: deptKr.employee_objective_id,
        month_number: input.monthNumber,
        title: `Plan for Month ${input.monthNumber}`,
        description: input.description,
        target_value: input.targetValue,
        status_code: "draft",
        created_by: input.createdBy,
      } as any,
    });

    // Create the item
    await prisma.employeeMonthPlanItem.create({
      data: {
        company_id: input.companyId,
        employee_month_plan_id: plan.id,
        employee_kr_id: input.employeeKrId,
        target_value: measurement.targetValue || 0,
        current_value: measurement.currentValue,
        note: input.description,
      },
    });
    await logActivity({
      companyId: input.companyId,
      entityType: "EMPLOYEE_MONTH_PLAN",
      entityId: plan.id,
      actorId: input.createdBy,
      action: "month_plan_created",
      description: `Month ${input.monthNumber} plan created for department KR "${deptKr.title}"`,
      metadata: {
        employee_kr_id: input.employeeKrId,
        month_number: input.monthNumber,
      },
    });
  }

  await tryRollupDepartmentKr(
    input.employeeKrId,
    "department month plan upsert",
  );

  return plan;
}

export async function listMonthPlans(employeeKrId: number, companyId: number) {
  const kr = await prisma.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    select: { employee_objective_id: true },
  });
  if (!kr) throw new Error("Key result not found.");

  return prisma.employeeMonthPlan.findMany({
    where: {
      employee_objective_id: kr.employee_objective_id,
      company_id: companyId,
    },
    include: { items: { where: { employee_kr_id: employeeKrId } } },
    orderBy: { month_number: "asc" },
  });
}

export interface CreateWeeklyPlanInput {
  companyId: number;
  employeeKrId: number;
  weekNumber: number;
  description: string;
  metricDefinitionId?: number;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToParentScore?: boolean;
  contributesToParentValue?: boolean;
  isDirect?: boolean;
  createdBy: string;
  actorRole?: string;
}

export async function createWeeklyPlan(input: CreateWeeklyPlanInput) {
  const deptKr = await prisma.employeeKeyResult.findFirst({
    where: { id: input.employeeKrId, company_id: input.companyId },
    include: { employeeObjective: true },
  });
  if (!deptKr) throw new Error("Department key result not found.");

  if (input.weekNumber < 1 || input.weekNumber > 13) {
    throw new Error("week_number must be between 1 and 13.");
  }

  await validatePlanningCadence(
    input.companyId,
    deptKr.employeeObjective.cycle_id,
    undefined, // departmentId logic
    "WEEKLY",
    input.actorRole,
  );

  const monthPlan = await prisma.employeeMonthPlan.findFirst({
    where: {
      employee_objective_id: deptKr.employee_objective_id,
      month_number: Math.ceil(input.weekNumber / 4), // Simple mapping
    },
  });
  if (!monthPlan)
    throw new Error("Month plan must exist before creating weekly plan.");

  if (input.weekNumber > 1) {
    const prev = await prisma.weeklyPlan.findFirst({
      where: {
        employee_kr_id: input.employeeKrId,
        employee_month_plan_id: monthPlan.id,
        week_number: input.weekNumber - 1,
      },
    });
    if (!prev) {
      throw new Error(
        `Week ${input.weekNumber - 1} plan must exist before creating week ${input.weekNumber}.`,
      );
    }
  }

  const existing = await prisma.weeklyPlan.findFirst({
    where: {
      employee_kr_id: input.employeeKrId,
      employee_month_plan_id: monthPlan.id,
      week_number: input.weekNumber,
    },
  });

  let plan;
  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: deptKr.employeeObjective.cycle_id,
    departmentId: undefined, // departmentId
    targetValue: input.targetValue,
    currentValue: input.currentValue,
  });

  if (existing) {
    plan = await prisma.weeklyPlan.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        metric_definition_id: input.metricDefinitionId,
        target_value: measurement.targetValue,
        current_value: measurement.currentValue,
        weight_percent: input.weightPercent,
        confidence_level: measurement.confidenceLevel as any,
        is_direct: input.isDirect ?? true,
      } as any,
    });
    await logActivity({
      companyId: input.companyId,
      entityType: "WEEKLY_PLAN",
      entityId: plan.id,
      actorId: input.createdBy,
      action: "weekly_plan_updated",
      description: `Week ${input.weekNumber} plan updated for department KR "${deptKr.title}"`,
      metadata: {
        employee_kr_id: input.employeeKrId,
        week_number: input.weekNumber,
      },
    });
  } else {
    plan = await prisma.weeklyPlan.create({
      data: {
        company_id: input.companyId,
        employee_kr_id: input.employeeKrId,
        employee_month_plan_id: monthPlan.id,
        week_number: input.weekNumber,
        title: `Week ${input.weekNumber} plan`,
        description: input.description,
        metric_definition_id: input.metricDefinitionId,
        target_value: measurement.targetValue,
        current_value: measurement.currentValue,
        weight_percent: input.weightPercent,
        confidence_level: measurement.confidenceLevel as any,
        is_direct: input.isDirect ?? true,
        status_code: "draft",
        created_by: input.createdBy,
      } as any,
    });
    await logActivity({
      companyId: input.companyId,
      entityType: "WEEKLY_PLAN",
      entityId: plan.id,
      actorId: input.createdBy,
      action: "weekly_plan_created",
      description: `Week ${input.weekNumber} plan created for department KR "${deptKr.title}"`,
      metadata: {
        employee_kr_id: input.employeeKrId,
        week_number: input.weekNumber,
      },
    });
  }

  await tryRollupDepartmentKr(
    input.employeeKrId,
    "department weekly plan upsert",
  );

  return plan;
}

export async function listWeeklyPlans(employeeKrId: number, companyId: number) {
  return prisma.weeklyPlan.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { week_number: "asc" },
    include: {
      tasks: {
        include: {
          dailyPlans: { orderBy: { created_at: "asc" } },
          _count: { select: { dailyPlans: true } },
        },
      },
    },
  });
}

export interface CreateDepartmentDailyPlanInput {
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
  isDirect?: boolean;
  createdBy: string;
  actorRole?: string;
}

export async function createDepartmentDailyPlan(
  input: CreateDepartmentDailyPlanInput,
) {
  // if (!input.weeklyTaskRef || input.weeklyTaskRef.trim().length === 0) {
  //   throw new Error("weekly_task_ref is required for daily plans.");
  // }

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
                select: { cycle_id: true, department_id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new Error("Department weekly task not found.");
  }
  const weeklyPlan = task.weeklyPlan;

  await validatePlanningCadence(
    input.companyId,
    weeklyPlan.employeeKr.employeeObjective.cycle_id,
    weeklyPlan.employeeKr.employeeObjective.department_id ?? undefined,
    "DAILY",
    input.actorRole,
  );

  const measurement = await computeMeasurementSnapshot({
    companyId: input.companyId,
    cycleId: weeklyPlan.employeeKr.employeeObjective.cycle_id,
    departmentId:
      weeklyPlan.employeeKr.employeeObjective.department_id ?? undefined,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
  });

  const dailyPlan = await prisma.dailyPlan.create({
    data: {
      company_id: input.companyId,
      weekly_task_id: input.weeklyTaskId,
      title: input.title,
      weekly_task_ref: input.weeklyTaskRef,
      completion_day: input.completionDay as any,
      description: input.description,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      is_direct: input.isDirect ?? true,
      status_code: "pending",
      created_by: input.createdBy,
    } as any,
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "DAILY_PLAN",
    entityId: dailyPlan.id,
    actorId: input.createdBy,
    action: "department_daily_plan_created",
    description: `Department daily plan '${dailyPlan.title}' created for week task ${task.id}`,
    metadata: {
      weekly_task_id: input.weeklyTaskId,
      week_number: weeklyPlan.week_number,
    },
  });

  await tryRollupDepartmentKr(
    weeklyPlan.employee_kr_id,
    "department daily plan creation",
  );

  return dailyPlan;
}

export async function updateDepartmentDailyPlan(
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
    isDirect?: boolean;
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
                include: {
                  employeeObjective: {
                    select: { cycle_id: true, department_id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dailyPlan) {
    throw new Error("Department daily plan not found.");
  }

  const measurement = await computeMeasurementSnapshot({
    companyId,
    cycleId: dailyPlan.weeklyTask.weeklyPlan.employeeKr.employeeObjective.cycle_id,
    departmentId:
      dailyPlan.weeklyTask.weeklyPlan.employeeKr.employeeObjective.department_id ??
      undefined,
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
      weekly_task_ref: input.weeklyTaskRef,
      completion_day: input.completionDay as any,
      description: input.description,
      status_code: input.statusCode,
      metric_definition_id: input.metricDefinitionId,
      target_value: measurement.targetValue,
      current_value: measurement.currentValue,
      weight_percent: input.weightPercent,
      progress_percent: measurement.progressPercent,
      confidence_level: measurement.confidenceLevel as any,
      is_direct: input.isDirect,
      completed_at: input.statusCode === "completed" ? new Date() : undefined,
    } as any,
  });

  await tryRollupDepartmentKr(
    dailyPlan.weeklyTask.weeklyPlan.employee_kr_id,
    "department daily plan update",
  );

  return updated;
}

export async function deleteDepartmentDailyPlan(id: number, companyId: number) {
  const dailyPlan = await prisma.dailyPlan.findFirst({
    where: { id, company_id: companyId },
    include: {
      weeklyTask: {
        include: {
          weeklyPlan: {
            select: { employee_kr_id: true },
          },
        },
      },
    },
  });

  if (!dailyPlan) {
    throw new Error("Department daily plan not found.");
  }

  await prisma.dailyPlan.delete({ where: { id } });

  await tryRollupDepartmentKr(
    dailyPlan.weeklyTask.weeklyPlan.employee_kr_id,
    "department daily plan delete",
  );

  return { deleted: true };
}

export async function listDepartmentDailyPlans(
  weeklyTaskId: number,
  companyId: number,
) {
  return prisma.dailyPlan.findMany({
    where: {
      company_id: companyId,
      weekly_task_id: weeklyTaskId,
    },
    orderBy: { created_at: "asc" },
  });
}

export async function publishDepartmentKeyResult(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Department key result not found.");
  if (kr.status_code === "published") {
    return kr;
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_KR",
    fromStatus: kr.status_code,
    toStatus: "published",
  });

  const objectiveId = kr.employee_objective_id;
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: objectiveId },
    select: { cycle_id: true, status_code: true },
  });

  if (objective) {
    await validateSafePublish(
      companyId,
      objectiveId,
      "DEPARTMENT",
      objective.cycle_id,
    );
    await validateWeightsBeforePublish(
      companyId,
      objective.cycle_id,
      objectiveId,
      "DEPARTMENT",
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
    description: `Department key result "${kr.title}" published individually`,
  });

  return updated;
}

export async function approveDepartmentKeyResult(
  id: number,
  companyId: number,
  actorId: string,
  userRole: string,
  action?: string,
  comments?: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Department key result not found.");

  const isRejection = action === "CHANGES_REQUESTED" || action === "REJECTED";

  if (!isRejection) {
    // Default approve path
    if (kr.status_code === "approved") {
      return kr;
    }
    if (kr.status_code === "published") {
      throw new Error(
        "Published department key results cannot be approved again.",
      );
    }

    await validateStatusTransition({
      companyId,
      entityType: "EMPLOYEE_KR",
      fromStatus: kr.status_code,
      toStatus: "approved",
      userRole,
    });

    const updated = await prisma.employeeKeyResult.update({
      where: { id },
      data: {
        status_code: "approved",
        approved_by: actorId,
      },
    });

    await prisma.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_KR" as any,
        entity_id: id,
        approver_id: actorId,
        action: "APPROVED" as any,
        comments: comments || null,
      },
    });

    await logActivity({
      companyId,
      entityType: "EMPLOYEE_KR",
      entityId: updated.id,
      actorId,
      action: "approve_action",
      description: `Department key result "${updated.title}" approved`,
    });

    // Cascade approval UP to the parent Objective if it's pending
    if (updated.employee_objective_id) {
      const parentObj = await prisma.employeeObjective.findUnique({
        where: { id: updated.employee_objective_id },
      });
      if (
        parentObj &&
        ["submitted", "pending_approval"].includes(parentObj.status_code)
      ) {
        await approveDepartmentObjective(
          parentObj.id,
          companyId,
          actorId,
          userRole,
          comments
            ? `${comments} (Auto-approved via KR #${id})`
            : `Automatically approved via KR #${id}`,
          "approved",
        );
      }
    }

    return updated;
  }

  // Rejection / changes-requested path
  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_KR",
    fromStatus: kr.status_code,
    toStatus: "draft",
  });

  const updated = await prisma.employeeKeyResult.update({
    where: { id },
    data: {
      status_code: "draft",
    },
  });

  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: "EMPLOYEE_KR" as any,
      entity_id: id,
      approver_id: actorId,
      action: "CHANGES_REQUESTED" as any,
      comments: comments || null,
    },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: updated.id,
    actorId,
    action: "changes_requested",
    description: `Department key result "${updated.title}" — changes requested${comments ? `: ${comments}` : ""}`,
  });

  return updated;
}

export async function submitDepartmentKeyResult(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Department key result not found.");

  if (kr.status_code === "submitted" || kr.status_code === "pending_approval") {
    return kr;
  }
  if (kr.status_code === "published") {
    throw new Error(
      "Published department key results cannot be submitted for review.",
    );
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_KR",
    fromStatus: kr.status_code,
    toStatus: "submitted",
  });

  const updated = await prisma.employeeKeyResult.update({
    where: { id },
    data: { status_code: "submitted" },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: updated.id,
    actorId,
    action: "submit_for_review",
    description: `Department key result "${updated.title}" submitted for approval`,
  });

  return updated;
}

export async function submitDepartmentObjective(
  id: number,
  companyId: number,
  actorId: string,
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
    select: { cycle_id: true },
  });
  if (!objective) throw new Error("Department objective not found.");

  return submitDepartmentPlan(companyId, objective.cycle_id, id, actorId);
}

export async function approveDepartmentObjective(
  id: number,
  companyId: number,
  actorId: string,
  userRole: string,
  comments?: string,
  targetStatus: string = "published",
) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id, company_id: companyId },
    select: { cycle_id: true },
  });
  if (!objective) throw new Error("Department objective not found.");

  return approveDepartmentPlan(
    companyId,
    objective.cycle_id,
    id,
    actorId,
    userRole,
    comments,
    targetStatus,
  );
}

export async function bulkSubmitDepartment(
  objectiveIds: number[],
  krIds: number[],
  companyId: number,
  actorId: string,
) {
  let submittedObjectives = 0;
  let submittedKeyResults = 0;

  for (const id of objectiveIds || []) {
    await submitDepartmentObjective(id, companyId, actorId);
    submittedObjectives++;
  }

  for (const id of krIds || []) {
    await submitDepartmentKeyResult(id, companyId, actorId);
    submittedKeyResults++;
  }

  return { submittedObjectives, submittedKeyResults };
}

export async function bulkApproveDepartment(
  objectiveIds: number[],
  krIds: number[],
  companyId: number,
  actorId: string,
  userRole: string,
  action?: string,
  comments?: string,
) {
  let approvedObjectives = 0;
  let approvedKeyResults = 0;

  for (const id of objectiveIds || []) {
    await approveDepartmentObjective(id, companyId, actorId, userRole);
    approvedObjectives++;
  }

  for (const id of krIds || []) {
    await approveDepartmentKeyResult(
      id,
      companyId,
      actorId,
      userRole,
      action,
      comments,
    );
    approvedKeyResults++;
  }

  return { approvedObjectives, approvedKeyResults };
}

// ─── Department Unified Approvals ────────────────────────────────────────────────

export async function listPendingDepartmentApprovals(
  companyId: number,
  cycleId: number,
  departmentId?: number,
) {
  // Get all department heads in the given scope
  const departments = await prisma.department.findMany({
    where: {
      company_id: companyId,
      ...(departmentId ? { id: departmentId } : {}),
    },
    include: { head: true },
  });

  const headIds = departments
    .map((d) => d.head?.employee_id)
    .filter((id): id is string => id !== null && id !== undefined);

  if (headIds.length === 0) {
    return {
      pending_objectives: [],
      pending_krs: [],
      pending_month_plans: [],
      pending_weekly_plans: [],
      pending_daily_plans: [],
    };
  }

  const [
    pending_objectives,
    pending_krs,
    pending_month_plans,
    pending_weekly_plans,
    pending_daily_plans,
  ] = await Promise.all([
    prisma.employeeObjective.findMany({
      where: {
        company_id: companyId,
        cycle_id: cycleId,
        status_code: { in: ["submitted", "pending_approval"] },
        user_id: { in: headIds },
      },
      include: {
        user: { select: { employee: { select: { full_name: true } } } },
      },
    }),
    prisma.employeeKeyResult.findMany({
      where: {
        company_id: companyId,
        status_code: { in: ["submitted", "pending_approval"] },
        employeeObjective: {
          cycle_id: cycleId,
          user_id: { in: headIds },
        },
      },
      include: {
        employeeObjective: {
          select: { user: { select: { employee: { select: { full_name: true } } } } },
        },
      },
    }),
    prisma.employeeMonthPlan.findMany({
      where: {
        company_id: companyId,
        status_code: { in: ["submitted", "pending_approval"] },
        employeeObjective: {
          cycle_id: cycleId,
          user_id: { in: headIds },
        },
      },
      include: {
        employeeObjective: {
          select: { user: { select: { employee: { select: { full_name: true } } } } },
        },
      },
    }),
    prisma.weeklyPlan.findMany({
      where: {
        company_id: companyId,
        status_code: { in: ["submitted", "pending_approval"] },
        employeeKr: {
          employeeObjective: {
            cycle_id: cycleId,
            user_id: { in: headIds },
          },
        },
      },
      include: {
        employeeKr: {
          select: {
            employeeObjective: {
              select: { user: { select: { employee: { select: { full_name: true } } } } },
            },
          },
        },
      },
    }),
    prisma.dailyPlan.findMany({
      where: {
        company_id: companyId,
        status_code: { in: ["submitted", "pending_approval"] },
        weeklyTask: {
          weeklyPlan: {
            employeeKr: {
              employeeObjective: {
                cycle_id: cycleId,
                user_id: { in: headIds },
              },
            },
          },
        },
      },
      include: {
        weeklyTask: {
          select: {
            weeklyPlan: {
              select: {
                employeeKr: {
                  select: {
                    employeeObjective: {
                      select: { user: { select: { employee: { select: { full_name: true } } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    pending_objectives: pending_objectives.map((o) => ({
      ...o,
      employee_name: o.user?.employee?.full_name || "Unknown",
    })),
    pending_krs: pending_krs.map((k) => ({
      ...k,
      employee_name: k.employeeObjective?.user?.employee?.full_name || "Unknown",
    })),
    pending_month_plans: pending_month_plans.map((m) => ({
      ...m,
      employee_name: m.employeeObjective?.user?.employee?.full_name || "Unknown",
    })),
    pending_weekly_plans: pending_weekly_plans.map((w) => ({
      ...w,
      employee_name: w.employeeKr?.employeeObjective?.user?.employee?.full_name || "Unknown",
    })),
  };
}

export async function bulkApproveDepartmentItems(
  objectiveIds: number[],
  krIds: number[],
  monthPlanIds: number[],
  weeklyPlanIds: number[],
  dailyPlanIds: number[],
  companyId: number,
  approverId: string,
  action: "APPROVED" | "CHANGES_REQUESTED" | "PUBLISHED",
  comments?: string,
) {
  const failed: { entity_type: string; entity_id: number; reason: string }[] = [];
  let processed = 0;

  const processList = async (
    ids: number[],
    entityType: "EMPLOYEE_OBJECTIVE" | "EMPLOYEE_KR" | "EMPLOYEE_MONTH_PLAN" | "WEEKLY_PLAN" | "DAILY_PLAN",
  ) => {
    for (const id of ids) {
      try {
        await processApprovalAction({
          companyId,
          entityType,
          entityId: id,
          action,
          approverId,
          comments,
        });
        processed++;
      } catch (err: any) {
        failed.push({
          entity_type: entityType,
          entity_id: id,
          reason: err?.message || "Unknown error",
        });
      }
    }
  };

  await processList(objectiveIds, "EMPLOYEE_OBJECTIVE");
  await processList(krIds, "EMPLOYEE_KR");
  await processList(monthPlanIds, "EMPLOYEE_MONTH_PLAN");
  await processList(weeklyPlanIds, "WEEKLY_PLAN");
  await processList(dailyPlanIds, "DAILY_PLAN");

  return { processed, failed };
}

export async function approveDepartmentItem(
  entityType: "EMPLOYEE_OBJECTIVE" | "EMPLOYEE_KR" | "EMPLOYEE_MONTH_PLAN" | "WEEKLY_PLAN" | "DAILY_PLAN",
  entityId: number,
  companyId: number,
  approverId: string,
  action: "APPROVED" | "CHANGES_REQUESTED" | "PUBLISHED",
  comments?: string,
) {
  await processApprovalAction({
    companyId,
    entityType,
    entityId,
    action,
    approverId,
    comments,
  });
  return { success: true };
}

