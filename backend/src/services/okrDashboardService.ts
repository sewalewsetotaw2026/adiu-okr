import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import {
  refreshFullRollup,
  getFinancialBreakdown,
  getCompletionStatus,
} from "src/services/okrRollupService";
import { logActivity } from "src/services/okrActivityLogService";

function pickLatestConfidenceSignal(
  signals: Array<{ confidence_level: string | null; observed_at: Date }>,
) {
  const valid = signals.filter((s) => Boolean(s.confidence_level));
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.observed_at.getTime() - a.observed_at.getTime());
  return valid[0].confidence_level;
}

/**
 * Recursively fetches all employee IDs reporting to a manager (Direct + Indirect).
 */
export async function getReportingTreeIds(
  companyId: number,
  managerId: string,
): Promise<string[]> {
  // Use a recursive CTE to fetch the full hierarchy efficiently
  const results: any[] = await prisma.$queryRaw`
    WITH RECURSIVE subordinates AS (
      -- Base case: direct reports
      SELECT employee_id, manager_id
      FROM employment
      WHERE manager_id = ${managerId} AND company_id = ${companyId} AND is_active = true

      UNION

      -- Recursive step: reports of reports
      SELECT e.employee_id, e.manager_id
      FROM employment e
      INNER JOIN subordinates s ON s.employee_id = e.manager_id
      WHERE e.company_id = ${companyId} AND e.is_active = true
    )
    SELECT DISTINCT employee_id FROM subordinates
  `;

  return results.map((r) => r.employee_id);
}

// =============================================================================
// OKR DASHBOARD SERVICE — CEO, Department Comparison, Gallery, At-Risk
// =============================================================================

/**
 * CEO Dashboard — Company-wide OKR summary for a cycle.
 */
