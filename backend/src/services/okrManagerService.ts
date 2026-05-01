import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrApprovalAction, OkrEntityType } from "@prisma/client";
import { validateStatusTransition } from "src/services/okrStatusTransitionService";
import { getAllSubordinateIds } from "./managerService";

function pickLatestConfidenceSignal(
  signals: Array<{ confidence_level: string | null; observed_at: Date }>,
) {
  const valid = signals.filter((s) => Boolean(s.confidence_level));
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.observed_at.getTime() - a.observed_at.getTime());
  return valid[0].confidence_level;
}

// ─── Helper: Find managed employees via Employment table ──────────────────────

async function getManagedEmployeeIds(
  managerId: string,
  companyId: number,
  recursive: boolean = true,
) {
  // Total ID Resolution for Manager
  const manager = await prisma.appUser.findFirst({
    where: { id: Number(managerId), company_id: companyId },
    select: { id: true, employee_id: true },
  });
  if (!manager) return [];

  const managerIds = [managerId];
  if (manager?.employee_id) {
    managerIds.push(manager.employee_id);
  }

  let allTargetManagerIds = [...managerIds];

  if (recursive) {
    // Fetch recursive subordinates
    const subordinateIds = await getAllSubordinateIds(
      manager?.employee_id || managerId,
      companyId,
    );
    allTargetManagerIds = Array.from(
      new Set([...allTargetManagerIds, ...subordinateIds]),
    );
  }

  const employments = await prisma.employment.findMany({
    where: {
      company_id: companyId,
      manager_id: { in: allTargetManagerIds },
      is_active: true,
      employee_id: { notIn: managerIds }, // Don't manage self
    },
    include: {
      employee: {
        select: { id: true, full_name: true },
      },
    },
  });

  // Deduplicate by employee_id (Account ID or Employee ID string)
  const map = new Map<string, { id: string; full_name: string }>();
  for (const emp of employments) {
    if (!map.has(emp.employee_id)) {
      map.set(emp.employee_id, emp.employee);
    }
  }
  return Array.from(map.values());
}

// ─── Subordinate Job Titles ───────────────────────────────────────────────────

