import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import {
  validateWeightsBeforePublish,
  checkWeightLimit,
} from "./okrWeightValidationService";
import { publishCompanyObjectiveSet } from "./okrPublishOrchestrator";
import { getOrCreateFallbackMetric } from "./okrMetricService";
import { resolveConfigValue } from "./okrConfigResolverService";
import { validateSafePublish } from "./okrValidationService";

// ─── Company Objectives ───────────────────────────────────────────────────────

interface CreateObjectiveInput {
  companyId: number;
  cycleId: number;
  title: string;
  description?: string;
  createdBy: string;
}

export async function createObjective(input: CreateObjectiveInput) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id: input.cycleId, company_id: input.companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status !== "OPEN") {
    throw new Error("Objectives can only be created in an OPEN cycle.");
  }

  const count = await prisma.companyObjective.count({
    where: {
      cycle_id: input.cycleId,
      company_id: input.companyId,
      is_archived: false,
    },
  });
  const maxObjectives =
    (await resolveConfigValue({
      companyId: input.companyId,
      configKey: "max_company_objectives",
      cycleId: input.cycleId,
    })) || 6;
  if (count >= Number(maxObjectives)) {
    throw new Error(
      `Maximum of ${maxObjectives} company objectives per cycle reached.`,
    );
  }

  const objective = await prisma.companyObjective.create({
    data: {
      company_id: input.companyId,
      cycle_id: input.cycleId,
      title: input.title,
      description: input.description,
      status_code: "draft",
      created_by: input.createdBy,
    },
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "COMPANY_OBJECTIVE",
    entityId: objective.id,
    actorId: input.createdBy,
    action: "objective_created",
    description: `Company objective "${objective.title}" created`,
  });

  return objective;
}

export async function updateObjective(
  id: number,
  companyId: number,
  input: Partial<CreateObjectiveInput>,
) {
  const objective = await prisma.companyObjective.findFirst({
    where: { id, company_id: companyId },
  });
  if (!objective) throw new Error("Objective not found.");
  if (objective.status_code !== "draft") {
    throw new Error("Only draft objectives can be edited.");
  }

  return prisma.companyObjective.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
    },
  });
}

export async function listObjectives(companyId: number, cycleId: number) {
  return prisma.companyObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    orderBy: { created_at: "asc" },
    include: {
      keyResults: {
        include: { metricDefinition: true },
        orderBy: { created_at: "asc" },
      },
      _count: { select: { keyResults: true } },
    },
  });
}