export async function getCeoDashboard(companyId: number, cycleId: number) {
  const objectives = await prisma.companyObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    include: {
      keyResults: {
        include: {
          metricDefinition: true,
          _count: { select: { employeeObjectives: true } },
        },
      },
    },
  });

  const totalObjectives = objectives.length;
  const totalKRs = objectives.reduce((sum, o) => sum + o.keyResults.length, 0);

  const progressValues = objectives
    .map((o) => Number(o.final_score || 0));
  const avgScore =
    progressValues.length > 0
      ? new Decimal(
          progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length,
        ).toDecimalPlaces(2)
      : new Decimal(0);

  const indirectScores = objectives
    .filter((o: any) => o.indirect_score)
    .map((o: any) => o.indirect_score as Decimal);
  const avgIndirectScore =
    indirectScores.length > 0
      ? indirectScores
          .reduce((sum: Decimal, s: Decimal) => sum.add(s), new Decimal(0))
          .div(indirectScores.length)
      : new Decimal(0);

  const totalValue = objectives.reduce(
    (sum, o) => sum.add(o.final_value ?? new Decimal(0)),
    new Decimal(0),
  );
  const totalIndirectValue = objectives.reduce(
    (sum: Decimal, o: any) =>
      sum.add(
        o.indirect_value ? new Decimal(o.indirect_value) : new Decimal(0),
      ),
    new Decimal(0),
  );

  const completedObjectives = objectives.filter(
    (o) => o.final_score && o.final_score.gte(100),
  ).length;

  const deptObjectiveCount = await prisma.employeeObjective.count({
    where: { company_id: companyId, cycle_id: cycleId },
  });

  const employeeKrs = await prisma.employeeKeyResult.findMany({
    where: {
      company_id: companyId,
      employeeObjective: { cycle_id: cycleId },
    },
    include: {
      progressUpdates: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { confidence_level: true, created_at: true },
      },
      monthlyPlans: {
        select: {
          weeklyPlans: {
            select: {
              confidence_level: true,
              updated_at: true,
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
    },
  });

  const latestSignals = employeeKrs.map((kr: any) => {
    const signals: Array<{
      confidence_level: string | null;
      observed_at: Date;
    }> = [];

    for (const p of kr.progressUpdates || []) {
      signals.push({
        confidence_level: p.confidence_level,
        observed_at: p.created_at,
      });
    }
    for (const m of kr.monthlyPlans || []) {
      for (const w of m.weeklyPlans || []) {
        signals.push({
          confidence_level: w.confidence_level,
          observed_at: w.updated_at,
        });
        for (const ms of w.dailyPlans || []) {
          signals.push({
            confidence_level: ms.confidence_level,
            observed_at: ms.updated_at,
          });
        }
      }
    }
    for (const s of kr.subtasks || []) {
      signals.push({
        confidence_level: s.confidence_level,
        observed_at: s.updated_at,
      });
    }

    return pickLatestConfidenceSignal(signals);
  });

  const confidenceDistribution = {
    on_track: latestSignals.filter((v) => v === "ON_TRACK").length,
    at_risk: latestSignals.filter((v) => v === "AT_RISK").length,
    off_track: latestSignals.filter((v) => v === "OFF_TRACK").length,
    not_reported: latestSignals.filter((v) => !v).length,
  };

  return {
    cycleId,
    companyId,
    summary: {
      totalCompanyObjectives: totalObjectives,
      totalCompanyKRs: totalKRs,
      completedCompanyObjectives: completedObjectives,
      avgCompanyScore: avgScore,
      totalCompanyValue: totalValue,
      avgCompanyIndirectScore: avgIndirectScore,
      totalCompanyIndirectValue: totalIndirectValue,
      totalDepartmentObjectives: deptObjectiveCount,
    },
    confidenceDistribution,
    objectives: objectives.map((o) => ({
      id: o.id,
      title: o.title,
      score: Number(o.final_score || 0),
      value: o.final_value,
      target_value: 100, // Company Objectives don't have target_value in some contexts, defaulting to 100
      indirectScore: (o as any).indirect_score,
      indirectValue: (o as any).indirect_value,
      status: o.status_code,
      krCount: o.keyResults.length,
      departmentCount: o.keyResults.reduce(
        (s, kr) => s + kr._count.employeeObjectives,
        0,
      ),
    })),
    recentSnapshots: await prisma.okrScoreSnapshot.findMany({
      where: {
        company_id: companyId,
        cycle_id: cycleId,
        scope_level: "COMPANY",
      },
      orderBy: { snapshot_date: "desc" },
      take: 10,
    }),
    archiveId: (await prisma.quarterArchive.findUnique({
      where: { company_id_cycle_id: { company_id: companyId, cycle_id: cycleId } },
      select: { id: true }
    }))?.id || null
  };
}

/**
 * Department Comparison — Side-by-side department performance.
 */
export async function getDepartmentComparison(
  companyId: number,
  cycleId: number,
) {
  const deptObjectives = await prisma.employeeObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    select: {
      id: true,
      final_score: true,
      final_value: true,
      user: {
        select: {
          employee: {
            select: {
              employments: {
                where: { is_active: true },
                select: { department: { select: { id: true, name: true } } }
              }
            }
          }
        }
      },
      keyResults: {
        select: {
          final_score: true,
          final_value: true,
          is_mandatory_for_completion: true,
        },
      },
    },
  });

  const deptMap = new Map<
    number,
    { departmentId: number; departmentName: string; objectives: any[] }
  >();

  for (const obj of deptObjectives) {
    const department = obj.user?.employee?.employments[0]?.department;
    if (!department) continue;
    const deptId = department.id;
    if (!deptMap.has(deptId)) {
      deptMap.set(deptId, {
        departmentId: deptId,
        departmentName: department.name,
        objectives: [],
      });
    }
    deptMap.get(deptId)!.objectives.push(obj);
  }

  const departments = Array.from(deptMap.values()).map((dept) => {
    const allKRs = dept.objectives.flatMap((o: any) => o.keyResults);
    const progressValues = dept.objectives
      .map((o: any) => Number(o.final_score || 0));
    const avgScore =
      progressValues.length > 0
        ? new Decimal(
            progressValues.reduce((sum: number, v: number) => sum + v, 0) / progressValues.length,
          ).toDecimalPlaces(2)
        : new Decimal(0);
    const totalValue = allKRs.reduce(
      (sum: Decimal, kr: any) =>
        sum.add(kr.final_value ? new Decimal(kr.final_value) : new Decimal(0)),
      new Decimal(0),
    );
    const objectiveIndirectScores = dept.objectives
      .filter((o: any) => o.indirect_score)
      .map((o: any) => new Decimal(o.indirect_score));
    const avgIndirectScore =
      objectiveIndirectScores.length > 0
        ? objectiveIndirectScores
            .reduce((sum: Decimal, s: Decimal) => sum.add(s), new Decimal(0))
            .div(objectiveIndirectScores.length)
        : new Decimal(0);

    const totalIndirectValue = allKRs.reduce(
      (sum: Decimal, kr: any) =>
        sum.add(
          kr.indirect_value ? new Decimal(kr.indirect_value) : new Decimal(0),
        ),
      new Decimal(0),
    );

    const totalKRs = allKRs.length;
    const completedKRs = allKRs.filter(
      (kr: any) => kr.final_score && new Decimal(kr.final_score).gte(100),
    ).length;
    const completionRate = totalKRs > 0 ? (completedKRs / totalKRs) * 100 : 0;

    return {
      departmentId: dept.departmentId,
      departmentName: dept.departmentName,
      objectiveCount: dept.objectives.length,
      krCount: totalKRs,
      completedKRs,
      avgScore,
      totalValue,
      avgIndirectScore,
      totalIndirectValue,
      completionRate,
    };
  });

  departments.sort((a, b) => Number(b.avgScore) - Number(a.avgScore));
  return { cycleId, companyId, departments };
}