export async function listSubordinatePositions(
  managerId: string,
  companyId: number,
  role?: string,
) {
  const where: any = {
    company_id: companyId,
    is_active: true,
  };

  const manager = await prisma.appUser.findFirst({
    where: { id: Number(managerId), company_id: companyId },
    select: { id: true, employee_id: true },
  });

  const managerIds = [managerId];
  if (manager?.employee_id) {
    managerIds.push(manager.employee_id);
  }

  // If not admin, filter by manager_id
  if (role !== "Admin") {
    where.manager_id = { in: managerIds };
  }

  const employments = await prisma.employment.findMany({
    where,
    include: {
      employee: { select: { id: true, full_name: true } },
      jobTitle: { select: { id: true, title: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { employee: { full_name: "asc" } },
  });

  return employments.map((emp) => ({
    employee_id: emp.employee_id,
    employee_user_id: emp.employee.id,
    employee_name: emp.employee.full_name,
    job_title_id: emp.jobTitle?.id ?? null,
    jobtitle_id: emp.jobTitle?.id ?? null,
    job_title: emp.jobTitle?.title ?? "No Title",
    department_id: emp.department?.id ?? null,
    department_name: emp.department?.name ?? "No Department",
  }));
}

// ─── Team Execution Summary ───────────────────────────────────────────────────

export async function getTeamExecutionSummary(
  managerId: string,
  companyId: number,
  cycleId: number,
) {
  const managedEmployees = await getManagedEmployeeIds(managerId, companyId);
  const managedIds = managedEmployees.map((e) => e.id);

  if (managedIds.length === 0) {
    return { cycle_id: cycleId, team_size: 0, team: [] };
  }

  // Get all employee objectives for these managed employees
  const objectives = await prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      user_id: { in: managedIds },
    },
    include: {
      keyResults: {
        include: {
          _count: {
            select: {
              monthPlanItems: true,
              weeklyPlans: true,
              subtasks: true,
              progressUpdates: true,
            },
          },
          weeklyPlans: {
            select: {
              confidence_level: true,
              updated_at: true,
              tasks: {
                select: {
                  dailyPlans: {
                    select: { confidence_level: true, updated_at: true },
                  },
                },
              },
            },
          },
          subtasks: {
            select: { confidence_level: true, updated_at: true },
          },
          progressUpdates: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: { confidence_level: true, created_at: true },
          },
        },
      },
    },
  });

  // Aggregate per employee
  const teamSummary = managedEmployees.map((employee) => {
    const empObjectives = objectives.filter((o) => o.user_id === employee.id);
    const allKRs = empObjectives.flatMap((o) => o.keyResults);

    const totalKRs = allKRs.length;
    const draftKRs = allKRs.filter((kr) => kr.status_code === "draft").length;
    const activeKRs = allKRs.filter((kr) =>
      ["approved", "published", "in_progress"].includes(kr.status_code),
    ).length;
    const totalProgressUpdates = allKRs.reduce(
      (sum, kr) => sum + kr._count.progressUpdates,
      0,
    );

    // Latest confidence per KR from all measurable entities
    const latestUpdates = allKRs
      .map((kr) => {
        const signals: Array<{
          confidence_level: string | null;
          observed_at: Date;
        }> = [];

        for (const p of kr.progressUpdates) {
          signals.push({
            confidence_level: p.confidence_level,
            observed_at: p.created_at,
          });
        }
        for (const w of kr.weeklyPlans) {
          signals.push({
            confidence_level: w.confidence_level,
            observed_at: w.updated_at,
          });
          for (const task of w.tasks) {
            for (const ms of task.dailyPlans) {
              signals.push({
                confidence_level: ms.confidence_level,
                observed_at: ms.updated_at,
              });
            }
          }
        }
        for (const s of kr.subtasks) {
          signals.push({
            confidence_level: s.confidence_level,
            observed_at: s.updated_at,
          });
        }

        return pickLatestConfidenceSignal(signals);
      })
      .filter(Boolean);

    const confidenceCounts = {
      on_track: latestUpdates.filter((u) => u === "ON_TRACK").length,
      at_risk: latestUpdates.filter((u) => u === "AT_RISK").length,
      off_track: latestUpdates.filter((u) => u === "OFF_TRACK").length,
    };

    return {
      id: employee.id,
      employee_id: employee.id,
      employee_name: employee.full_name,
      objective_title: empObjectives[0]?.title ?? "—",
      objectives_count: empObjectives.length,
      objectives_status: {
        draft: empObjectives.filter((o) => o.status_code === "draft").length,
        submitted: empObjectives.filter((o) => o.status_code === "submitted")
          .length,
        approved: empObjectives.filter((o) => o.status_code === "approved")
          .length,
        published: empObjectives.filter((o) => o.status_code === "published")
          .length,
      },
      total_krs: totalKRs,
      draft_krs: draftKRs,
      active_krs: activeKRs,
      progress:
        empObjectives.length > 0
          ? empObjectives.reduce((s, o) => s + Number(o.final_score ?? 0), 0) /
          empObjectives.length
          : 0,
      progress_updates_count: totalProgressUpdates,
      confidence: confidenceCounts,
      is_blocked:
        confidenceCounts.at_risk > 0 || confidenceCounts.off_track > 0,
    };
  });

  return {
    cycle_id: cycleId,
    team_size: managedEmployees.length,
    team: teamSummary,
  };
}

// ─── Pending Approvals ────────────────────────────────────────────────────────

