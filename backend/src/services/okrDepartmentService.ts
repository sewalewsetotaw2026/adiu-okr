import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import {
  publishDepartmentPlan,
  submitDepartmentPlan,
  approveDepartmentPlan,
} from "src/services/okrPublishOrchestrator";
import * as approvalService from "./okrApprovalService";
import { OkrSubmissionType, Prisma } from "@prisma/client";
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
import { rollupFromDepartmentKr } from "src/services/okrRollupService";
import { computeMeasurementSnapshot } from "src/services/okrMeasurementService";
import { resolveDepartmentHeadEmployeeIds } from "./okrCompanyService";

async function tryRollupDepartmentKr(employeeKrId: number, reason: string) {
  try {
    await rollupFromDepartmentKr(employeeKrId);
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
          contributes_to_objective_score: true,
          contributes_to_objective_value: true,
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
      user: {
        include: {
          employee: {
            select: { full_name: true },
          },
        },
      },
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
        include: {
          user: {
            include: {
              employee: {
                select: { full_name: true },
              },
            },
          },
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
        },
      },
      metricDefinition: {
        select: { id: true, code: true, name: true, category: true },
      },
    },
  });
}

export async function listDepartmentPendingApprovals(
  companyId: number,
  cycleId: number,
  departmentId?: number,
) {
  const pending_objectives = await listPendingDepartmentObjectives(
    companyId,
    cycleId,
  );
  const pending_krs = await listPendingDepartmentKeyResults(companyId, cycleId, departmentId);

  // Monthly plans (new schema: child of EmployeeKeyResult).
  const pending_month_plans = await prisma.employeeMonthPlan.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      plan_status: "SUBMITTED",
    },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            include: {
              user: {
                include: {
                  employee: {
                    select: { full_name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  // Weekly plans (new schema: child of EmployeeMonthPlan).
  const pending_weekly_plans = await prisma.weeklyPlan.findMany({
    where: {
      company_id: companyId,
      plan_status: "SUBMITTED",
      monthPlan: { cycle_id: cycleId },
    },
    include: {
      monthPlan: {
        include: {
          employeeKr: {
            include: {
              employeeObjective: {
                include: {
                  user: {
                    include: {
                      employee: {
                        select: { full_name: true },
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
    orderBy: { updated_at: "desc" },
  });

  // Daily plans don't have a submission lifecycle; surface in-progress tasks.
  const pending_daily_plans = await prisma.dailyPlan.findMany({
    where: {
      company_id: companyId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      weeklyPlan: {
        monthPlan: { cycle_id: cycleId },
      },
    },
    include: {
      weeklyPlan: {
        include: {
          monthPlan: {
            include: {
              employeeKr: {
                include: {
                  employeeObjective: {
                    include: {
                      user: {
                        include: {
                          employee: {
                            select: { full_name: true },
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
    },
    orderBy: { updated_at: "desc" },
  });

  // Flattening employee name for the frontend to match its expectations
  const mapWithEmployee = (items: any[]) =>
    items.map((item) => {
      const obj =
        item.employeeKr?.employeeObjective ||
        item.monthPlan?.employeeKr?.employeeObjective ||
        item.weeklyPlan?.monthPlan?.employeeKr?.employeeObjective;
      return {
        ...item,
        employee: {
          full_name: obj?.user?.employee?.full_name || "—",
        },
      };
    });

  return {
    pending_objectives: pending_objectives.map((o: any) => ({
      ...o,
      employee: {
        full_name: o.user?.employee?.full_name || "—",
      },
    })),
    pending_krs: pending_krs.map((k: any) => ({
      ...k,
      employee: {
        full_name: k.employeeObjective?.user?.employee?.full_name || "—",
      },
    })),
    pending_month_plans: mapWithEmployee(pending_month_plans),
    pending_weekly_plans: mapWithEmployee(pending_weekly_plans),
    pending_daily_plans: mapWithEmployee(pending_daily_plans),
  };
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
  companyKrId: number;
  cycleId?: number;
  executionMode: OkrExecutionMode;
  title?: string;
  description?: string;
  createdBy: string;
  contributesToScore?: boolean;
  contributesToValue?: boolean;
}) => {
  // 1. Find the correct contributor assignment for this department and Company KR
  let assignment = await prisma.krContributor.findFirst({
    where: {
      company_kr_id: data.companyKrId,
      company_id: data.companyId,
      user: {
        employee: {
          employments: {
            some: {
              department_id: data.departmentId,
              is_active: true,
            },
          },
        },
      },
    },
  });

  // Fallback: If not found, try to resolve by department head
  if (!assignment && data.departmentId) {
    const heads = await resolveDepartmentHeadEmployeeIds(data.companyId, [data.departmentId]);
    if (heads.length > 0) {
      assignment = await prisma.krContributor.findFirst({
        where: {
          user_id: heads[0],
          company_kr_id: data.companyKrId,
          company_id: data.companyId,
        },
      });
    }
  }

  // Final Fallback to creator (for individual assignments)
  if (!assignment) {
    assignment = await prisma.krContributor.findFirst({
      where: {
        user_id: data.createdBy,
        company_kr_id: data.companyKrId,
        company_id: data.companyId,
      },
    });
  }

  if (!assignment) {
    throw new Error(
      "Cannot create a Department Objective. The Company KR has not been assigned to this department or its head.",
    );
  }

  // 2. Check if an objective already exists for this assignment
  const existingObjective = await prisma.employeeObjective.findUnique({
    where: { kr_contributor_id: assignment.id },
  });

  if (!existingObjective) {


    await validateDepartmentPlanningStart(data.companyId, data.companyKrId);

    const companyKR = await prisma.companyKeyResult.findFirst({
      where: { id: data.companyKrId, company_id: data.companyId },
      include: { objective: { select: { cycle_id: true } } },
    });
    if (!companyKR) throw new Error("Company key result not found.");

    const isAdoption = data.executionMode === "DIRECT_ADOPTION";
    const finalTitle = isAdoption
      ? companyKR.title || ""
      : data.title || companyKR.title || "";
    const finalDescription = isAdoption
      ? companyKR.description || `Directly adopting: ${finalTitle}`
      : data.description || companyKR.description;

    if (data.executionMode === "CUSTOMIZED") {
      validateTitleAndDescription(finalTitle, finalDescription || undefined);
    }

    const created = await prisma.employeeObjective.create({
      data: {
        company_id: data.companyId,
        cycle_id: companyKR.objective.cycle_id,
        department_id: data.departmentId,
        user_id: assignment.user_id, // Ownership goes to the contributor
        title: finalTitle,
        description: finalDescription,
        status_code: "draft",
        chosen_parent_kr_id: data.companyKrId,
        kr_contributor_id: assignment.id,
        created_by: data.createdBy,
      },
    });

    await logActivity({
      companyId: data.companyId,
      entityType: "EMPLOYEE_OBJECTIVE",
      entityId: created.id,
      actorId: data.createdBy,
      action: isAdoption ? "department_adopted" : "department_customized",
      description: `Department Objective created via ${data.executionMode} for Company KR #${data.companyKrId}`,
    });

    return created;
  }

  if (existingObjective.status_code === "assigned") {
    const isAdoption = data.executionMode === "DIRECT_ADOPTION";
    const companyKR = await prisma.companyKeyResult.findFirst({
      where: { id: data.companyKrId },
    });

    const finalTitle = isAdoption
      ? companyKR?.title || ""
      : data.title || companyKR?.title || "";
    const finalDescription = isAdoption
      ? companyKR?.description || `Directly adopting: ${finalTitle}`
      : data.description || companyKR?.description;

    if (data.executionMode === "CUSTOMIZED") {
      validateTitleAndDescription(finalTitle, finalDescription || undefined);
    }

    const updated = await prisma.employeeObjective.update({
      where: { id: existingObjective.id },
      data: {
        title: finalTitle,
        description: finalDescription,
        // execution_mode removed from EmployeeObjective in schema
        status_code: "draft",
      },
    });

    await logActivity({
      companyId: data.companyId,
      entityType: "EMPLOYEE_OBJECTIVE",
      entityId: updated.id,
      actorId: data.createdBy,
      action: isAdoption ? "department_adopted" : "department_customized",
      description: `Department Objective created via ${data.executionMode} for Company KR #${data.companyKrId}`,
    });

    return updated;
  } else if (existingObjective.status_code === "draft") {
    if (data.executionMode === "CUSTOMIZED") {
      const newTitle = data.title || existingObjective.title;
      const newDescription =
        data.description ?? existingObjective.description ?? undefined;
      validateTitleAndDescription(newTitle, newDescription);
      // Verify department
      const department = await prisma.department.findFirst({
        where: { id: data.departmentId, company_id: data.companyId },
        select: { id: true },
      });
      if (!department) {
        throw new Error("Department not found in this company.");
      }

      const updated = await prisma.employeeObjective.update({
        where: { id: existingObjective.id },
        data: {
          // execution_mode removed
          title: newTitle,
        },
      });

      await logActivity({
        companyId: data.companyId,
        entityType: "EMPLOYEE_OBJECTIVE",
        entityId: updated.id,
        actorId: data.createdBy,
        action: "department_customized",
        description: `Department Objective updated from existing draft for Company KR #${data.companyKrId}`,
      });

      return updated;
    }
    return existingObjective;
  }

  throw new Error(
    "Cannot modify an objective that is already submitted or published.",
  );
};

export async function adoptCompanyKR(
  companyId: number,
  departmentId: number,
  companyKrId: number,
  actorId: string,
) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, company_id: companyId },
    select: { id: true },
  });
  if (!department) {
    throw new Error("Department not found in this company.");
  }

  const kr = await prisma.companyKeyResult.findFirst({
    where: { id: companyKrId, company_id: companyId },
    include: {
      objective: { select: { cycle_id: true } },
    },
  });
  if (!kr) throw new Error("Company key result not found.");

  await validateDepartmentPlanningStart(companyId, companyKrId);

  const existing = await prisma.employeeObjective.findFirst({
    where: {
      user_id: actorId,
      chosen_parent_kr_id: companyKrId,
      company_id: companyId,
    },
  });

  if (!existing) {
    const isAssigned = await prisma.krContributor.findFirst({
      where: {
        user_id: actorId,
        company_kr_id: companyKrId,
        company_id: companyId,
      },
    });
    if (!isAssigned) {
      throw new Error(
        "Cannot adopt Company KR. It must first be assigned to you.",
      );
    }

    const created = await prisma.employeeObjective.create({
      data: {
        company_id: companyId,
        cycle_id: kr.objective.cycle_id,
        user_id: actorId,
        title: kr.title,
        description: kr.description || `Adopted from company KR: ${kr.title}`,
        status_code: "draft",
        chosen_parent_kr_id: companyKrId,
        kr_contributor_id: isAssigned.id,
        created_by: actorId,
      },
    });
    return created;
  }

  if (existing.status_code !== "draft" && existing.status_code !== "assigned") {
    throw new Error("You have already adopted this company key result.");
  }

  const updated = await prisma.employeeObjective.update({
    where: { id: existing.id },
    data: {
      title: kr.title,
      description: kr.description || `Adopted from company KR: ${kr.title}`,
      status_code: "draft",
    },
  });

  await logActivity({
    companyId,
    entityType: "COMPANY_KR",
    entityId: companyKrId,
    actorId,
    action: "department_adopted",
    description: `Department #${departmentId} adopted company KR "${kr.title}"`,
    metadata: { department_id: departmentId },
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: updated.id,
    actorId,
    action: "department_objective_created",
    description: `Department objective created via adoption of company KR "${kr.title}"`,
    metadata: { company_kr_id: companyKrId, department_id: departmentId },
  });

  return updated;
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
      input.contributesToValue ?? true,
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
        contributes_to_objective_score: input.contributesToScore ?? true,
        contributes_to_objective_value: input.contributesToValue ?? true,
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

  if (
    normalizedWeightPercent !== undefined &&
    (input.contributesToScore ?? kr.contributes_to_objective_score)
  ) {
    await checkWeightLimit(
      kr.employee_objective_id,
      "DEPARTMENT",
      normalizedWeightPercent,
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
      contributes_to_objective_score: input.contributesToScore,
      contributes_to_objective_value: input.contributesToValue,
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
      _count: { select: { monthlyPlans: true } },
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
    current_value: kr.final_value,
    latest_approval_log: latestLogByKrId.get(kr.id) ?? null,
  }));
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
    entityType: "DEPARTMENT_KR",
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
      entityType: "DEPARTMENT_KR",
      fromStatus: kr.status_code,
      toStatus: "approved",
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
        entity_type: "DEPARTMENT_KR" as any,
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

    return updated;
  }

  // Rejection / changes-requested path
  await validateStatusTransition({
    companyId,
    entityType: "DEPARTMENT_KR",
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
      entity_type: "DEPARTMENT_KR" as any,
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
    entityType: "DEPARTMENT_KR",
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
    select: { cycle_id: true, department_id: true },
  });
  if (!objective) throw new Error("Department objective not found.");

  return approvalService.submitForApproval({
    companyId,
    cycleId: objective.cycle_id,
    submitterId: actorId,
    departmentId: objective.department_id || undefined,
    entityId: id,
    type: "QUARTERLY_PLANNING",
  });
}

export async function approveDepartmentObjective(
  id: number,
  companyId: number,
  actorId: string,
  userRole: string,
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
  );
}

export async function bulkSubmitDepartment(
  objectiveIds: number[],
  krIds: number[],
  companyId: number,
  actorId: string,
) {
  if (objectiveIds.length === 0) {
    throw new Error("No objectives selected for submission.");
  }

  // Find cycleId and departmentId from the first objective
  const firstObj = await prisma.employeeObjective.findFirst({
    where: { id: objectiveIds[0], company_id: companyId },
    select: { cycle_id: true, department_id: true },
  });

  if (!firstObj) throw new Error("Objective not found.");

  // Use the unified approval service for bulk submission
  return approvalService.submitForApproval({
    companyId,
    cycleId: firstObj.cycle_id,
    submitterId: actorId,
    departmentId: firstObj.department_id || undefined,
    type: "QUARTERLY_PLANNING",
  });
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
    await approveDepartmentKeyResult(id, companyId, actorId, action, comments);
    approvedKeyResults++;
  }

  return { approvedObjectives, approvedKeyResults };
}

export async function approveDepartmentMonthPlan(
  id: number,
  companyId: number,
  actorId: string,
  action?: string,
  comments?: string,
) {
  const plan = await prisma.employeeMonthPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Department month plan not found.");

  const isRejection = action === "CHANGES_REQUESTED" || action === "REJECTED";
  const targetStatus = isRejection ? "DRAFT" : "APPROVED";

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_MONTH_PLAN",
    fromStatus: plan.plan_status as any,
    toStatus: targetStatus.toLowerCase(),
  });

  const updated = await prisma.employeeMonthPlan.update({
    where: { id },
    data: {
      plan_status: targetStatus as any,
      approved_at: isRejection ? undefined : new Date(),
    },
  });

  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: "EMPLOYEE_MONTH_PLAN" as any,
      entity_id: id,
      approver_id: actorId,
      action: (isRejection ? "REJECTED" : "APPROVED") as any,
      comments: comments || null,
    },
  });

  return updated;
}

export async function approveDepartmentWeeklyPlan(
  id: number,
  companyId: number,
  actorId: string,
  action?: string,
  comments?: string,
) {
  const plan = await prisma.weeklyPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Weekly plan not found.");

  const isRejection = action === "CHANGES_REQUESTED" || action === "REJECTED";
  const targetStatus = isRejection ? "DRAFT" : "APPROVED";

  await validateStatusTransition({
    companyId,
    entityType: "WEEKLY_PLAN",
    fromStatus: plan.plan_status as any,
    toStatus: targetStatus.toLowerCase(),
  });

  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: {
      plan_status: targetStatus as any,
      approved_at: isRejection ? undefined : new Date(),
    },
  });

  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: "WEEKLY_PLAN" as any,
      entity_id: id,
      approver_id: actorId,
      action: (isRejection ? "REJECTED" : "APPROVED") as any,
      comments: comments || null,
    },
  });

  return updated;
}

export async function approveDepartmentDailyPlan(
  id: number,
  companyId: number,
  actorId: string,
  action?: string,
  comments?: string,
) {
  const plan = await prisma.dailyPlan.findFirst({
    where: { id, company_id: companyId },
  });
  if (!plan) throw new Error("Daily plan not found.");

  const isRejection = action === "CHANGES_REQUESTED" || action === "REJECTED";
  const targetStatus = isRejection ? "DRAFT" : "APPROVED";

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: {
      status: (isRejection ? "PENDING" : "COMPLETED") as any,
    },
  });

  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: "DAILY_PLAN" as any,
      entity_id: id,
      approver_id: actorId,
      action: (isRejection ? "REJECTED" : "APPROVED") as any,
      comments: comments || null,
    },
  });

  return updated;
}

export async function approveDepartmentItem(
  entityType: string,
  entityId: number,
  companyId: number,
  actorId: string,
  action: string,
  comments?: string,
  userRole: string = "MANAGER",
) {
  switch (entityType) {
    case "EMPLOYEE_OBJECTIVE":
    case "DEPARTMENT_OBJECTIVE":
      return approveDepartmentObjective(entityId, companyId, actorId, userRole);
    case "EMPLOYEE_KR":
    case "DEPARTMENT_KR":
      return approveDepartmentKeyResult(
        entityId,
        companyId,
        actorId,
        action,
        comments,
      );
    case "EMPLOYEE_MONTH_PLAN":
      return approveDepartmentMonthPlan(
        entityId,
        companyId,
        actorId,
        action,
        comments,
      );
    case "WEEKLY_PLAN":
      return approveDepartmentWeeklyPlan(
        entityId,
        companyId,
        actorId,
        action,
        comments,
      );
    case "DAILY_PLAN":
      return approveDepartmentDailyPlan(
        entityId,
        companyId,
        actorId,
        action,
        comments,
      );
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
}

export async function bulkApproveDepartmentItems(
  items: { type: string; id: number }[],
  companyId: number,
  actorId: string,
  action: string,
  comments?: string,
  userRole: string = "MANAGER",
) {
  const results = [];
  for (const item of items) {
    try {
      const res = await approveDepartmentItem(
        item.type,
        item.id,
        companyId,
        actorId,
        action,
        comments,
        userRole,
      );
      results.push({ id: item.id, type: item.type, success: true, data: res });
    } catch (error: any) {
      results.push({
        id: item.id,
        type: item.type,
        success: false,
        error: error.message,
      });
    }
  }
  return results;
}

// ─────────────────── Planning Functions (Month, Weekly, Daily) ───────────────────

export async function createMonthPlan(data: any) {
  const {
    companyId,
    employeeKrId,
    monthNumber,
    description,
    title,
    weightPercent,
    createdBy,
  } = data;

  const kr = await prisma.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    include: { employeeObjective: true },
  });
  if (!kr) throw new Error("Key result not found.");

  const month = await prisma.employeeMonthPlan.create({
    data: {
      company_id: companyId,
      cycle_id: kr.employeeObjective.cycle_id,
      employee_kr_id: employeeKrId,
      owner_id: kr.employeeObjective.user_id,
      month_number: monthNumber,
      title: title || `Month ${monthNumber}`,
      description: description || null,
      weight_pct: weightPercent ? new Prisma.Decimal(weightPercent) : new Prisma.Decimal(0),
      plan_status: "DRAFT",
      created_by: createdBy,
    },
  });

  await tryRollupDepartmentKr(employeeKrId, "month plan creation");
  return month;
}