/**
 * Company OKR Gallery — All objectives with nested KR status.
 */
export async function getCompanyOkrGallery(companyId: number, cycleId: number) {
  const objectives = await prisma.companyObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    include: {
      keyResults: {
        include: {
          metricDefinition: {
            select: { name: true, category: true, is_financial: true },
          },
          employeeObjectives: {
            include: {
              user: {
                select: {
                  employee: {
                    select: {
                      employments: {
                        where: { is_active: true },
                        select: { department_id: true }
                      }
                    }
                  }
                }
              }
            }
          },
        },
      },
    },
  });

  return {
    cycleId,
    companyId,
    objectives: objectives.map((obj) => ({
      id: obj.id,
      title: obj.title,
      description: obj.description,
      score: obj.final_score,
      value: obj.final_value,
      indirectScore: (obj as any).indirect_score,
      indirectValue: (obj as any).indirect_value,
      status: obj.status_code,
      keyResults: obj.keyResults.map((kr: any) => ({
        id: kr.id,
        title: kr.title,
        score: kr.final_score,
        value: kr.final_value,
        indirectScore: kr.indirect_score,
        indirectValue: kr.indirect_value,
        target: kr.target_value,
        unit: kr.unit_of_measure,
        metricName: kr.metricDefinition?.name,
        metricCategory: kr.metricDefinition?.category,
        isFinancial: kr.metricDefinition?.is_financial,
        departmentObjectives: (kr.employeeObjectives || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          score: d.final_score,
          value: d.final_value,
          status: d.status_code,
          departmentId: d.user?.employee?.employments[0]?.department_id,
        })),
      })),
    })),
  };
}

/**
 * At-Risk Summary — Items with AT_RISK or OFF_TRACK confidence.
 */