export async function listPendingApprovals(
  managerId: string,
  companyId: number,
  cycleId: number,
  role?: string,
) {
  const managedEmployees = await getManagedEmployeeIds(
    managerId,
    companyId,
    false,
  );
  const managedIds = managedEmployees.map((e) => e.id);

  // Get pending employee objectives (status = "submitted")
  const pendingObjectives =
    managedIds.length > 0
      ? await prisma.employeeObjective.findMany({
        where: {
          company_id: companyId,
          cycle_id: cycleId,
          user_id: { in: managedIds },
          status_code: { in: ["submitted", "pending_approval"] },
        },
        include: {
          keyResults: {
            select: { id: true, title: true, status_code: true },
          },
        },
      })
      : [];

  // Get pending employee KRs (submitted for approval)
  const pendingKRs =
    managedIds.length > 0
      ? await prisma.employeeKeyResult.findMany({
        where: {
          company_id: companyId,
          status_code: { in: ["submitted", "pending_approval"] },
          employeeObjective: {
            cycle_id: cycleId,
            user_id: { in: managedIds },
          },
        },
        include: {
          employeeObjective: {
            select: { id: true, user_id: true, title: true },
          },
        },
      })
      : [];

  const pendingObjectiveIds = pendingObjectives.map((o) => o.id);
  const pendingKrIds = pendingKRs.map((k) => k.id);

  // Get pending month plans for managed employees
  const pendingMonthPlans =
    managedIds.length > 0
      ? await prisma.employeeMonthPlan.findMany({
        where: {
          company_id: companyId,
          status_code: { in: ["submitted", "pending_approval"] },
          employeeObjective: {
            user_id: { in: managedIds },
            cycle_id: cycleId,
          },
        },
        include: {
          employeeObjective: {
            select: { id: true, user_id: true, title: true },
          },
        },
      })
      : [];

  // Get pending weekly plans for managed employees
  const pendingWeeklyPlans =
    managedIds.length > 0
      ? await prisma.weeklyPlan.findMany({
        where: {
          company_id: companyId,
          status_code: { in: ["submitted", "pending_approval"] },
          employeeKr: {
            employeeObjective: {
              user_id: { in: managedIds },
              cycle_id: cycleId,
            },
          },
        },
        include: {
          employeeKr: {
            select: { id: true, title: true, employeeObjective: { select: { user_id: true } } },
          },
        },
      })
      : [];

  // Get pending daily plans for managed employees
  const pendingDailyPlans =
    managedIds.length > 0
      ? await prisma.dailyPlan.findMany({
        where: {
          company_id: companyId,
          status_code: { in: ["submitted", "pending_approval"] },
          weeklyTask: {
            weeklyPlan: {
              employeeKr: {
                employeeObjective: {
                  user_id: { in: managedIds },
                  cycle_id: cycleId,
                },
              },
            },
          },
        },
        include: {
          weeklyTask: {
            include: {
              weeklyPlan: {
                select: {
                  id: true,
                  employeeKr: {
                    select: { id: true, title: true, employeeObjective: { select: { user_id: true } } },
                  },
                },
              },
            },
          },
        },
      })
      : [];

  // Create employee name map for easy lookup
  const nameMap = new Map(managedEmployees.map((e) => [e.id, e.full_name]));

  // CEO/Admin review queue for Department Objectives (Legacy)
  // Replaced by Employee Objectives for Department Heads in the new model.
  const pendingDepartmentObjectives: any[] = [];

  return {
    pending_objectives: pendingObjectives.map((o) => ({
      ...o,
      employee_name: nameMap.get(o.user_id) || o.user_id,
    })),
    pending_krs: pendingKRs.map((kr) => ({
      ...kr,
      employee_name:
        nameMap.get(kr.employeeObjective.user_id) ||
        kr.employeeObjective.user_id,
    })),
    pending_month_plans: pendingMonthPlans.map((plan) => ({
      ...plan,
      employee_name:
        nameMap.get(plan.employeeObjective?.user_id || "") ||
        plan.employeeObjective?.user_id ||
        "—",
    })),
    pending_weekly_plans: pendingWeeklyPlans.map((plan) => ({
      ...plan,
      employee_name:
        nameMap.get(plan.employeeKr?.employeeObjective?.user_id || "") ||
        plan.employeeKr?.employeeObjective?.user_id ||
        "—",
    })),
    pending_daily_plans: pendingDailyPlans.map((plan) => ({
      ...plan,
      employee_name:
        nameMap.get(plan.weeklyTask?.weeklyPlan?.employeeKr?.employeeObjective?.user_id || "") ||
        plan.weeklyTask?.weeklyPlan?.employeeKr?.employeeObjective?.user_id ||
        "—",
    })),
    pending_department_objectives: pendingDepartmentObjectives,
    total_pending:
      pendingObjectives.length +
      pendingKRs.length +
      pendingMonthPlans.length +
      pendingWeeklyPlans.length +
      pendingDailyPlans.length +
      pendingDepartmentObjectives.length,
  };
}

async function getDepartmentEmployeeIds(
  companyId: number,
  departmentId: number,
) {
  const rows = await prisma.employment.findMany({
    where: {
      company_id: companyId,
      department_id: departmentId,
      is_active: true,
    },
    select: {
      employee_id: true,
      employee: { select: { id: true, full_name: true } },
    },
  });

  const ids = Array.from(new Set(rows.map((r) => r.employee_id)));
  const nameMap = new Map<string, string>();
  for (const r of rows) {
    nameMap.set(r.employee_id, r.employee.full_name);
  }
  return { ids, nameMap };
}

export async function listPendingEmployeeObjectivesByDepartment(
  companyId: number,
  cycleId: number,
  departmentId: number,
) {
  const { ids, nameMap } = await getDepartmentEmployeeIds(
    companyId,
    departmentId,
  );
  if (ids.length === 0) return [];

  const objectives = await prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      user_id: { in: ids },
      status_code: { in: ["submitted", "pending_approval"] },
    },
    orderBy: { updated_at: "desc" },
    include: {
      contributor: {
        select: { id: true, department_kr_id: true, role_type: true },
      },
      keyResults: {
        select: { id: true, title: true, status_code: true },
      },
    },
  });

  return objectives.map((o) => ({
    ...o,
    employee_name: nameMap.get(o.user_id) || o.user_id,
  }));
}