export async function listMonthPlans(employeeKrId: number, companyId: number) {
  return prisma.employeeMonthPlan.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { month_number: "asc" },
  });
}

export async function createWeeklyPlan(data: any) {
  const {
    companyId,
    monthPlanId,
    weekNumber,
    title,
    weightPercent,
    createdBy,
  } = data;

  const month = await prisma.employeeMonthPlan.findUnique({
    where: { id: monthPlanId },
  });
  if (!month) throw new Error("Monthly plan not found.");

  const week = await prisma.weeklyPlan.create({
    data: {
      company_id: companyId,
      employee_month_plan_id: monthPlanId,
      owner_id: month.owner_id,
      week_number: weekNumber,
      title: title || `Week ${weekNumber}`,
      weight_pct: weightPercent ? new Prisma.Decimal(weightPercent) : new Prisma.Decimal(0),
      plan_status: "DRAFT",
      created_by: createdBy,
    },
  });

  return week;
}

export async function listWeeklyPlans(monthPlanId: number, companyId: number) {
  return prisma.weeklyPlan.findMany({
    where: { employee_month_plan_id: monthPlanId, company_id: companyId },
    orderBy: { week_number: "asc" },
  });
}

export async function createDepartmentDailyPlan(
  weeklyPlanId: number,
  companyId: number,
  data: any,
) {
  const week = await prisma.weeklyPlan.findUnique({
    where: { id: weeklyPlanId },
  });
  if (!week) throw new Error("Weekly plan not found.");

  return prisma.dailyPlan.create({
    data: {
      company_id: companyId,
      weekly_plan_id: weeklyPlanId,
      owner_id: week.owner_id,
      completion_day: data.completionDay,
      title: data.title,
      description: data.description || null,
      metric_definition_id: data.metricDefinitionId || null,
      target_value: data.targetValue ? new Prisma.Decimal(data.targetValue) : null,
      current_value: data.currentValue ? new Prisma.Decimal(data.currentValue) : new Prisma.Decimal(0),
      contribute_to_score: data.contributesToParentScore ?? true,
      contribute_to_value: data.contributesToParentValue ?? true,
      status: "PENDING",
      created_by: data.createdBy || week.owner_id,
    },
  });
}

export async function updateDepartmentDailyPlan(
  id: number,
  companyId: number,
  data: any,
) {
  return prisma.dailyPlan.update({
    where: { id, company_id: companyId },
    data: {
      title: data.title,
      description: data.description,
      completion_day: data.completionDay,
      metric_definition_id: data.metricDefinitionId,
      target_value: data.targetValue ? new Prisma.Decimal(data.targetValue) : undefined,
      current_value: data.currentValue ? new Prisma.Decimal(data.currentValue) : undefined,
      status: data.status,
      contribute_to_score: data.contributesToParentScore,
      contribute_to_value: data.contributesToParentValue,
    },
  });
}

export async function deleteDepartmentDailyPlan(id: number, companyId: number) {
  return prisma.dailyPlan.delete({
    where: { id, company_id: companyId },
  });
}

export async function listDepartmentDailyPlans(
  weeklyPlanId: number,
  companyId: number,
) {
  return prisma.dailyPlan.findMany({
    where: { weekly_plan_id: weeklyPlanId, company_id: companyId },
    orderBy: { created_at: "asc" },
  });
}