export async function getAtRiskSummary(companyId: number, cycleId: number) {
  const atRiskUpdates = await (prisma.progressUpdate.findMany as any)({
    where: {
      company_id: companyId,
      confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
      employeeKr: { employeeObjective: { cycle_id: cycleId } },
    },
    distinct: ["employee_kr_id"],
    orderBy: { created_at: "desc" },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            select: { user_id: true, title: true },
          },
        },
      },
    },
  });

  // EmployeeMonthPlan no longer has confidence_level; skip month-plan at-risk query.
  const atRiskMonthPlans: any[] = [];

  const atRiskWeeklyPlans = await prisma.weeklyPlan.findMany({
    where: {
      company_id: companyId,
      confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
      monthPlan: {
        employeeKr: { employeeObjective: { cycle_id: cycleId } },
      },
    },
    include: {
      monthPlan: {
        include: {
          employeeKr: {
            include: {
              employeeObjective: {
                select: { user_id: true, title: true },
              },
            },
          },
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const atRiskSubtasks = await prisma.subtask.findMany({
    where: {
      company_id: companyId,
      confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
      employeeKr: { employeeObjective: { cycle_id: cycleId } },
    },
    include: {
      employeeKr: {
        include: {
          employeeObjective: {
            select: { user_id: true, title: true },
          },
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const atRiskDailyPlans = await prisma.dailyPlan.findMany({
    where: {
      company_id: companyId,
      confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
      weeklyPlan: {
        monthPlan: {
          employeeKr: { employeeObjective: { cycle_id: cycleId } },
        },
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
                    select: { user_id: true, title: true },
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

  const items = [
    ...atRiskUpdates.map((u: any) => ({
      sourceType: "PROGRESS_UPDATE",
      sourceId: u.id,
      employeeKrId: u.employeeKr?.id,
      employeeKrTitle: u.employeeKr?.title,
      score: u.employeeKr?.final_score,
      target: u.employeeKr?.target_value,
      confidenceLevel: u.confidence_level,
      blockers: u.blockers,
      userId: u.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: u.employeeKr?.employeeObjective?.title,
      lastUpdated: u.created_at,
    })),
    ...atRiskMonthPlans.map((m: any) => ({
      sourceType: "MONTH_PLAN",
      sourceId: m.id,
      employeeKrId: null,
      employeeKrTitle: null,
      score: null,
      target: null,
      confidenceLevel: null,
      blockers: null,
      userId: null,
      objectiveTitle: null,
      lastUpdated: m.updated_at,
    })),
    ...atRiskWeeklyPlans.map((w: any) => ({
      sourceType: "WEEKLY_PLAN",
      sourceId: w.id,
      employeeKrId: w.monthPlan?.employeeKr?.id,
      employeeKrTitle: w.monthPlan?.employeeKr?.title,
      score: w.monthPlan?.employeeKr?.final_score,
      target: w.target_value,
      confidenceLevel: w.confidence_level,
      blockers: w.blockers,
      userId: w.monthPlan?.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: w.monthPlan?.employeeKr?.employeeObjective?.title,
      lastUpdated: w.updated_at,
    })),
    ...atRiskSubtasks.map((s) => ({
      sourceType: "SUBTASK",
      sourceId: s.id,
      employeeKrId: s.employeeKr?.id,
      employeeKrTitle: s.employeeKr?.title,
      score: s.employeeKr?.final_score,
      target: s.target_value,
      confidenceLevel: s.confidence_level,
      blockers: null,
      userId: s.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: s.employeeKr?.employeeObjective?.title,
      lastUpdated: s.updated_at,
    })),
    ...atRiskDailyPlans.map((m) => ({
      sourceType: "DAILY_PLAN",
      sourceId: m.id,
      employeeKrId: (m as any).weeklyPlan?.employeeKr?.id,
      employeeKrTitle: (m as any).weeklyPlan?.employeeKr?.title,
      score: (m as any).weeklyPlan?.employeeKr?.final_score,
      target: m.target_value,
      confidenceLevel: m.confidence_level,
      blockers: null,
      userId: (m as any).weeklyPlan?.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: (m as any).weeklyPlan?.employeeKr?.employeeObjective?.title,
      lastUpdated: m.updated_at,
    })),
  ].sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

  return {
    cycleId,
    companyId,
    totalAtRisk: items.length,
    items,
  };
}

/**
 * Generate score snapshot for the current point in time.
 */
export async function generateSnapshot(
  companyId: number,
  cycleId: number,
  actorId: string,
) {
  // NOTE: We intentionally do NOT call refreshFullRollup here — it runs inside
  // a heavy transaction that can timeout when called as a background job.
  // The snapshot captures whatever scores are currently in the DB.
  // Use the "Refresh Rollup" button first if you want up-to-date scores.

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch company objectives with their KR count in one query
  const companyObjectives = await prisma.companyObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    select: {
      final_score: true,
      _count: { select: { keyResults: true } },
    },
  });

  const companyScores = companyObjectives
    .filter((o) => o.final_score)
    .map((o) => o.final_score!);
  const companyAvg =
    companyScores.length > 0
      ? companyScores
          .reduce((s, v) => s.add(v), new Decimal(0))
          .div(companyScores.length)
      : new Decimal(0);

  const companySnapshot = await prisma.okrScoreSnapshot.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      entity_type: "COMPANY_OBJECTIVE",
      scope_level: "COMPANY",
      snapshot_date: today,
      score_value: companyAvg,
      total_objectives: companyObjectives.length,
      total_key_results: companyObjectives.reduce(
        (s, o) => s + o._count.keyResults,
        0,
      ),
    },
  });

  // Fetch all active department IDs for this company
  const deptRows = await prisma.employment.findMany({
    where: { company_id: companyId, is_active: true, department_id: { not: null } },
    select: { department_id: true },
    distinct: ["department_id"],
  });
  const deptIds = deptRows
    .map((r) => r.department_id)
    .filter((id): id is number => id !== null);

  // Fetch all employee objectives for this cycle in one query, grouped by dept
  const allDeptObjs = await prisma.employeeObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    select: {
      final_score: true,
      user: {
        select: {
          employee: {
            select: {
              employments: {
                where: { is_active: true, department_id: { in: deptIds } },
                select: { department_id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  // Group objectives by department
  const deptObjMap = new Map<number, { scores: Decimal[]; count: number }>();
  for (const obj of allDeptObjs) {
    const deptId = obj.user?.employee?.employments[0]?.department_id;
    if (!deptId) continue;
    if (!deptObjMap.has(deptId)) {
      deptObjMap.set(deptId, { scores: [], count: 0 });
    }
    const entry = deptObjMap.get(deptId)!;
    entry.count++;
    if (obj.final_score) entry.scores.push(obj.final_score);
  }

  // Build all department snapshot rows and insert in a single createMany
  const deptSnapshotData = deptIds
    .filter((deptId) => deptObjMap.has(deptId))
    .map((deptId) => {
      const entry = deptObjMap.get(deptId)!;
      const avg =
        entry.scores.length > 0
          ? entry.scores
              .reduce((s, v) => s.add(v), new Decimal(0))
              .div(entry.scores.length)
          : new Decimal(0);
      return {
        company_id: companyId,
        cycle_id: cycleId,
        entity_type: "EMPLOYEE_OBJECTIVE" as const,
        scope_level: "DEPARTMENT" as const,
        department_id: deptId,
        snapshot_date: today,
        score_value: avg,
        total_objectives: entry.count,
      };
    });

  if (deptSnapshotData.length > 0) {
    await prisma.okrScoreSnapshot.createMany({ data: deptSnapshotData });
  }

  // Ensure a QuarterArchive record exists so it shows up in Archive Management
  const cycle = await prisma.okrCycle.findUnique({ where: { id: cycleId } });
  let archive = await prisma.quarterArchive.findUnique({
    where: { company_id_cycle_id: { company_id: companyId, cycle_id: cycleId } },
  });

  if (!archive) {
    archive = await prisma.quarterArchive.create({
      data: {
        company_id: companyId,
        cycle_id: cycleId,
        quarter_name:
          cycle?.quarter_label || cycle?.name || `Quarter #${cycleId}`,
        status: "COMPLETED",
        archived_by: actorId,
      },
    });
  }

  await logActivity({
    companyId,
    entityType: "CYCLE",
    entityId: cycleId,
    actorId,
    action: "snapshot_generated",
    description: `Manually triggered OKR snapshot generated for cycle ${cycleId}`,
  });

  return { snapshot: companySnapshot, deptCount: deptSnapshotData.length, archiveId: archive.id };
}

/**
 * Manager Dashboard: View execution gaps for the entire reporting line.
 */
export async function getManagerExecutionDashboard(
  companyId: number,
  cycleId: number,
  managerId: string,
  options: { monthNumber?: number; weekNumber?: number },
) {
  const reportingIds = await getReportingTreeIds(companyId, managerId);
  if (reportingIds.length === 0) {
    return {
      summary: { total: 0, planned: 0, missing: 0, completionRate: 0 },
      laggards: [],
    };
  }

  // Fetch employees details
  const employees = await prisma.employee.findMany({
    where: { id: { in: reportingIds } },
    select: {
      id: true,
      full_name: true,
      employments: {
        where: { is_active: true },
        select: { jobTitle: { select: { title: true } } },
      },
    },
  });

  const employeeList = employees.map((e) => ({
    id: e.id,
    fullName: e.full_name,
    jobTitle: e.employments[0]?.jobTitle?.title || "N/A",
  }));

  const laggards: any[] = [];
  let plannedCount = 0;

  for (const emp of employeeList) {
    let hasPlan = false;

    if (options.weekNumber) {
      const weekPlan = await prisma.weeklyPlan.findFirst({
        where: {
          monthPlan: { cycle_id: cycleId },
          week_number: options.weekNumber,
          owner_id: emp.id,
        },
      });
      if (weekPlan) hasPlan = true;
    } else if (options.monthNumber) {
      const monthPlan = await prisma.employeeMonthPlan.findFirst({
        where: {
          cycle_id: cycleId,
          owner_id: emp.id,
          month_number: options.monthNumber,
        },
      });
      if (monthPlan) hasPlan = true;
    }

    if (hasPlan) {
      plannedCount++;
    } else {
      laggards.push({
        ...emp,
        reason: options.weekNumber
          ? `Missing Weekly Plan (Week ${options.weekNumber})`
          : `Missing Monthly Plan (Month ${options.monthNumber})`,
      });
    }
  }

  return {
    summary: {
      total: reportingIds.length,
      plannedCount,
      missingCount: laggards.length,
      completionRate: (plannedCount / reportingIds.length) * 100,
    },
    laggards,
  };
}

/**
 * Employee Overview Dashboard — Key insights for an individual employee.
 */
export async function getEmployeeOverview(
  userId: string,
  companyId: number,
  cycleId: number,
) {
  // 1. Quarterly Objectives & Progress
  const objectives = await prisma.employeeObjective.findMany({
    where: { user_id: userId, company_id: companyId, cycle_id: cycleId },
    include: {
      keyResults: {
        include: {
          progressUpdates: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: { confidence_level: true },
          },
        },
      },
    },
  });

  const totalObjectives = objectives.length;
  // EmployeeKeyResult has no progress_pct — use final_score on KRs if set,
  // otherwise fall back to the objective-level final_score.
  const allKRsForProgress = objectives.flatMap((o) => o.keyResults);
  const krsWithScore = allKRsForProgress.filter((kr) => kr.final_score != null);
  const avgProgress =
    krsWithScore.length > 0
      ? krsWithScore.reduce((sum, kr) => sum + Number(kr.final_score ?? 0), 0) /
        krsWithScore.length
      : totalObjectives > 0
        ? objectives.reduce((sum, o) => sum + Number(o.final_score ?? 0), 0) /
          totalObjectives
        : 0;

  // 2. Planning Compliance
  const monthlyPlans = await prisma.employeeMonthPlan.count({
    where: { owner_id: userId, cycle_id: cycleId },
  });

  const weeklyPlans = await prisma.weeklyPlan.count({
    where: {
      owner_id: userId,
      monthPlan: { cycle_id: cycleId },
    },
  });

  const dailyPlans = await prisma.dailyPlan.count({
    where: {
      owner_id: userId,
      weeklyPlan: { monthPlan: { cycle_id: cycleId } },
    },
  });

  // 3. Recent Feedback (Top 5)
  const objectiveIds = objectives.map((o) => o.id);
  const krIds = objectives.flatMap((o) => o.keyResults.map((kr) => kr.id));

  const recentComments = await prisma.okrComment.findMany({
    where: {
      company_id: companyId,
      OR: [
        { entity_type: "EMPLOYEE_OBJECTIVE", entity_id: { in: objectiveIds } },
        { entity_type: "EMPLOYEE_KR", entity_id: { in: krIds } },
      ],
    },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  // 2. Resolve Authors (Robust resolution for both Employee ID and User ID)
  const authorIds = [...new Set(recentComments.map((c) => c.author_id))];
  
  // Fetch directly from Employee table for those that are Employee IDs
  const directEmployees = await prisma.employee.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, full_name: true, profile_picture_url: true },
  });

  // For others, they might be User IDs. Fetch from AppUser and include Employee
  const foundDirectIds = new Set(directEmployees.map(e => e.id));
  const potentialUserIds = authorIds
    .filter(id => !foundDirectIds.has(id))
    .map(id => parseInt(id))
    .filter(id => !isNaN(id));

  const appUsers = potentialUserIds.length > 0 
    ? await prisma.appUser.findMany({
        where: { id: { in: potentialUserIds } },
        include: { employee: { select: { full_name: true, profile_picture_url: true } } }
      })
    : [];

  const authorMap: Record<string, { full_name: string; profile_picture_url?: string | null }> = {};
  
  directEmployees.forEach(e => {
    authorMap[e.id] = { full_name: e.full_name, profile_picture_url: e.profile_picture_url };
  });
  
  appUsers.forEach(u => {
    authorMap[u.id.toString()] = { 
      full_name: u.employee?.full_name || u.email || "System", 
      profile_picture_url: u.employee?.profile_picture_url 
    };
  });

  // Build quick lookup maps so each comment can resolve its entity title
  const objectiveMap: Record<number, string> = {};
  objectives.forEach((o) => { objectiveMap[o.id] = o.title; });
  const krMap: Record<number, { title: string; objectiveTitle: string }> = {};
  objectives.forEach((o) =>
    o.keyResults.forEach((kr) => {
      krMap[kr.id] = { title: kr.title, objectiveTitle: o.title };
    }),
  );

  const formattedComments = recentComments.map((c) => {
    const author = authorMap[c.author_id];
    let entityTitle: string | null = null;
    let parentTitle: string | null = null;
    if (c.entity_type === "EMPLOYEE_KR") {
      entityTitle = krMap[c.entity_id]?.title ?? null;
      parentTitle = krMap[c.entity_id]?.objectiveTitle ?? null;
    } else if (c.entity_type === "EMPLOYEE_OBJECTIVE") {
      entityTitle = objectiveMap[c.entity_id] ?? null;
    }
    return {
      id: c.id,
      comment: c.content,
      createdAt: c.created_at,
      entityType: c.entity_type,
      entityTitle,
      parentTitle,
      reviewerName: author?.full_name || "System",
      reviewerAvatar: author?.profile_picture_url,
    };
  });

  // 4. KR Confidence Distribution
  const allKRs = objectives.flatMap((o) => o.keyResults);
  const confidenceSignals = allKRs.map((kr) => {
    const latestUpdate = kr.progressUpdates[0];
    return latestUpdate?.confidence_level || null;
  });

  const confidenceStats = {
    on_track: confidenceSignals.filter((s) => s === "ON_TRACK").length,
    at_risk: confidenceSignals.filter((s) => s === "AT_RISK").length,
    off_track: confidenceSignals.filter((s) => s === "OFF_TRACK").length,
    not_reported: confidenceSignals.filter((s) => !s).length,
  };

  // 5. Adoption Stats
  // chosen_parent_kr_id or chosen_parent_employee_kr_id being set means cascaded from a company/dept KR.
  // Every EmployeeObjective has kr_contributor_id (non-nullable), so that field cannot be used.
  const adoptedObjectivesCount = objectives.filter(
    (o) => o.chosen_parent_kr_id != null || o.chosen_parent_employee_kr_id != null,
  ).length;
  const personalObjectivesCount = totalObjectives - adoptedObjectivesCount;

  return {
    cycleId,
    summary: {
      avgProgress: Number(avgProgress.toFixed(2)),
      totalObjectives,
      totalKRs: allKRs.length,
      planningCompliance: {
        monthlyPlans,
        weeklyPlans,
        dailyPlans,
      },
    },
    confidenceStats,
    recentComments: formattedComments,
    adoption: {
      adopted: adoptedObjectivesCount,
      personal: personalObjectivesCount,
    },
  };
}