export async function listPendingEmployeeKeyResultsByDepartment(
  companyId: number,
  cycleId: number,
  departmentId: number,
) {
  const { ids, nameMap } = await getDepartmentEmployeeIds(
    companyId,
    departmentId,
  );
  if (ids.length === 0) return [];

  const keyResults = await prisma.employeeKeyResult.findMany({
    where: {
      company_id: companyId,
      status_code: { in: ["submitted", "pending_approval"] },
      employeeObjective: {
        cycle_id: cycleId,
        user_id: { in: ids },
      },
    },
    orderBy: { updated_at: "desc" },
    include: {
      employeeObjective: {
        select: { id: true, user_id: true, title: true },
      },
      metricDefinition: {
        select: { id: true, code: true, name: true, category: true },
      },
    },
  });

  return keyResults.map((kr) => ({
    ...kr,
    employee_name:
      nameMap.get(kr.employeeObjective.user_id) || kr.employeeObjective.user_id,
  }));
}

export async function bulkApprovalAction(input: {
  companyId: number;
  approverId: string;
  action: OkrApprovalAction;
  objectiveIds?: number[];
  krIds?: number[];
  monthPlanIds?: number[];
  weeklyPlanIds?: number[];
  dailyPlanIds?: number[];
  userId?: string;
}) {
  const objectiveIds = input.objectiveIds || [];
  const krIds = input.krIds || [];
  const monthPlanIds = input.monthPlanIds || [];
  const weeklyPlanIds = input.weeklyPlanIds || [];
  const dailyPlanIds = input.dailyPlanIds || [];

  let processedObjectives = 0;
  let processedKRs = 0;
  let processedMonthPlans = 0;
  let processedWeeklyPlans = 0;
  let processedDailyPlans = 0;
  const failed: Array<{
    entity_type: string;
    entity_id: number;
    reason: string;
  }> = [];

  for (const objectiveId of objectiveIds) {
    try {
      if (input.userId) {
        const obj = await prisma.employeeObjective.findFirst({
          where: {
            id: objectiveId,
            company_id: input.companyId,
            user_id: input.userId,
          },
          select: { id: true },
        });
        if (!obj) {
          failed.push({
            entity_type: "EMPLOYEE_OBJECTIVE",
            entity_id: objectiveId,
            reason: "Objective not found for provided user_id",
          });
          continue;
        }
      }

      await processApprovalAction({
        companyId: input.companyId,
        entityType: "EMPLOYEE_OBJECTIVE",
        entityId: objectiveId,
        action: input.action,
        approverId: input.approverId,
      });
      processedObjectives++;
    } catch (err: any) {
      failed.push({
        entity_type: "EMPLOYEE_OBJECTIVE",
        entity_id: objectiveId,
        reason: err?.message || "Unknown error",
      });
    }
  }

  for (const krId of krIds) {
    try {
      if (input.userId) {
        const kr = await prisma.employeeKeyResult.findFirst({
          where: {
            id: krId,
            company_id: input.companyId,
            employeeObjective: { user_id: input.userId },
          },
          select: { id: true },
        });
        if (!kr) {
          failed.push({
            entity_type: "EMPLOYEE_KR",
            entity_id: krId,
            reason: "Key result not found for provided user_id",
          });
          continue;
        }
      }

      await processApprovalAction({
        companyId: input.companyId,
        entityType: "EMPLOYEE_KR",
        entityId: krId,
        action: input.action,
        approverId: input.approverId,
      });
      processedKRs++;
    } catch (err: any) {
      failed.push({
        entity_type: "EMPLOYEE_KR",
        entity_id: krId,
        reason: err?.message || "Unknown error",
      });
    }
  }

  for (const planId of monthPlanIds) {
    try {
      await processApprovalAction({
        companyId: input.companyId,
        entityType: "EMPLOYEE_MONTH_PLAN",
        entityId: planId,
        action: input.action,
        approverId: input.approverId,
      });
      processedMonthPlans++;
    } catch (err: any) {
      failed.push({
        entity_type: "EMPLOYEE_MONTH_PLAN",
        entity_id: planId,
        reason: err?.message || "Unknown error",
      });
    }
  }

  for (const planId of weeklyPlanIds) {
    try {
      await processApprovalAction({
        companyId: input.companyId,
        entityType: "WEEKLY_PLAN",
        entityId: planId,
        action: input.action,
        approverId: input.approverId,
      });
      processedWeeklyPlans++;
    } catch (err: any) {
      failed.push({
        entity_type: "WEEKLY_PLAN",
        entity_id: planId,
        reason: err?.message || "Unknown error",
      });
    }
  }

  for (const planId of dailyPlanIds) {
    try {
      await processApprovalAction({
        companyId: input.companyId,
        entityType: "DAILY_PLAN",
        entityId: planId,
        action: input.action,
        approverId: input.approverId,
      });
      processedDailyPlans++;
    } catch (err: any) {
      failed.push({
        entity_type: "DAILY_PLAN",
        entity_id: planId,
        reason: err?.message || "Unknown error",
      });
    }
  }

  return {
    processed_objectives: processedObjectives,
    processed_key_results: processedKRs,
    processed_month_plans: processedMonthPlans,
    processed_weekly_plans: processedWeeklyPlans,
    processed_daily_plans: processedDailyPlans,
    failed_count: failed.length,
    failed,
  };
}