export async function getObjectiveDetail(id: number, companyId: number) {
  const objective = await prisma.companyObjective.findFirst({
    where: { id, company_id: companyId },
    include: {
      cycle: true,
      keyResults: {
        include: {
          metricDefinition: true,
          contributors: {
            select: {
              id: true,
              user_id: true,
              status_code: true,
              role_type: true,
              user: {
                select: {
                  employee: {
                    select: {
                      employments: {
                        where: { is_active: true },
                        select: { department_id: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!objective) throw new Error("Objective not found.");

  const activityLog = await prisma.okrActivityLog.findMany({
    where: { entity_type: "COMPANY_OBJECTIVE", entity_id: id },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return { ...objective, activityLog };
}

export async function publishCompanyPlanning(
  cycleId: number,
  companyId: number,
  actorId: string,
) {
  const objectives = await prisma.companyObjective.findMany({
    where: { cycle_id: cycleId, company_id: companyId, is_archived: false },
  });

  if (objectives.length === 0) {
    throw new Error("No objectives found in this cycle to publish.");
  }

  const minObjectives =
    (await resolveConfigValue({
      companyId,
      configKey: "min_company_objectives",
      cycleId,
    })) || 2;

  if (objectives.length < Number(minObjectives)) {
    throw new Error(
      `At least ${minObjectives} company objectives are required before publishing the cycle plan.`,
    );
  }

  // 1. Find Objectives that need publishing
  const toPublishObjectives = objectives.filter(
    (o) => o.status_code === "draft" || o.status_code === "approved",
  );

  // 2. Find Key Results that need publishing across ALL objectives in this cycle
  const allObjectiveIds = objectives.map((o) => o.id);
  const krs = await prisma.companyKeyResult.findMany({
    where: { objective_id: { in: allObjectiveIds }, company_id: companyId },
  });

  const toPublishKrs = krs.filter(
    (kr) => kr.status_code === "draft" || kr.status_code === "approved",
  );

  if (toPublishObjectives.length === 0 && toPublishKrs.length === 0) {
    return {
      success: true,
      publishedObjectives: 0,
      publishedKeyResults: 0,
      message: "All objectives and key results are already published.",
    };
  }

  // 3. Validate EVERY objective and its KRs before publishing any
  for (const obj of objectives) {
    // Only validate objectives that are currently in draft or approved (about to be published)
    // or objectives that are already published but might have draft KRs being published.
    await validateSafePublish(companyId, obj.id, "COMPANY", cycleId);
    await validateWeightsBeforePublish(companyId, cycleId, obj.id, "COMPANY");
  }

  // Publish Objectives

  if (toPublishObjectives.length > 0) {
    const objectiveIds = toPublishObjectives.map((o) => o.id);
    await prisma.companyObjective.updateMany({
      where: { id: { in: objectiveIds }, company_id: companyId },
      data: {
        status_code: "published",
        published_by: actorId,
        published_at: new Date(),
      },
    });

    for (const obj of toPublishObjectives) {
      await logActivity({
        companyId,
        entityType: "COMPANY_OBJECTIVE",
        entityId: obj.id,
        actorId,
        action: "publish_action",
        description: `Company objective "${obj.title}" published`,
      });
    }
  }

  // Publish Key Results
  if (toPublishKrs.length > 0) {
    const krIds = toPublishKrs.map((kr) => kr.id);
    await prisma.companyKeyResult.updateMany({
      where: {
        id: { in: krIds },
        company_id: companyId,
      },
      data: {
        status_code: "published",
        published_by: actorId,
        published_at: new Date(),
      },
    });

    for (const kr of toPublishKrs) {
      await logActivity({
        companyId,
        entityType: "COMPANY_KR",
        entityId: kr.id,
        actorId,
        action: "publish_action",
        description: `Company key result "${kr.title}" published`,
      });
    }
  }

  return {
    publishedObjectives: toPublishObjectives.length,
    publishedKeyResults: toPublishKrs.length,
  };
}

export async function publishObjective(
  id: number,
  companyId: number,
  actorId: string,
) {
  const objective = await prisma.companyObjective.findFirst({
    where: { id, company_id: companyId },
  });
  if (!objective) throw new Error("Objective not found.");
  if (objective.status_code === "published") {
    return objective;
  }

  // Validate before publishing
  await validateSafePublish(companyId, id, "COMPANY", objective.cycle_id);
  await validateWeightsBeforePublish(
    companyId,
    objective.cycle_id,
    id,
    "COMPANY",
  );

  const updated = await prisma.companyObjective.update({
    where: { id },
    data: {
      status_code: "published",
      published_by: actorId,
      published_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    entityId: updated.id,
    actorId,
    action: "publish_action",
    description: `Company objective "${updated.title}" published individually`,
  });

  return updated;
}

// ─── Company Key Results ──────────────────────────────────────────────────────

interface CreateKRInput {
  companyId: number;
  objectiveId: number;
  title: string;
  description?: string;
  metricDefinitionId: number;
  unitOfMeasure?: string;
  targetValue?: number;
  currentValue?: number;
  weightPercent?: number;
  contributesToScore?: boolean;
  contributesToValue?: boolean;
  isDirect?: boolean;
  isMandatory?: boolean;
  assignUserIds?: string[];
  assignDepartmentIds?: number[];
  createdBy: string;
}

export async function resolveDepartmentHeads(
  companyId: number,
  departmentIds?: number[],
): Promise<string[]> {
  if (
    !departmentIds ||
    !Array.isArray(departmentIds) ||
    departmentIds.length === 0
  )
    return [];
  const normalizedIds = departmentIds
    .map((id) => Number(id))
    .filter((id) => !isNaN(id));
  if (normalizedIds.length === 0) return [];

  const departments = await prisma.department.findMany({
    where: {
      id: { in: normalizedIds },
      company_id: companyId,
    },
    include: { head: true },
  });

  const missingHeads = departments.filter(
    (d) => !d.head_user_id || !d.head?.employee_id,
  );
  if (missingHeads.length > 0) {
    const names = missingHeads.map((d) => d.name).join(", ");
    throw new Error(
      `Cannot assign KR: The following departments do not have a designated Department Head: ${names}. Please assign a department head first.`,
    );
  }

  return departments
    .map((d) => d.head?.employee_id)
    .filter((id): id is string => Boolean(id) && id?.trim() !== "");
}

export async function createKeyResult(input: CreateKRInput) {
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
  const objective = await prisma.companyObjective.findFirst({
    where: { id: input.objectiveId, company_id: input.companyId },
    include: { cycle: true },
  });

  if (!objective) throw new Error("Objective not found.");
  if (objective.cycle.status !== "OPEN") {
    throw new Error("Key results can only be created in an OPEN cycle.");
  }

  const krCount = await prisma.companyKeyResult.count({
    where: { objective_id: input.objectiveId },
  });
  const maxKrs =
    (await resolveConfigValue({
      companyId: input.companyId,
      configKey: "max_krs_per_objective",
      cycleId: objective.cycle_id,
    })) || 6;
  if (krCount >= Number(maxKrs)) {
    throw new Error(`Maximum of ${maxKrs} key results per objective reached.`);
  }

  // Weight limit check
  if (input.weightPercent && (input.isDirect ?? input.contributesToScore ?? true)) {
    await checkWeightLimit(input.objectiveId, "COMPANY", input.weightPercent, input.isDirect ?? input.contributesToScore ?? true);
  }

  // Prepare normalized user IDs if provided
  let userIds = Array.from(
    new Set(
      (Array.isArray(input.assignUserIds) ? input.assignUserIds : []).filter(
        (id) => typeof id === "string" && id.trim() !== "",
      ),
    ),
  );

  const deptHeadIds = await resolveDepartmentHeads(
    input.companyId,
    input.assignDepartmentIds,
  );
  console.log("DEPARTMENT HEAD ASSIGNED", deptHeadIds);
  userIds = Array.from(new Set([...userIds, ...deptHeadIds]));

  const result = await prisma.$transaction(async (tx) => {
    const kr = await tx.companyKeyResult.create({
      data: {
        company_id: input.companyId,
        objective_id: input.objectiveId,
        title: input.title,
        description: input.description,
        metric_definition_id: metricId,
        unit_of_measure: input.unitOfMeasure,
        target_value: input.targetValue,
        current_value: Number("0"),
        weight_percent: input.weightPercent,
        is_direct: input.isDirect ?? input.contributesToValue ?? input.contributesToScore ?? true,
        is_mandatory_for_completion: input.isMandatory ?? false,
        status_code: "draft",
        created_by: input.createdBy,
      },
      include: { metricDefinition: true },
    });

    const assignmentResults = [];
    for (const userId of userIds) {
      // Basic validation: ensures user exists
      const userExists = await tx.appUser.findFirst({
        where: { employee_id: userId, company_id: input.companyId },
      });
      if (!userExists) continue;

      const contributor = await tx.krContributor.create({
        data: {
          company_id: input.companyId,
          company_kr_id: kr.id,
          user_id: userId,
          role_type: "DEPARTMENT_HEAD",
          status_code: "assigned",
          assigned_by: input.createdBy,
        },
      });
      assignmentResults.push(contributor);
    }

    return { kr, assignments: assignmentResults };
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "COMPANY_KR",
    entityId: result.kr.id,
    actorId: input.createdBy,
    action: "kr_created",
    description: `Company KR "${result.kr.title}" created under objective #${input.objectiveId}${userIds.length > 0 ? ` and assigned to ${userIds.length} users` : ""}`,
  });

  return result;
}

export async function updateKeyResult(
  id: number,
  companyId: number,
  input: Partial<CreateKRInput> & {
    assignUserIds?: string[];
    assignDepartmentIds?: number[];
  },
) {
  const kr = await prisma.companyKeyResult.findFirst({
    where: { id, company_id: companyId },
    include: { objective: { select: { cycle_id: true } } },
  });
  if (!kr) throw new Error("Key result not found.");
  if (kr.status_code !== "draft") {
    throw new Error("Only draft key results can be edited.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Re-fetch inside transaction for atomicity and to get the objective cycle_id
    const currentKr = await tx.companyKeyResult.findUnique({
      where: { id },
      include: {
        objective: {
          select: { cycle_id: true },
        },
      },
    });

    if (!currentKr || currentKr.company_id !== companyId) {
      throw new Error("Key result not found.");
    }

    // Weight limit check
    if (
      input.weightPercent &&
      (input.isDirect ?? input.contributesToScore ?? currentKr.is_direct)
    ) {
      // Note: weight checking logic needs to use tx if it makes queries
      await checkWeightLimit(
        currentKr.objective_id,
        "COMPANY",
        input.weightPercent,
        input.isDirect ?? input.contributesToScore ?? currentKr.is_direct,
        id,
      );
    }

    const updated = await tx.companyKeyResult.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        metric_definition_id: input.metricDefinitionId,
        unit_of_measure: input.unitOfMeasure,
        target_value: input.targetValue,
        weight_percent: input.weightPercent,
        is_direct: input.isDirect ?? input.contributesToValue ?? input.contributesToScore,
        is_mandatory_for_completion: input.isMandatory,
      },
    });

    if (input.assignUserIds || input.assignDepartmentIds) {
      const explicitUserIds = Array.isArray(input.assignUserIds)
        ? input.assignUserIds
        : [];
      const deptHeadIds = await resolveDepartmentHeads(
        companyId,
        input.assignDepartmentIds,
      );
      const userIds = Array.from(
        new Set(
          [...explicitUserIds, ...deptHeadIds].filter(
            (id) => typeof id === "string" && id.trim() !== "",
          ),
        ),
      );

      // Remove old assignments
      await tx.krContributor.deleteMany({
        where: {
          company_kr_id: id,
          user_id: { notIn: userIds },
          role_type: "DEPARTMENT_HEAD",
        },
      });

      // Add new assignments
      for (const userId of userIds) {
        const existing = await tx.krContributor.findFirst({
          where: {
            company_kr_id: id,
            user_id: userId,
            role_type: "DEPARTMENT_HEAD",
          },
        });

        if (!existing) {
          await tx.krContributor.create({
            data: {
              company_id: companyId,
              company_kr_id: id,
              user_id: userId,
              role_type: "DEPARTMENT_HEAD",
              status_code: "assigned",
              assigned_by: currentKr.created_by,
            },
          });
        }
      }
    }

    return updated;
  });

  await logActivity({
    companyId,
    entityType: "COMPANY_KR",
    entityId: id,
    actorId: kr.created_by,
    action: "kr_updated",
    description: `Company KR "${result.title}" updated.${input.assignUserIds || input.assignDepartmentIds ? ` User assignments synced.` : ""}`,
  });

  return result;
}

export async function listKeyResults(objectiveId: number, companyId: number) {
  return prisma.companyKeyResult.findMany({
    where: { objective_id: objectiveId, company_id: companyId },
    orderBy: { created_at: "asc" },
    include: {
      metricDefinition: true,
      _count: { select: { employeeObjectives: true } },
    },
  });
}

export async function getKeyResultDetail(id: number, companyId: number) {
  const kr = await prisma.companyKeyResult.findFirst({
    where: { id, company_id: companyId },
    include: {
      metricDefinition: true,
      objective: {
        select: { id: true, title: true, cycle_id: true, status_code: true },
      },
      contributors: {
        select: {
          id: true,
          user_id: true,
          status_code: true,
          role_type: true,
          user: {
            select: {
              employee: {
                select: {
                  employments: {
                    where: { is_active: true },
                    select: { department_id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!kr) throw new Error("Key result not found.");
  return kr;
}

export async function publishKeyResult(
  id: number,
  companyId: number,
  actorId: string,
) {
  const kr = await prisma.companyKeyResult.findFirst({
    where: { id, company_id: companyId },
  });
  if (!kr) throw new Error("Key result not found.");
  if (kr.status_code === "published") {
    return kr;
  }

  const objectiveId = kr.objective_id;
  const objective = await prisma.companyObjective.findUnique({
    where: { id: objectiveId },
    select: { cycle_id: true, status_code: true },
  });

  if (objective) {
    // If the objective is already published, or if we want to ensure consistency,
    // we should validate the whole objective's KR set when publishing one of its KRs.
    await validateSafePublish(
      companyId,
      objectiveId,
      "COMPANY",
      objective.cycle_id,
    );
    await validateWeightsBeforePublish(
      companyId,
      objective.cycle_id,
      objectiveId,
      "COMPANY",
    );
  }

  const updated = await prisma.companyKeyResult.update({
    where: { id },
    data: {
      status_code: "published",
      published_by: actorId,
      published_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "COMPANY_KR",
    entityId: kr.id,
    actorId,
    action: "publish_action",
    description: `Company key result "${kr.title}" published individually`,
  });

  return updated;
}

export async function assignUsers(
  krId: number,
  companyId: number,
  userIds: string[],
  actorId: string,
  departmentIds?: number[],
) {
  const explicitUserIds = Array.from(
    new Set(
      (userIds || []).filter(
        (id) => typeof id === "string" && id.trim() !== "",
      ),
    ),
  );

  const deptHeadIds = await resolveDepartmentHeads(companyId, departmentIds);
  const normalizedUserIds = Array.from(
    new Set([...explicitUserIds, ...deptHeadIds]),
  );

  if (normalizedUserIds.length === 0) {
    throw new Error(
      "user_ids or department_ids must contain valid identifiers.",
    );
  }

  const kr = await prisma.companyKeyResult.findFirst({
    where: { id: krId, company_id: companyId },
    include: {
      objective: {
        select: {
          id: true,
          title: true,
          cycle_id: true,
          status_code: true,
          cycle: true,
        },
      },
    },
  });
  if (!kr) throw new Error("Key result not found.");

  const companyUsers = await prisma.appUser.findMany({
    where: {
      company_id: companyId,
      employee_id: { in: normalizedUserIds },
    },
    select: { employee_id: true },
  });

  const validUserIds = new Set(companyUsers.map((u) => u.employee_id));
  const invalidUserIds = normalizedUserIds.filter(
    (id) => !validUserIds.has(id),
  );
  if (invalidUserIds.length > 0) {
    throw new Error(
      `Invalid user_ids for this company: ${invalidUserIds.join(", ")}.`,
    );
  }

  const results = [];

  for (const userId of normalizedUserIds) {
    const existing = await prisma.krContributor.findFirst({
      where: {
        company_id: companyId,
        company_kr_id: krId,
        user_id: userId,
        role_type: "DEPARTMENT_HEAD",
      },
    });
    if (existing) {
      results.push({
        userId: userId,
        status: "already_assigned",
        assignmentId: existing.id,
      });
      continue;
    }

    const contributor = await prisma.krContributor.create({
      data: {
        company_id: companyId,
        company_kr_id: krId,
        user_id: userId,
        role_type: "DEPARTMENT_HEAD",
        status_code: "assigned",
        assigned_by: actorId,
      },
    });

    await logActivity({
      companyId,
      entityType: "COMPANY_KR",
      entityId: krId,
      actorId,
      action: "user_assigned",
      description: `User ${userId} assigned to company KR "${kr.title}"`,
      metadata: { user_id: userId },
    });

    results.push({
      userId: userId,
      status: "created",
      assignmentId: contributor.id,
    });
  }

  return results;
}

export async function listAvailableCompanyKRs(
  companyId: number,
  cycleId: number,
  userId: string,
) {
  return prisma.companyKeyResult.findMany({
    where: {
      company_id: companyId,
      objective: { cycle_id: cycleId },
      status_code: { in: ["draft", "published"] },
      contributors: {
        some: {
          user_id: userId,
          role_type: "DEPARTMENT_HEAD",
          status_code: "assigned",
        },
      },
    },
    orderBy: { created_at: "asc" },
    include: {
      metricDefinition: true,
      objective: { select: { id: true, title: true } },
    },
  });
}

// ─── Metric Definitions ───────────────────────────────────────────────────────

export async function listMetrics() {
  return prisma.okrMetricDefinition.findMany({
    orderBy: { id: "asc" },
  });
}
