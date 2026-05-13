import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
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
  options?: { directOnly?: boolean },
) {
  const directOnly = options?.directOnly ?? true; // Default: 1-level hierarchy

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

  let allTargetManagerIds: string[];

  if (directOnly) {
    // Strict 1-level hierarchy: only direct reports
    allTargetManagerIds = [...managerIds];
  } else {
    // Recursive subordinates (for dashboards, admin views)
    const subordinateIds = await getAllSubordinateIds(
      manager?.employee_id || managerId,
      companyId,
    );
    allTargetManagerIds = Array.from(
      new Set([...managerIds, ...subordinateIds]),
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

// ─── Team Health Summary ──────────────────────────────────────────────────────

export async function getTeamHealthSummary(
  managerId: string,
  companyId: number,
) {
  const managed = await getManagedEmployeeIds(managerId, companyId, {
    directOnly: false,
  });
  const managedIds = managed.map((e) => e.id);

  if (managedIds.length === 0) {
    return { hasUnsubmittedPlans: false };
  }

  const activeCycle = await prisma.okrCycle.findFirst({
    where: { company_id: companyId, status: "OPEN" },
    select: { id: true },
    orderBy: { start_date: "desc" },
  });

  if (!activeCycle) {
    return { hasUnsubmittedPlans: false };
  }

  const pendingObjective = await prisma.employeeObjective.findFirst({
    where: {
      company_id: companyId,
      cycle_id: activeCycle.id,
      user_id: { in: managedIds },
      status_code: { in: ["submitted", "pending_approval"] },
    },
    select: { id: true },
  });

  return { hasUnsubmittedPlans: !!pendingObjective };
}

// ─── Team Execution Summary ───────────────────────────────────────────────────

export async function getTeamExecutionSummary(
  managerId: string,
  companyId: number,
  cycleId: number,
  filters?: {
    monthNumber?: number;
    weekNumber?: number;
    completionDay?: string;
    role?: string;
  },
) {
  const planCountSelect = {
    monthlyPlans: true,
    subtasks: true,
    progressUpdates: true,
  } as any;

  let managedEmployees: Array<{ id: string; full_name: string }> = [];
  const roleLower = String(filters?.role || "").toLowerCase();
  const isOrgRole = [
    "admin",
    "super admin",
    "superadmin",
    "hr",
    "ceo",
  ].includes(roleLower);

  if (isOrgRole) {
    const employments = await prisma.employment.findMany({
      where: {
        company_id: companyId,
        is_active: true,
      },
      include: {
        employee: {
          select: { id: true, full_name: true },
        },
      },
    });

    const map = new Map<string, { id: string; full_name: string }>();
    for (const emp of employments) {
      if (!map.has(emp.employee_id)) {
        map.set(
          emp.employee_id,
          emp.employee as { id: string; full_name: string },
        );
      }
    }

    managedEmployees = Array.from(map.values()).filter(
      (employee) => String(employee.id) !== String(managerId),
    );
  } else {
    managedEmployees = await getManagedEmployeeIds(managerId, companyId, {
      directOnly: false,
    });
  }
  const managedIds = managedEmployees.map((e) => e.id);

  if (managedIds.length === 0) {
    return { cycle_id: cycleId, team_size: 0, team: [] };
  }

  // Fetch employment details (job_title, department) for each managed employee
  const employments = await prisma.employment.findMany({
    where: {
      company_id: companyId,
      is_active: true,
      employee_id: { in: managedIds },
    },
    include: {
      jobTitle: { select: { title: true } },
      department: { select: { name: true } },
    },
  });
  const employmentByEmployeeId = new Map<
    string,
    { job_title: string; department_name: string }
  >();
  for (const emp of employments) {
    if (!employmentByEmployeeId.has(emp.employee_id)) {
      employmentByEmployeeId.set(emp.employee_id, {
        job_title: emp.jobTitle?.title ?? "No Title",
        department_name: emp.department?.name ?? "No Department",
      });
    }
  }

  // Get all employee objectives for these managed employees
  const objectives = (await prisma.employeeObjective.findMany({
    where: {
      company_id: companyId,
      cycle_id: cycleId,
      user_id: { in: managedIds },
    },
    include: {
      keyResults: {
        include: {
          _count: {
            select: planCountSelect,
          },
          monthlyPlans: {
            select: {
              month_number: true,
              progress_pct: true,
              weeklyPlans: {
                select: {
                  week_number: true,
                  progress_pct: true,
                  confidence_level: true,
                  updated_at: true,
                  dailyPlans: {
                    select: {
                      confidence_level: true,
                      updated_at: true,
                      completion_day: true,
                      progress_pct: true,
                    },
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
  })) as any[];

  // Aggregate per employee
  const teamSummary = managedEmployees.map((employee) => {
    const empObjectives = objectives.filter((o) => o.user_id === employee.id);
    const allKRs = empObjectives.flatMap((o: any) => o.keyResults);

    const totalKRs = allKRs.length;
    const draftKRs = allKRs.filter(
      (kr: any) => kr.status_code === "draft",
    ).length;
    const activeKRs = allKRs.filter((kr: any) =>
      ["approved", "published", "in_progress"].includes(kr.status_code),
    ).length;
    const totalProgressUpdates = allKRs.reduce(
      (sum: number, kr: any) => sum + kr._count.progressUpdates,
      0,
    );

    // Latest confidence per KR from all measurable entities
    const latestUpdates = allKRs
      .map((kr: any) => {
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
        for (const mp of kr.monthlyPlans) {
          for (const w of mp.weeklyPlans) {
            signals.push({
              confidence_level: w.confidence_level,
              observed_at: w.updated_at,
            });
            for (const ms of w.dailyPlans) {
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
      on_track: latestUpdates.filter((u: any) => u === "ON_TRACK").length,
      at_risk: latestUpdates.filter((u: any) => u === "AT_RISK").length,
      off_track: latestUpdates.filter((u: any) => u === "OFF_TRACK").length,
    };

    // Quarterly progress (average final_score across all employee objectives)
    const progress =
      empObjectives.length > 0
        ? empObjectives.reduce(
          (s: number, o: any) => s + Number(o.final_score ?? 0),
          0,
        ) / empObjectives.length
        : 0;

    // Quarterly indirect progress
    const indirect_progress =
      empObjectives.length > 0
        ? empObjectives.reduce(
          (s: number, o: any) => s + Number(o.indirect_score ?? 0),
          0,
        ) / empObjectives.length
        : 0;

    // Build monthly_progress and indirect_monthly_progress maps
    const monthlyMap: Record<
      number,
      { sum: number; count: number; indirectSum: number; indirectCount: number }
    > = {};
    for (const kr of allKRs) {
      for (const mp of kr.monthlyPlans) {
        const m = Number(mp.month_number);
        if (!monthlyMap[m])
          monthlyMap[m] = {
            sum: 0,
            count: 0,
            indirectSum: 0,
            indirectCount: 0,
          };
        monthlyMap[m].sum += Number(mp.progress_pct ?? 0);
        monthlyMap[m].count += 1;
        if (mp.indirect_score !== null && mp.indirect_score !== undefined) {
          monthlyMap[m].indirectSum += Number(mp.indirect_score);
          monthlyMap[m].indirectCount += 1;
        }
      }
    }
    const monthly_progress: Record<number, number> = {};
    const indirect_monthly_progress: Record<number, number> = {};
    for (const [
      m,
      { sum, count, indirectSum, indirectCount },
    ] of Object.entries(monthlyMap)) {
      const mn = Number(m);
      monthly_progress[mn] = count > 0 ? Number((sum / count).toFixed(2)) : 0;
      indirect_monthly_progress[mn] =
        indirectCount > 0
          ? Number((indirectSum / indirectCount).toFixed(2))
          : 0;
    }

    // Build weekly_progress and indirect_weekly_progress maps
    const weeklyMap: Record<
      number,
      { sum: number; count: number; indirectSum: number; indirectCount: number }
    > = {};
    for (const kr of allKRs) {
      for (const mp of kr.monthlyPlans) {
        for (const wp of mp.weeklyPlans) {
          const w = Number(wp.week_number);
          if (!weeklyMap[w])
            weeklyMap[w] = {
              sum: 0,
              count: 0,
              indirectSum: 0,
              indirectCount: 0,
            };
          weeklyMap[w].sum += Number(wp.progress_pct ?? 0);
          weeklyMap[w].count += 1;
          if (wp.indirect_score !== null && wp.indirect_score !== undefined) {
            weeklyMap[w].indirectSum += Number(wp.indirect_score);
            weeklyMap[w].indirectCount += 1;
          }
        }
      }
    }
    const weekly_progress: Record<number, number> = {};
    const indirect_weekly_progress: Record<number, number> = {};
    for (const [
      w,
      { sum, count, indirectSum, indirectCount },
    ] of Object.entries(weeklyMap)) {
      const wn = Number(w);
      weekly_progress[wn] = count > 0 ? Number((sum / count).toFixed(2)) : 0;
      indirect_weekly_progress[wn] =
        indirectCount > 0
          ? Number((indirectSum / indirectCount).toFixed(2))
          : 0;
    }

    // Build daily_progress map: { [week_number]: { [day]: avg progress_pct across all daily plans } }
    const dailyMap: Record<
      number,
      Record<string, { sum: number; count: number }>
    > = {};
    for (const kr of allKRs) {
      for (const mp of kr.monthlyPlans) {
        for (const wp of mp.weeklyPlans) {
          const w = Number(wp.week_number);
          if (!dailyMap[w]) dailyMap[w] = {};
          for (const dp of wp.dailyPlans) {
            const d = dp.completion_day;
            if (!dailyMap[w][d]) dailyMap[w][d] = { sum: 0, count: 0 };
            dailyMap[w][d].sum += Number(dp.progress_pct ?? 0);
            dailyMap[w][d].count += 1;
          }
        }
      }
    }
    const daily_progress: Record<number, Record<string, number>> = {};
    for (const [w, days] of Object.entries(dailyMap)) {
      const wn = Number(w);
      daily_progress[wn] = {};
      for (const [d, { sum, count }] of Object.entries(days)) {
        daily_progress[wn][d] =
          count > 0 ? Number((sum / count).toFixed(2)) : 0;
      }
    }

    const empInfo = employmentByEmployeeId.get(employee.id) ?? {
      job_title: "No Title",
      department_name: "No Department",
    };

    return {
      id: employee.id,
      employee_id: employee.id,
      employee_name: employee.full_name,
      job_title: empInfo.job_title,
      department_name: empInfo.department_name,
      objective_title: empObjectives[0]?.title ?? "—",
      objectives_count: empObjectives.length,
      objectives_status: {
        draft: empObjectives.filter((o: any) => o.status_code === "draft")
          .length,
        submitted: empObjectives.filter(
          (o: any) => o.status_code === "submitted",
        ).length,
        approved: empObjectives.filter((o: any) => o.status_code === "approved")
          .length,
        published: empObjectives.filter(
          (o: any) => o.status_code === "published",
        ).length,
      },
      total_krs: totalKRs,
      draft_krs: draftKRs,
      active_krs: activeKRs,
      progress,
      indirect_progress,
      monthly_progress,
      weekly_progress,
      daily_progress,
      indirect_monthly_progress,
      indirect_weekly_progress,
      indirect_daily_progress: {}, // Daily plans don't have indirect_score in schema yet
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
  const managedEmployees = await getManagedEmployeeIds(managerId, companyId, {
    directOnly: false,
  });
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
    pendingObjectiveIds.length > 0
      ? await prisma.employeeMonthPlan.findMany({
        where: {
          company_id: companyId,
          status_code: { in: ["submitted", "pending_approval"] },
          ...({ employee_objective_id: { in: pendingObjectiveIds } } as any),
        } as any,
      })
      : [];

  // Get pending weekly plans for managed employees
  const pendingWeeklyPlans =
    pendingKrIds.length > 0
      ? await prisma.weeklyPlan.findMany({
        where: {
          company_id: companyId,
          monthPlan: { employee_kr_id: { in: pendingKrIds } },
          plan_status: "SUBMITTED",
        },
        include: { monthPlan: { select: { employee_kr_id: true } } },
      })
      : [];

  const pendingWeeklyPlanIds = pendingWeeklyPlans.map((w) => w.id);

  // Get pending daily plans for managed employees
  const pendingDailyPlans =
    pendingWeeklyPlanIds.length > 0
      ? await prisma.dailyPlan.findMany({
        where: {
          company_id: companyId,
          weekly_plan_id: { in: pendingWeeklyPlanIds },
          // Daily plans don't have a submission lifecycle in the new schema;
          // surface in-progress / pending tasks for visibility.
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      })
      : [];

  // Create employee name map for easy lookup
  const nameMap = new Map(managedEmployees.map((e) => [e.id, e.full_name]));

  // CEO/Admin review queue for Department Objectives (Legacy)
  // Replaced by Employee Objectives for Department Heads in the new model.
  const pendingDepartmentObjectives: any[] = [];

  const objectiveUserMap = new Map(
    pendingObjectives.map((o) => [o.id, o.user_id]),
  );
  const krUserMap = new Map(
    pendingKRs.map((kr) => [kr.id, kr.employeeObjective.user_id]),
  );
  const weeklyUserMap = new Map(
    pendingWeeklyPlans.map((w: any) => [
      w.id,
      krUserMap.get(w.monthPlan?.employee_kr_id) ?? "",
    ]),
  );

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
        nameMap.get(
          objectiveUserMap.get((plan as any).employee_objective_id) || "",
        ) ||
        objectiveUserMap.get((plan as any).employee_objective_id) ||
        "—",
    })),
    pending_weekly_plans: pendingWeeklyPlans.map((plan: any) => ({
      ...plan,
      employee_name:
        nameMap.get(krUserMap.get(plan.monthPlan?.employee_kr_id) || "") ||
        krUserMap.get(plan.monthPlan?.employee_kr_id) ||
        "—",
    })),
    pending_daily_plans: pendingDailyPlans.map((plan) => ({
      ...plan,
      employee_name:
        nameMap.get(weeklyUserMap.get(plan.weekly_plan_id) || "") ||
        weeklyUserMap.get(plan.weekly_plan_id) ||
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
        select: { id: true, role_type: true },
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
  } else if (input.entityType === "EMPLOYEE_MONTH_PLAN") {
    const plan = await prisma.employeeMonthPlan.findFirst({
      where: { id: input.entityId, company_id: input.companyId },
    });
    if (!plan) throw new Error("Employee month plan not found.");

    await validateStatusTransition({
      companyId: input.companyId,
      entityType: "EMPLOYEE_MONTH_PLAN",
      fromStatus: plan.plan_status,
      toStatus: newStatus,
    });

    await prisma.employeeMonthPlan.update({
      where: { id: input.entityId },
      data: {
        plan_status: newStatus.toUpperCase() as any,
        approved_at:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? new Date()
            : undefined,
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
      fromStatus: plan.plan_status,
      toStatus: newStatus,
    });

    await prisma.weeklyPlan.update({
      where: { id: input.entityId },
      data: {
        plan_status: newStatus.toUpperCase() as any,
        approved_at:
          input.action === "APPROVED" || input.action === "PUBLISHED"
            ? new Date()
            : undefined,
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
      fromStatus: plan.status,
      toStatus: newStatus,
    });

    await prisma.dailyPlan.update({
      where: { id: input.entityId },
      data: {
        status: newStatus.toUpperCase() as any,
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

type PlanningInsightScope = "organization" | "department";

type MemberPlanningInsight = {
  employee_user_id: string;
  employee_id: string;
  employee_name: string;
  department_id: number | null;
  department_name: string;
  objective_count: number;
  objective_status: {
    draft: number;
    submitted: number;
    approved: number;
    published: number;
  };
  kr_count: number;
  monthly_plan_count: number;
  weekly_plan_count: number;
  daily_plan_count: number;
  daily_plan_with_progress_count: number;
  progress_update_count: number;
  has_set_monthly_plan: boolean;
  has_set_weekly_plan: boolean;
  has_set_daily_plan: boolean;
  has_updated_progress: boolean;
  last_progress_at: Date | null;
  latest_reviewer_note?: string | null;
};

function normalizeRole(role?: string | null): string {
  return (role || "").toLowerCase();
}

export async function getPlanningInsights(params: {
  requesterUserId: string;
  companyId: number;
  cycleId: number;
  role?: string;
  scope: PlanningInsightScope;
  departmentId?: number;
  forceOrganizationView?: boolean;
  monthNumber?: number;
  weekNumber?: number;
  completionDay?: string;
}) {
  const planCountSelect = {
    monthlyPlans: true,
    progressUpdates: true,
  } as any;

  const requester = await prisma.appUser.findFirst({
    where: { id: Number(params.requesterUserId), company_id: params.companyId },
    select: { id: true, employee_id: true },
  });

  if (!requester) {
    return {
      cycle_id: params.cycleId,
      scope: params.scope,
      totals: {
        members: 0,
        objectives: 0,
        krs: 0,
        monthly_plans: 0,
        weekly_plans: 0,
        daily_plans: 0,
        progress_updates: 0,
      },
      highlights: {
        set_monthly_plan: [],
        missing_monthly_plan: [],
        set_weekly_plan: [],
        missing_weekly_plan: [],
        set_daily_plan: [],
        missing_daily_plan: [],
        updated_progress: [],
        missing_progress_update: [],
      },
      members: [],
    };
  }

  const requesterIds = [String(requester.id)];
  if (requester.employee_id) requesterIds.push(String(requester.employee_id));

  const requesterEmployment = await prisma.employment.findMany({
    where: {
      company_id: params.companyId,
      is_active: true,
      employee_id: { in: requesterIds },
    },
    select: { department_id: true },
  });
  const requesterDepartmentIds = requesterEmployment
    .map((e) => e.department_id)
    .filter((id): id is number => Number.isFinite(id));

  const subordinateIds = await getAllSubordinateIds(
    requester.employee_id || String(requester.id),
    params.companyId,
  );
  const managerScopeIds = Array.from(
    new Set([...requesterIds, ...subordinateIds]),
  );

  const role = normalizeRole(params.role);
  const isOrganizationRole =
    ["admin", "hr", "ceo", "super admin", "superadmin"].includes(role) ||
    params.forceOrganizationView === true;

  const employmentWhere: any = {
    company_id: params.companyId,
    is_active: true,
  };

  // 1. Apply strict department filter if requested
  if (params.departmentId && Number.isFinite(params.departmentId)) {
    employmentWhere.department_id = Number(params.departmentId);
  }

  // 2. Apply visibility constraints for non-privileged users
  if (!isOrganizationRole) {
    const visibilityConstraints: any[] = [
      { manager_id: { in: managerScopeIds } },
      requesterDepartmentIds.length > 0
        ? { department_id: { in: requesterDepartmentIds } }
        : undefined,
    ].filter(Boolean);

    if (visibilityConstraints.length > 0) {
      // If we already have a department_id filter, the visibility must be within that department or manager scope
      employmentWhere.OR = visibilityConstraints;
    }
  }


  const employments = await prisma.employment.findMany({
    where: employmentWhere,
    include: {
      employee: { select: { id: true, full_name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [
      { department: { name: "asc" } },
      { employee: { full_name: "asc" } },
    ],
  });

  const memberByEmployeeId = new Map<
    string,
    {
      employee_user_id: string;
      employee_id: string;
      employee_name: string;
      department_id: number | null;
      department_name: string;
    }
  >();

  for (const e of employments) {
    if (!memberByEmployeeId.has(e.employee_id)) {
      memberByEmployeeId.set(e.employee_id, {
        employee_user_id: String(e.employee.id),
        employee_id: e.employee_id,
        employee_name: e.employee.full_name,
        department_id: e.department?.id ?? null,
        department_name: e.department?.name ?? "Unassigned",
      });
    }
  }

  const members = Array.from(memberByEmployeeId.values());
  const memberUserIds = members.map((m) => m.employee_user_id);

  if (memberUserIds.length === 0) {
    return {
      cycle_id: params.cycleId,
      scope: params.scope,
      totals: {
        members: 0,
        objectives: 0,
        krs: 0,
        monthly_plans: 0,
        weekly_plans: 0,
        daily_plans: 0,
        progress_updates: 0,
      },
      highlights: {
        set_monthly_plan: [],
        missing_monthly_plan: [],
        set_weekly_plan: [],
        missing_weekly_plan: [],
        set_daily_plan: [],
        missing_daily_plan: [],
        updated_progress: [],
        missing_progress_update: [],
      },
      members: [],
    };
  }

  const cycle = await prisma.okrCycle.findUnique({
    where: { id: params.cycleId },
    select: { start_date: true, end_date: true },
  });

  let progressWhere: any = {};
  if (cycle) {
    if (params.monthNumber) {
      const start = new Date(cycle.start_date);
      start.setMonth(start.getMonth() + (Number(params.monthNumber) - 1));
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      progressWhere = { created_at: { gte: start, lt: end } };
    } else if (params.weekNumber) {
      const start = new Date(cycle.start_date);
      start.setDate(start.getDate() + (Number(params.weekNumber) - 1) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      progressWhere = { created_at: { gte: start, lt: end } };
    }
  }

  const objectives = (await prisma.employeeObjective.findMany({
    where: {
      company_id: params.companyId,
      cycle_id: params.cycleId,
      user_id: { in: memberUserIds },
    },
    include: {
      keyResults: {
        include: {
          _count: {
            select: {
              ...planCountSelect,
              progressUpdates: { where: progressWhere },
            },
          },
          monthlyPlans: {
            where: params.monthNumber
              ? { month_number: Number(params.monthNumber) }
              : {},
            select: {
              id: true,
              month_number: true,
              reviewer_id: true,
              rejection_note: true,
              submitted_at: true,
              approved_at: true,
              published_at: true,
              updated_at: true,
              weeklyPlans: {
                where: params.weekNumber
                  ? { week_number: Number(params.weekNumber) }
                  : {},
                select: {
                  id: true,
                  week_number: true,
                  reviewer_id: true,
                  rejection_note: true,
                  submitted_at: true,
                  approved_at: true,
                  published_at: true,
                  updated_at: true,
                  _count: { select: { dailyPlans: true } },
                  dailyPlans: {
                    select: {
                      updated_at: true,
                      completion_day: true,
                      progress_pct: true,
                    },
                  },
                },
              },
            },
          },
          progressUpdates: {
            where: progressWhere,
            select: { created_at: true },
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
      },
    },
  })) as any[];

  const byUser = new Map<string, MemberPlanningInsight>();
  for (const m of members) {
    byUser.set(m.employee_user_id, {
      ...m,
      objective_count: 0,
      objective_status: { draft: 0, submitted: 0, approved: 0, published: 0 },
      kr_count: 0,
      monthly_plan_count: 0,
      weekly_plan_count: 0,
      daily_plan_count: 0,
      daily_plan_with_progress_count: 0,
      progress_update_count: 0,
      has_set_monthly_plan: false,
      has_set_weekly_plan: false,
      has_set_daily_plan: false,
      has_updated_progress: false,
      last_progress_at: null,
    });
  }

  for (const objective of objectives) {
    const row = byUser.get(objective.user_id);
    if (!row) continue;

    row.objective_count += 1;
    const status = String(objective.status_code || "").toLowerCase();
    if (status in row.objective_status) {
      (row.objective_status as any)[status] += 1;
    }

    row.kr_count += objective.keyResults.length;
    for (const kr of objective.keyResults) {
      const allWeeklyPlans = kr.monthlyPlans.flatMap(
        (mp: any) => mp.weeklyPlans,
      );

      row.monthly_plan_count += kr.monthlyPlans.length;
      row.weekly_plan_count += allWeeklyPlans.length;
      row.progress_update_count += kr._count.progressUpdates;

      const filteredDailyPlans = allWeeklyPlans.flatMap((wp: any) => {
        return params.completionDay
          ? wp.dailyPlans.filter(
            (dp: any) => dp.completion_day === params.completionDay,
          )
          : wp.dailyPlans;
      });

      row.daily_plan_count += filteredDailyPlans.length;
      row.daily_plan_with_progress_count += filteredDailyPlans.filter(
        (dp: any) => Number(dp.progress_pct ?? 0) > 0,
      ).length;

      if (kr.monthlyPlans.length > 0) row.has_set_monthly_plan = true;
      if (allWeeklyPlans.length > 0) row.has_set_weekly_plan = true;
      if (allWeeklyPlans.some((wp: any) => (wp._count?.dailyPlans || 0) > 0)) {
        row.has_set_daily_plan = true;
      }
      if (kr._count.progressUpdates > 0 || row.daily_plan_with_progress_count > 0) {
        row.has_updated_progress = true;
      }

      const latestProgress = kr.progressUpdates[0]?.created_at ?? null;
      if (
        latestProgress &&
        (!row.last_progress_at ||
          latestProgress.getTime() > row.last_progress_at.getTime())
      ) {
        row.last_progress_at = latestProgress;
      }

      for (const wp of allWeeklyPlans) {
        // capture any reviewer notes from weekly plans
        if (!row.latest_reviewer_note && wp.rejection_note) {
          row.latest_reviewer_note = wp.rejection_note || null;
        }
        for (const dp of wp.dailyPlans) {
          if (!row.last_progress_at || dp.updated_at > row.last_progress_at) {
            row.last_progress_at = dp.updated_at;
          }
        }
      }

      // capture reviewer notes from monthly plans if not already set
      for (const mp of kr.monthlyPlans) {
        if (!row.latest_reviewer_note && mp.rejection_note) {
          row.latest_reviewer_note = mp.rejection_note || null;
        }
      }
    }
  }

  const memberRows = Array.from(byUser.values());
  const highlights = {
    set_monthly_plan: memberRows
      .filter((m) => m.has_set_monthly_plan)
      .map((m) => m.employee_name),
    missing_monthly_plan: memberRows
      .filter((m) => !m.has_set_monthly_plan)
      .map((m) => m.employee_name),
    set_weekly_plan: memberRows
      .filter((m) => m.has_set_weekly_plan)
      .map((m) => m.employee_name),
    missing_weekly_plan: memberRows
      .filter((m) => !m.has_set_weekly_plan)
      .map((m) => m.employee_name),
    set_daily_plan: memberRows
      .filter((m) => m.has_set_daily_plan)
      .map((m) => m.employee_name),
    missing_daily_plan: memberRows
      .filter((m) => !m.has_set_daily_plan)
      .map((m) => m.employee_name),
    updated_progress: memberRows
      .filter((m) => m.has_updated_progress)
      .map((m) => m.employee_name),
    missing_progress_update: memberRows
      .filter((m) => !m.has_updated_progress)
      .map((m) => m.employee_name),
  };

  // Performance Metrics Calculation
  let totalObjectiveProgress = new Decimal(0);
  let atRiskKrCount = 0;
  let onTrackKrCount = 0;

  for (const obj of objectives) {
    totalObjectiveProgress = totalObjectiveProgress.add(
      new Decimal(obj.final_score || 0),
    );

    for (const kr of obj.keyResults) {
      let isAtRisk = false;
      let isOnTrack = false;

      // 1. Check latest progress update confidence
      const latestUpdate = kr.progressUpdates[0];
      if (latestUpdate) {
        if (["AT_RISK", "OFF_TRACK"].includes(latestUpdate.confidence_level)) {
          isAtRisk = true;
        } else if (latestUpdate.confidence_level === "ON_TRACK") {
          isOnTrack = true;
        }
      }

      // 2. Check plans if not already decided
      if (!isAtRisk && !isOnTrack) {
        for (const mp of kr.monthlyPlans) {
          for (const wp of mp.weeklyPlans) {
            if (["AT_RISK", "OFF_TRACK"].includes(wp.confidence_level)) {
              isAtRisk = true;
              break;
            } else if (wp.confidence_level === "ON_TRACK") {
              isOnTrack = true;
              // we don't break yet, maybe a daily plan is at risk?
            }
            for (const dp of wp.dailyPlans) {
              if (["AT_RISK", "OFF_TRACK"].includes(dp.confidence_level)) {
                isAtRisk = true;
                isOnTrack = false;
                break;
              }
            }
            if (isAtRisk) break;
          }
          if (isAtRisk) break;
        }
      }

      if (isAtRisk) atRiskKrCount++;
      else if (isOnTrack) onTrackKrCount++;
    }
  }

  const totals = {
    members: memberRows.length,
    objectives: memberRows.reduce((s, m) => s + m.objective_count, 0),
    krs: memberRows.reduce((s, m) => s + m.kr_count, 0),
    monthly_plans: memberRows.reduce((s, m) => s + m.monthly_plan_count, 0),
    weekly_plans: memberRows.reduce((s, m) => s + m.weekly_plan_count, 0),
    daily_plans: memberRows.reduce((s, m) => s + m.daily_plan_count, 0),
    progress_updates: memberRows.reduce(
      (s, m) => s + m.progress_update_count,
      0,
    ),
    avg_progress:
      objectives.length > 0
        ? totalObjectiveProgress.div(objectives.length).toNumber()
        : 0,
    at_risk_kr_count: atRiskKrCount,
    on_track_kr_count: onTrackKrCount,
  };


  return {
    cycle_id: params.cycleId,
    scope: params.scope,
    totals,
    highlights,
    members: memberRows,
  };
}

export async function getPlanningCompliance(params: {
  requesterUserId: string;
  companyId: number;
  cycleId: number;
  monthNumber?: number;
  weekNumber?: number;
  completionDay?: string;
  role?: string;
}) {
  const insights = await getPlanningInsights({
    requesterUserId: params.requesterUserId,
    companyId: params.companyId,
    cycleId: params.cycleId,
    role: params.role,
    scope: "organization",
    forceOrganizationView: false,
    monthNumber: params.monthNumber,
    weekNumber: params.weekNumber,
    completionDay: params.completionDay,
  });

  const memberRows = insights.members;

  // Transform memberRows into the structure expected by the frontend
  // The frontend expects: { objectives: [], monthly: [], weekly: [], daily: [], reporting: [] }

  const objectives = memberRows.map((m) => ({
    employee_id: m.employee_id,
    employee_name: m.employee_name,
    department_name: m.department_name,
    is_planned:
      m.objective_status.approved > 0 || m.objective_status.published > 0,
    reviewer_note: (m as any).latest_reviewer_note || null,
  }));

  const monthly = memberRows.map((m) => ({
    employee_id: m.employee_id,
    employee_name: m.employee_name,
    department_name: m.department_name,
    has_month_plan: m.monthly_plan_count > 0,
    reviewer_note: (m as any).latest_reviewer_note || null,
  }));

  const weekly = memberRows.map((m) => ({
    employee_id: m.employee_id,
    employee_name: m.employee_name,
    department_name: m.department_name,
    weekly_plans: m.weekly_plan_count > 0 ? [1] : [], // Frontend checks weekly_plans?.length > 0
    reviewer_note: (m as any).latest_reviewer_note || null,
  }));

  const daily = memberRows.map((m) => ({
    employee_id: m.employee_id,
    employee_name: m.employee_name,
    department_name: m.department_name,
    has_daily_plan: m.daily_plan_count > 0,
  }));

  const reporting = memberRows.map((m) => ({
    employee_id: m.employee_id,
    employee_name: m.employee_name,
    department_name: m.department_name,
    update_count: m.progress_update_count + m.daily_plan_count,
    last_update: m.last_progress_at,
    status: m.has_updated_progress ? "On Track" : "Off Track",
    is_reported: m.has_updated_progress,
    breakdown: {
      weekly: m.weekly_plan_count,
      daily_plan_total: m.daily_plan_count,
      daily_plan_with_progress: m.daily_plan_with_progress_count,
      monthly: m.monthly_plan_count,
      direct: m.progress_update_count,
      indirect: 0,
    },
  }));

  return {
    objectives,
    monthly,
    weekly,
    daily,
    reporting,
    totals: insights.totals,
    highlights: insights.highlights,
  };
}