// ─── Process Approval Action ──────────────────────────────────────────────────

interface ApprovalActionInput {
  companyId: number;
  entityType: OkrEntityType;
  entityId: number;
  action: OkrApprovalAction;
  comments?: string;
  approverId: string;
}

interface BulkApprovalInput {
  companyId: number;
  cycleId: number;
  employeeId: string;
  action: OkrApprovalAction;
  approverId: string;
  includeObjectives?: boolean;
  includeKrs?: boolean;
  comments?: string;
}

export async function processBulkApprovalForEmployee(input: BulkApprovalInput) {
  const includeObjectives = input.includeObjectives !== false;
  const includeKrs = input.includeKrs !== false;

  if (!includeObjectives && !includeKrs) {
    return { processedObjectives: 0, processedKeyResults: 0 };
  }

  let processedObjectives = 0;
  let processedKeyResults = 0;

  if (includeObjectives) {
    const objectives = await prisma.employeeObjective.findMany({
      where: {
        company_id: input.companyId,
        cycle_id: input.cycleId,
        user_id: input.employeeId,
        status_code: { in: ["submitted", "pending_approval", "approved"] },
      },
      select: { id: true },
    });

    for (const o of objectives) {
      await processApprovalAction({
        companyId: input.companyId,
        entityType: "EMPLOYEE_OBJECTIVE",
        entityId: o.id,
        action: input.action,
        comments: input.comments,
        approverId: input.approverId,
      });
      processedObjectives++;
    }
  }

  if (includeKrs) {
    const krs = await prisma.employeeKeyResult.findMany({
      where: {
        company_id: input.companyId,
        status_code: { in: ["submitted", "pending_approval", "approved"] },
        employeeObjective: {
          cycle_id: input.cycleId,
          user_id: input.employeeId,
        },
      },
      select: { id: true },
    });

    for (const kr of krs) {
      await processApprovalAction({
        companyId: input.companyId,
        entityType: "EMPLOYEE_KR",
        entityId: kr.id,
        action: input.action,
        comments: input.comments,
        approverId: input.approverId,
      });
      processedKeyResults++;
    }
  }

  return { processedObjectives, processedKeyResults };
}

