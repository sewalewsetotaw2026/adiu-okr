import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import {
  refreshFullRollup,
  getFinancialBreakdown,
  getCompletionStatus,
} from "src/services/okrRollupService";

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
    .map((o) => {
      const tgt = o.target_value ? Number(o.target_value) : 0;
      const cur = o.current_value ? Number(o.current_value) : 0;
      return tgt > 0 ? (cur / tgt) * 100 : 0;
    });
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
    (sum, o) => sum.add(o.current_value ?? new Decimal(0)),
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
    },
  });

  const latestSignals = employeeKrs.map((kr) => {
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
      score: (() => {
        const tgt = o.target_value ? Number(o.target_value) : 0;
        const cur = o.current_value ? Number(o.current_value) : 0;
        return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
      })(),
      value: o.current_value,
      target_value: o.target_value,
      indirectScore: (o as any).indirect_score,
      indirectValue: (o as any).indirect_value,
      status: o.status_code,
      krCount: o.keyResults.length,
      departmentCount: o.keyResults.reduce(
        (s, kr) => s + kr._count.employeeObjectives,
        0,
      ),
    })),
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
      target_value: true,
      current_value: true,
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
          current_value: true,
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
      .map((o: any) => {
        const tgt = o.target_value ? Number(o.target_value) : 0;
        const cur = o.current_value ? Number(o.current_value) : 0;
        return tgt > 0 ? (cur / tgt) * 100 : 0;
      });
    const avgScore =
      progressValues.length > 0
        ? new Decimal(
            progressValues.reduce((sum: number, v: number) => sum + v, 0) / progressValues.length,
          ).toDecimalPlaces(2)
        : new Decimal(0);
    const totalValue = allKRs.reduce(
      (sum: Decimal, kr: any) =>
        sum.add(kr.current_value ? new Decimal(kr.current_value) : new Decimal(0)),
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
      value: obj.current_value,
      indirectScore: (obj as any).indirect_score,
      indirectValue: (obj as any).indirect_value,
      status: obj.status_code,
      keyResults: obj.keyResults.map((kr: any) => ({
        id: kr.id,
        title: kr.title,
        score: kr.final_score,
        value: kr.current_value,
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
          value: d.current_value,
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
      weeklyTask: { weeklyPlan: { employeeKr: { employeeObjective: { cycle_id: cycleId } } } },
    },
    include: {
      weeklyTask: {
        include: {
          weeklyPlan: {
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
    ...atRiskWeeklyPlans.map((w) => ({
      sourceType: "WEEKLY_PLAN",
      sourceId: w.id,
      employeeKrId: w.employeeKr?.id,
      employeeKrTitle: w.employeeKr?.title,
      score: w.employeeKr?.final_score,
      target: w.target_value,
      confidenceLevel: w.confidence_level,
      blockers: w.blockers,
      userId: w.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: w.employeeKr?.employeeObjective?.title,
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
      employeeKrId: m.weeklyTask?.weeklyPlan?.employeeKr?.id,
      employeeKrTitle: m.weeklyTask?.weeklyPlan?.employeeKr?.title,
      score: m.weeklyTask?.weeklyPlan?.employeeKr?.final_score,
      target: m.target_value,
      confidenceLevel: m.confidence_level,
      blockers: null,
      userId: m.weeklyTask?.weeklyPlan?.employeeKr?.employeeObjective?.user_id,
      objectiveTitle: m.weeklyTask?.weeklyPlan?.employeeKr?.employeeObjective?.title,
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
  await refreshFullRollup(companyId, cycleId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const companyObjectives = await prisma.companyObjective.findMany({
    where: { company_id: companyId, cycle_id: cycleId },
    include: { keyResults: true },
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

  await prisma.okrScoreSnapshot.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      entity_type: "COMPANY_OBJECTIVE",
      scope_level: "COMPANY",
      snapshot_date: today,
      score_value: companyAvg,
      total_objectives: companyObjectives.length,
      total_key_results: companyObjectives.reduce(
        (s, o) => s + o.keyResults.length,
        0,
      ),
    },
  });

  const departments = await prisma.employment.findMany({
    where: { company_id: companyId, is_active: true },
    select: { department_id: true },
    distinct: ["department_id"],
  });

  for (const dept of departments) {
    const deptObjs = await prisma.employeeObjective.findMany({
      where: {
        company_id: companyId,
        cycle_id: cycleId,
        user: {
          employee: {
            employments: { some: { department_id: dept.department_id, is_active: true } }
          }
        }
      },
    });
    const deptScores = deptObjs
      .filter((o) => o.final_score)
      .map((o) => o.final_score!);
    const deptAvg =
      deptScores.length > 0
        ? deptScores
            .reduce((s, v) => s.add(v), new Decimal(0))
            .div(deptScores.length)
        : new Decimal(0);

    await prisma.okrScoreSnapshot.create({
      data: {
        company_id: companyId,
        cycle_id: cycleId,
        entity_type: "EMPLOYEE_OBJECTIVE",
        scope_level: "DEPARTMENT",
        department_id: dept.department_id,
        snapshot_date: today,
        score_value: deptAvg,
        total_objectives: deptObjs.length,
      },
    });
  }

  return {
    snapshotDate: today,
    companyAvgScore: companyAvg,
    departmentsSnapshotted: departments.length,
  };
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
          employeeKr: { employeeObjective: { cycle_id: cycleId } },
          week_number: options.weekNumber,
          created_by: emp.id,
        },
      });
      if (weekPlan) hasPlan = true;
    } else if (options.monthNumber) {
      const monthPlan = await prisma.employeeMonthPlan.findFirst({
        where: {
          employeeObjective: { cycle_id: cycleId },
          created_by: emp.id,
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