export async function processApprovalAction(input: ApprovalActionInput) {
  let newStatus: string;

  switch (input.action) {
    case "APPROVED":
      newStatus = "approved";
      break;
    case "REJECTED":
      newStatus = "draft";
      break;
    case "CHANGES_REQUESTED":
      newStatus = "draft";
      break;
    case "PUBLISHED":
      newStatus = "published";
      break;
    default:
      throw new Error(`Invalid approval action: ${input.action}`);
  }

  // Update the entity status
  if (input.entityType === "EMPLOYEE_OBJECTIVE") {
    const obj = await prisma.employeeObjective.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!obj) throw new Error("Employee objective not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "EMPLOYEE_OBJECTIVE",
      fromStatus: obj.status_code,
      toStatus: newStatus,
    });

    await prisma.employeeObjective.update({
      where: { id: input.entityId },
      data: {
        status_code: newStatus,
        approved_by:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? input.approverId
            : undefined,
        published_by:
          input.action === "PUBLISHED" ? input.approverId : undefined,
        published_at: input.action === "PUBLISHED" ? new Date() : undefined,
      },
    });

    // Cascade approval down to all child KRs
    await prisma.employeeKeyResult.updateMany({
      where: { 
        employee_objective_id: input.entityId,
        status_code: { in: ["draft", "submitted", "pending_approval"] } 
      },
      data: {
        status_code: newStatus,
        approved_by:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? input.approverId
            : undefined,
        published_by:
          input.action === "PUBLISHED" ? input.approverId : undefined,
        published_at: input.action === "PUBLISHED" ? new Date() : undefined,
      },
    });
  } else if (input.entityType === "EMPLOYEE_KR") {
    const kr = await prisma.employeeKeyResult.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!kr) throw new Error("Employee key result not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "EMPLOYEE_KR",
      fromStatus: kr.status_code,
      toStatus: newStatus,
    });

    await prisma.employeeKeyResult.update({
      where: { id: input.entityId },
      data: {
        status_code: newStatus,
        approved_by:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? input.approverId
            : undefined,
        published_by:
          input.action === "PUBLISHED" ? input.approverId : undefined,
        published_at: input.action === "PUBLISHED" ? new Date() : undefined,
      },
    });

    // Cascade approval UP to the parent Objective if it's pending (especially for adopted KRs)
    if (kr.employee_objective_id) {
      const parentObj = await prisma.employeeObjective.findUnique({
        where: { id: kr.employee_objective_id }
      });
      if (parentObj && ["draft", "submitted", "pending_approval"].includes(parentObj.status_code)) {
        await prisma.employeeObjective.update({
          where: { id: parentObj.id },
          data: {
            status_code: newStatus,
            approved_by:
              input.action === "APPROVED" || input.action === "PUBLISHED"
                ? input.approverId
                : undefined,
            published_by:
              input.action === "PUBLISHED" ? input.approverId : undefined,
            published_at: input.action === "PUBLISHED" ? new Date() : undefined,
          },
        });
      }
    }
  } else if (input.entityType === "EMPLOYEE_MONTH_PLAN") {
    const plan = await prisma.employeeMonthPlan.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!plan) throw new Error("Employee month plan not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "EMPLOYEE_MONTH_PLAN",
      fromStatus: plan.status_code,
      toStatus: newStatus,
    });

    await prisma.employeeMonthPlan.update({
      where: { id: input.entityId },
      data: {
        status_code: newStatus,
        approved_by:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? input.approverId
            : undefined,
        published_by:
          input.action === "PUBLISHED" ? input.approverId : undefined,
        published_at: input.action === "PUBLISHED" ? new Date() : undefined,
      },
    });
  } else if (input.entityType === "WEEKLY_PLAN") {
    const plan = await prisma.weeklyPlan.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!plan) throw new Error("Weekly plan not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "WEEKLY_PLAN",
      fromStatus: plan.status_code,
      toStatus: newStatus,
    });

    await prisma.weeklyPlan.update({
      where: { id: input.entityId },
      data: {
        status_code: newStatus,
        approved_by:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? input.approverId
            : undefined,
        published_by:
          input.action === "PUBLISHED" ? input.approverId : undefined,
        published_at: input.action === "PUBLISHED" ? new Date() : undefined,
      },
    });
  } else if (input.entityType === "DAILY_PLAN") {
    const plan = await prisma.dailyPlan.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!plan) throw new Error("Daily plan not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "DAILY_PLAN",
      fromStatus: plan.status_code,
      toStatus: newStatus,
    });

    await prisma.dailyPlan.update({
      where: { id: input.entityId },
      data: {
        status_code: newStatus,
      },
    });
  } else {
    throw new Error(
      `Approval not supported for entity type: ${input.entityType}. Supported: EMPLOYEE_OBJECTIVE, EMPLOYEE_KR, EMPLOYEE_MONTH_PLAN, WEEKLY_PLAN, DAILY_PLAN`,
    );
  }

  // Log the approval action
  const approvalLog = await prisma.okrApprovalLog.create({
    data: {
      company_id: input.companyId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      approver_id: input.approverId,
      action: input.action,
      comments: input.comments,
    },
  });

  await logActivity({
    companyId: input.companyId,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.approverId,
    action: `approval_${input.action.toLowerCase()}`,
    description: `${input.entityType} #${input.entityId} — ${input.action}${input.comments ? `: ${input.comments}` : ""}`,
    metadata: { approval_log_id: approvalLog.id, action: input.action },
  });

  return {
    approval_log_id: approvalLog.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    new_status: newStatus,
  };
}

// ─── Planning Compliance Report ──────────────────────────────────────────────

export async function getPlanningComplianceReport(params: {
  managerId: string;
  companyId: number;
  cycleId: number;
  monthNumber?: number;
  weekNumber?: number;
  isAdmin?: boolean;
}) {
  const { managerId, companyId, cycleId, monthNumber, weekNumber, isAdmin } = params;

  let managedIds: string[] = [];
  
  if (isAdmin) {
    // Admins see everyone in the company
    const allEmployees = await prisma.employee.findMany({
      where: { company_id: companyId, appUsers: { some: { is_active: true } } },
      select: { id: true }
    });
    managedIds = allEmployees.map(e => e.id);
  } else {
    // Managers see only direct reports for this specific compliance view
    const manager = await prisma.appUser.findFirst({
      where: { id: Number(managerId), company_id: companyId },
      select: { employee_id: true },
    });
    const managerTargetId = manager?.employee_id || managerId;

    const directReports = await prisma.employment.findMany({
      where: {
        company_id: companyId,
        manager_id: managerTargetId,
        is_active: true,
      },
      select: { employee_id: true },
    });
    managedIds = directReports.map((e) => e.employee_id);
  }

  if (managedIds.length === 0) {
    return { objectives: [], monthly: [], weekly: [], daily: [] };
  }

  // 1. Objectives Compliance
  const employments = await prisma.employment.findMany({
    where: { employee_id: { in: managedIds } },
    select: {
      employee_id: true,
      employee: { select: { id: true, full_name: true } },
      department_id: true,
      department: { select: { name: true } },
      is_active: true,
    },
    orderBy: { is_active: "desc" },
  });

  const empDeptMap = new Map();
  for (const e of employments) {
    const existing = empDeptMap.get(e.employee_id);
    // Priority: 1. Active with Dept, 2. Inactive with Dept, 3. Active without Dept, 4. Inactive without Dept
    if (!existing || (!existing.department_id && e.department_id) || (e.is_active && !existing.is_active && e.department_id)) {
      empDeptMap.set(e.employee_id, {
        id: e.employee_id,
        name: e.employee.full_name,
        department_id: e.department_id,
        department_name: e.department?.name || "No Department",
        is_active: e.is_active,
      });
    }
  }

  // Ensure all managedIds are present in the map even if they have no employment record
  const allEmployees = await prisma.employee.findMany({
    where: { id: { in: managedIds } },
    select: { id: true, full_name: true },
  });
  for (const emp of allEmployees) {
    if (!empDeptMap.has(emp.id)) {
      empDeptMap.set(emp.id, {
        id: emp.id,
        name: emp.full_name,
        department_id: null,
        department_name: "No Department",
        is_active: false,
      });
    }
  }

  const objectives = await prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      user_id: { in: managedIds },
    },
    include: {
      _count: { select: { keyResults: true } },
    },
  });

  const objectiveCompliance = Array.from(empDeptMap.values()).map((emp) => {
    const empObjectives = objectives.filter((o) => o.user_id === emp.id);
    const isPlanned = empObjectives.length > 0;
    
    return {
      employee_id: emp.id,
      employee_name: emp.name,
      department_id: emp.department_id,
      department_name: emp.department_name,
      objective_id: isPlanned ? empObjectives[0].id : null,
      objective_title: isPlanned ? empObjectives[0].title : "Unassigned",
      kr_count: isPlanned ? empObjectives.reduce((sum, o) => sum + o._count.keyResults, 0) : 0,
      status_code: isPlanned ? empObjectives[0].status_code : "NOT_STARTED",
      is_planned: isPlanned,
    };
  });

  // 2. Monthly Compliance
  const krs = await prisma.employeeKeyResult.findMany({
    where: {
      company_id: companyId,
      employeeObjective: { cycle_id: cycleId, user_id: { in: managedIds } },
    },
    include: {
      employeeObjective: {
        include: {
          user: { include: { employee: { select: { full_name: true } } } },
        },
      },
      monthPlanItems: {
        where: monthNumber
          ? { monthPlan: { month_number: monthNumber } }
          : {},
        include: { monthPlan: { select: { month_number: true } } },
      },
    },
  });

  // Include employees who haven't adopted KRs yet?
  // The user specifically asked for "unassigned" in the objectives/assigned part.
  // For monthly, it's about whether the KRs have plans.

  const monthlyCompliance = Array.from(empDeptMap.values()).map((emp) => {
    const empKRs = krs.filter((kr) => kr.employeeObjective.user_id === emp.id);
    const allPlannedMonths = Array.from(
      new Set(empKRs.flatMap((kr) => kr.monthPlanItems.map((m: any) => m.monthPlan.month_number))),
    );

    return {
      employee_id: emp.id,
      employee_name: emp.name,
      department_id: emp.department_id,
      department_name: emp.department_name,
      planned_months: allPlannedMonths,
      has_month_plan: monthNumber
        ? allPlannedMonths.includes(monthNumber)
        : allPlannedMonths.length > 0,
    };
  });

  // 3. Weekly Compliance
  const weeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      company_id: companyId,
      employeeKr: {
        employeeObjective: { cycle_id: cycleId, user_id: { in: managedIds } },
      },
      ...(monthNumber ? { monthPlan: { month_number: monthNumber } } : {}),
    },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            include: {
              user: { include: { employee: { select: { full_name: true } } } },
            },
          },
        },
      },
    },
  });

  const weeklyCompliance = Array.from(empDeptMap.values()).map((emp) => {
    const empWeeklyPlans = weeklyPlans.filter((wp) => wp.employeeKr.employeeObjective.user_id === emp.id);
    const plannedWeeks = Array.from(new Set(empWeeklyPlans.map((wp) => wp.week_number)));

    return {
      employee_id: emp.id,
      employee_name: emp.name,
      department_id: emp.department_id,
      department_name: emp.department_name,
      weekly_plans: plannedWeeks.map((w) => ({ week_number: w })),
    };
  });

  // 4. Daily Compliance
  const targetWeeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      company_id: companyId,
      employeeKr: {
        employeeObjective: { cycle_id: cycleId, user_id: { in: managedIds } },
      },
      ...(weekNumber ? { week_number: weekNumber } : {}),
    },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            include: {
              user: { include: { employee: { select: { full_name: true } } } },
            },
          },
        },
      },
      tasks: {
        include: {
          _count: { select: { dailyPlans: true } },
        },
      },
    },
  });

  const dailyCompliance = targetWeeklyPlans.map((wp) => {
    const dailyPlanCount = wp.tasks.reduce((sum, task) => sum + task._count.dailyPlans, 0);
    const empInfo = empDeptMap.get(wp.employeeKr.employeeObjective.user_id);
    return {
      employee_id: wp.employeeKr.employeeObjective.user_id,
      employee_name: empInfo?.name || "Unknown",
      department_id: empInfo?.department_id,
      department_name: empInfo?.department_name || "No Department",
      weekly_plan_id: wp.id,
      weekly_plan_title: wp.title || `Week ${wp.week_number}`,
      week_number: wp.week_number,
      daily_plan_count: dailyPlanCount,
      status_code: wp.status_code,
    };
  });

  // 5. Reporting Compliance
  const progressUpdates = await prisma.progressUpdate.findMany({
    where: {
      employeeKr: {
        employeeObjective: { cycle_id: cycleId, user_id: { in: managedIds } },
      },
    },
    select: {
      id: true,
      created_at: true,
      daily_plan_id: true,
      week_number: true,
      month_number: true,
      employeeKr: {
        select: {
          employeeObjective: { select: { user_id: true } },
        },
      },
    },
  });

  const dailyPlans = await prisma.dailyPlan.findMany({
    where: {
      weeklyTask: {
        weeklyPlan: {
          employeeKr: {
            employeeObjective: { cycle_id: cycleId, user_id: { in: managedIds } },
          },
        },
      },
    },
    select: {
      id: true,
      weeklyTask: {
        select: {
          weeklyPlan: {
            select: {
              employeeKr: {
                select: {
                  employeeObjective: { select: { user_id: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const reportingCompliance = Array.from(empDeptMap.values()).map((emp) => {
    const empUpdates = progressUpdates.filter(
      (u: any) => u.employeeKr.employeeObjective.user_id === emp.id,
    );

    const fromWeekly = empUpdates.filter((u: any) => u.week_number !== null && u.daily_plan_id === null).length;
    const fromDaily = empUpdates.filter((u: any) => u.daily_plan_id !== null).length;
    const fromMonthly = empUpdates.filter((u: any) => u.month_number !== null && u.week_number === null && u.daily_plan_id === null).length;
    const fromDirect = empUpdates.filter((u: any) => u.week_number === null && u.month_number === null && u.daily_plan_id === null).length;

    const empDailyPlans = dailyPlans.filter(
      (dp: any) => dp.weeklyTask.weeklyPlan.employeeKr.employeeObjective.user_id === emp.id,
    );
    const dailyPlansWithProgressIds = new Set(
      empUpdates.filter((u: any) => u.daily_plan_id !== null).map((u: any) => u.daily_plan_id),
    );

    return {
      employee_id: emp.id,
      employee_name: emp.name,
      department_id: emp.department_id,
      department_name: emp.department_name,
      update_count: empUpdates.length,
      breakdown: {
        weekly: fromWeekly,
        daily: fromDaily,
        monthly: fromMonthly,
        direct: fromDirect,
        daily_plan_total: empDailyPlans.length,
        daily_plan_with_progress: dailyPlansWithProgressIds.size,
      },
      last_update:
        empUpdates.length > 0
          ? empUpdates.sort(
              (a: any, b: any) => b.created_at.getTime() - a.created_at.getTime(),
            )[0].created_at
          : null,
      has_updates: empUpdates.length > 0,
    };
  });

  return {
    objectives: objectiveCompliance,
    monthly: monthlyCompliance,
    weekly: weeklyCompliance,
    daily: dailyCompliance,
    reporting: reportingCompliance,
  };
}
