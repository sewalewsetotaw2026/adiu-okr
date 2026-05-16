import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import { logActivity } from "src/services/okrActivityLogService";
import { refreshFullRollup } from "src/services/okrRollupService";
import { generateSnapshot } from "src/services/okrDashboardService";
import { exportData, type ExportField } from "src/services/exportService";
import fs from "fs";
import path from "path";

// =============================================================================
// OKR ARCHIVE SERVICE — Quarter Close, Archive, Reports, Insights, Exports
// =============================================================================

/**
 * Close Cycle — Sets cycle to CLOSED, persists final scores.
 */
export async function closeCycle(cycleId: number, companyId: number, actorId: string) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id: cycleId, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
    return cycle;
  }
  if (cycle.status !== "OPEN") throw new Error("Only OPEN cycles can be closed.");

  // Soft-close all lingering uncompleted items directly into an "incomplete" or "failed" status
  // to ensure quarter hygiene before locking.
  await prisma.companyObjective.updateMany({
    where: { company_id: companyId, cycle_id: cycleId, status_code: { notIn: ["completed", "done", "published"] } },
    data: { status_code: "closed" }
  });
  await prisma.employeeObjective.updateMany({
    where: { company_id: companyId, cycle_id: cycleId, status_code: { notIn: ["completed", "done", "published"] } },
    data: { status_code: "closed" }
  });

  // Generate final rollup before closing
  await refreshFullRollup(companyId, cycleId);

  // Generate final snapshot
  await generateSnapshot(companyId, cycleId, actorId);

  // Close the cycle
  const updated = await prisma.okrCycle.update({
    where: { id: cycleId },
    data: {
      status: "CLOSED",
      closed_by: actorId,
      closed_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "CYCLE",
    entityId: cycleId,
    actorId,
    action: "cycle_closed",
    description: `Cycle "${cycle.name}" closed with final rollup computed`,
  });

  return updated;
}

/**
 * Archive Quarter — Creates QuarterArchive, marks entities as archived.
 */
export async function archiveQuarter(companyId: number, cycleId: number, actorId: string) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id: cycleId, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status !== "CLOSED" && cycle.status !== "ARCHIVED") {
    throw new Error("Only CLOSED cycles can be archived. Close the cycle first.");
  }

  // Check if already archived
  const existing = await prisma.quarterArchive.findUnique({
    where: { company_id_cycle_id: { company_id: companyId, cycle_id: cycleId } },
  });
  if (existing || cycle.status === "ARCHIVED") {
    return existing;
  }

  // Create the archive record
  const archive = await prisma.quarterArchive.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      quarter_name: cycle.quarter_label || cycle.name,
      status: "PENDING",
      archived_by: actorId,
    },
  });

  // Mark all company objectives as archived
  await prisma.companyObjective.updateMany({
    where: { company_id: companyId, cycle_id: cycleId },
    data: { is_archived: true, archived_at: new Date() },
  });

  // Mark all employee objectives as archived
  await prisma.employeeObjective.updateMany({
    where: { company_id: companyId, cycle_id: cycleId },
    data: { is_archived: true, archived_at: new Date() },
  });

  // Mark all employee objectives as archived
  await prisma.employeeObjective.updateMany({
    where: { company_id: companyId, cycle_id: cycleId },
    data: { is_archived: true, archived_at: new Date() },
  });

  // Update cycle status to ARCHIVED
  await prisma.okrCycle.update({
    where: { id: cycleId },
    data: { status: "ARCHIVED" },
  });

  // Update archive status to COMPLETED
  await prisma.quarterArchive.update({
    where: { id: archive.id },
    data: { status: "COMPLETED" },
  });

  await logActivity({
    companyId,
    entityType: "CYCLE",
    entityId: cycleId,
    actorId,
    action: "quarter_archived",
    description: `Quarter "${cycle.quarter_label || cycle.name}" archived successfully`,
  });

  return archive;
}

/**
 * List Archives for a company.
 * Each archive is enriched with the most-recent COMPANY-scope snapshot so the
 * frontend can show score / completion / totals without a second round-trip.
 */
export async function listArchives(companyId: number) {
  const archives = await prisma.quarterArchive.findMany({
    where: { company_id: companyId },
    include: {
      cycle: { select: { name: true, quarter_label: true, start_date: true, end_date: true } },
      _count: { select: { reports: true, insights: true, exportJobs: true } },
    },
    orderBy: { archived_at: "desc" },
  });

  if (archives.length === 0) return archives;

  // Fetch one snapshot per cycle in a single query (latest COMPANY scope)
  const cycleIds = [...new Set(archives.map((a) => a.cycle_id))];
  const snapshots = await prisma.okrScoreSnapshot.findMany({
    where: {
      company_id: companyId,
      cycle_id: { in: cycleIds },
      scope_level: "COMPANY",
    },
    orderBy: { snapshot_date: "asc" },
  });

  // Build a map: cycle_id → latest snapshot
  const latestBycycle = new Map<number, (typeof snapshots)[number]>();
  for (const s of snapshots) {
    latestBycycle.set(s.cycle_id, s); // later rows (asc order) overwrite → last = latest
  }

  // For cycles that have no snapshot (or snapshot has zero counts/score), fetch
  // live counts directly from the objective tables in one batched query.
  const cyclesNeedingLive = cycleIds.filter((cid) => {
    const snap = latestBycycle.get(cid);
    return !snap || (snap.total_objectives === 0 && snap.total_key_results === 0);
  });

  // Live counts: group company objectives by cycle_id
  const liveObjRows = cyclesNeedingLive.length > 0
    ? await prisma.companyObjective.findMany({
        where: { company_id: companyId, cycle_id: { in: cyclesNeedingLive } },
        select: { cycle_id: true, final_score: true, status_code: true },
      })
    : [];

  const liveKRRows = cyclesNeedingLive.length > 0
    ? await prisma.companyKeyResult.findMany({
        where: {
          company_id: companyId,
          objective: { cycle_id: { in: cyclesNeedingLive } },
        },
        select: { objective: { select: { cycle_id: true } } },
      })
    : [];

  // Per cycle aggregates from live data
  const liveCountsByCycle = new Map<number, {
    objCount: number; krCount: number; avgScore: number | null; completionRate: number | null;
  }>();

  const COMPLETED = ["completed", "done", "published", "closed"];
  for (const cid of cyclesNeedingLive) {
    const objs = liveObjRows.filter((o) => o.cycle_id === cid);
    const krs = liveKRRows.filter((k) => k.objective.cycle_id === cid);
    const avgScore = objs.length > 0
      ? objs.reduce((s, o) => s + Number(o.final_score ?? 0), 0) / objs.length
      : null;
    const completedCount = objs.filter((o) =>
      COMPLETED.includes(String(o.status_code ?? "").toLowerCase()),
    ).length;
    const completionRate = objs.length > 0 ? (completedCount / objs.length) * 100 : null;
    liveCountsByCycle.set(cid, {
      objCount: objs.length,
      krCount: krs.length,
      avgScore,
      completionRate,
    });
  }

  return archives.map((a) => {
    const snap = latestBycycle.get(a.cycle_id) ?? null;
    const live = liveCountsByCycle.get(a.cycle_id);

    const snapHasCounts = snap && (snap.total_objectives ?? 0) > 0;
    const snapHasScore = snap && Number(snap.score_value ?? 0) > 0;

    return {
      ...a,
      score: snapHasScore
        ? Number(snap!.score_value)
        : (live?.avgScore ?? (snap ? Number(snap.score_value ?? 0) : null)),
      completion_rate: snap
        ? Number(snap.completion_rate ?? 0)
        : (live?.completionRate ?? null),
      total_objectives: snapHasCounts
        ? snap!.total_objectives
        : (live?.objCount ?? null),
      total_key_results: snapHasCounts
        ? snap!.total_key_results
        : (live?.krCount ?? null),
      snapshot_date: snap ? snap.snapshot_date : null,
    };
  });
}

/**
 * Get Archive Detail with reports, insights, exports.
 */
export async function getArchiveDetail(archiveId: number, companyId: number) {
  const archive = await prisma.quarterArchive.findFirst({
    where: { id: archiveId, company_id: companyId },
    include: {
      cycle: {
        select: { name: true, quarter_label: true, start_date: true, end_date: true, status: true },
      },
      reports: { orderBy: { generated_at: "desc" } },
      insights: { orderBy: { generated_at: "desc" } },
      exportJobs: {
        include: { files: true },
        orderBy: { created_at: "desc" },
      },
    },
  });
  if (!archive) throw new Error("Archive not found.");

  // Fetch archived OKR summary from score snapshots — ordered ASC so the
  // last element is the most recent (frontend reads snapshots[length - 1]).
  const snapshots = await prisma.okrScoreSnapshot.findMany({
    where: {
      company_id: companyId,
      cycle_id: archive.cycle_id,
      scope_level: "COMPANY",
    },
    orderBy: { snapshot_date: "asc" },
  });

  // Live objective + KR counts from the actual data tables (more reliable than
  // snapshot counters which may have been written before data existed).
  const [liveObjCount, liveKRCount] = await Promise.all([
    prisma.companyObjective.count({
      where: { company_id: companyId, cycle_id: archive.cycle_id },
    }),
    prisma.companyKeyResult.count({
      where: {
        company_id: companyId,
        objective: { cycle_id: archive.cycle_id },
      },
    }),
  ]);

  // If no company objectives exist, fall back to employee objectives count.
  const liveEmpObjCount =
    liveObjCount === 0
      ? await prisma.employeeObjective.count({
          where: { company_id: companyId, cycle_id: archive.cycle_id },
        })
      : 0;

  const liveEmpKRCount =
    liveKRCount === 0
      ? await prisma.employeeKeyResult.count({
          where: {
            company_id: companyId,
            employeeObjective: { cycle_id: archive.cycle_id },
          },
        })
      : 0;

  // Live aggregate score: average of final_score across all company objectives
  // that have a score — used as fallback when snapshot score_value is 0 / null.
  const latestSnap = snapshots[snapshots.length - 1] ?? null;
  let liveScore: number | null = null;
  let liveCompletion: number | null = null;

  const hasSnapshotScore =
    latestSnap?.score_value != null && Number(latestSnap.score_value) > 0;

  let liveValueUnlocked: number | null = null;

  if (!hasSnapshotScore) {
    const allObjs = await prisma.companyObjective.findMany({
      where: { company_id: companyId, cycle_id: archive.cycle_id },
      select: { final_score: true, final_value: true, status_code: true },
    });
    if (allObjs.length > 0) {
      const total = allObjs.reduce(
        (s, o) => s + Number(o.final_score ?? 0),
        0,
      );
      liveScore = total / allObjs.length;

      const COMPLETED = ["completed", "done", "published", "closed"];
      const completedCount = allObjs.filter((o) =>
        COMPLETED.includes(String(o.status_code ?? "").toLowerCase()),
      ).length;
      liveCompletion = (completedCount / allObjs.length) * 100;
      liveValueUnlocked = allObjs.reduce(
        (s, o) => s + Number(o.final_value ?? 0),
        0,
      );
    }
  } else {
    // Even when snapshot score exists, still compute value from objectives
    const valuedObjs = await prisma.companyObjective.findMany({
      where: { company_id: companyId, cycle_id: archive.cycle_id },
      select: { final_value: true },
    });
    liveValueUnlocked = valuedObjs.reduce(
      (s, o) => s + Number(o.final_value ?? 0),
      0,
    );
  }

  // Also add employee objective values
  const empValuedObjs = await prisma.employeeObjective.findMany({
    where: { company_id: companyId, cycle_id: archive.cycle_id },
    select: { final_value: true },
  });
  const empValueSum = empValuedObjs.reduce(
    (s, o) => s + Number(o.final_value ?? 0),
    0,
  );
  liveValueUnlocked = (liveValueUnlocked ?? 0) + empValueSum;

  return {
    ...archive,
    snapshots,
    live_objectives_count: liveObjCount + liveEmpObjCount,
    live_key_results_count: liveKRCount + liveEmpKRCount,
    live_score: liveScore,
    live_completion_rate: liveCompletion,
    live_value_unlocked: liveValueUnlocked,
  };
}

/**
 * Generate Archive Report.
 */
export async function generateArchiveReport(
  archiveId: number,
  companyId: number,
  reportType: string,
  actorId: string
) {
  const archive = await prisma.quarterArchive.findFirst({
    where: { id: archiveId, company_id: companyId },
    include: { cycle: true },
  });
  if (!archive) throw new Error("Archive not found.");

  // Build report payload based on type
  let payload: any = {};
  const cycleId = archive.cycle_id;

  if (reportType === "company_summary") {
    const objectives = await prisma.companyObjective.findMany({
      where: { company_id: companyId, cycle_id: cycleId },
      include: { keyResults: true },
    });
    payload = {
      totalObjectives: objectives.length,
      totalKRs: objectives.reduce((s, o) => s + o.keyResults.length, 0),
      avgScore: objectives.filter(o => o.final_score).length > 0
        ? objectives.reduce((s, o) => s.add(o.final_score ?? new Decimal(0)), new Decimal(0)).div(objectives.length)
        : 0,
      objectives: objectives.map(o => ({ id: o.id, title: o.title, score: o.final_score, value: o.final_value })),
    };
  } else if (reportType === "department_performance") {
    const deptObjs = await prisma.employeeObjective.findMany({
      where: { company_id: companyId, cycle_id: cycleId },
      include: { 
        user: { 
          include: { 
            employee: { 
              include: { 
                employments: { where: { is_active: true }, include: { department: true } } 
              } 
            } 
          } 
        } 
      },
    });
    payload = {
      departments: deptObjs.map((d: any) => ({
        departmentName: d.user?.employee?.employments[0]?.department?.name ?? "Unknown",
        title: d.title, score: d.final_score, value: d.final_value,
      })),
    };
  } else if (reportType === "contributor_performance") {
    const contributors = await prisma.krContributor.findMany({
      where: {
        company_id: companyId,
        employeeKr: { employeeObjective: { cycle_id: cycleId } },
      },
      include: {
        employeeObjectives: { select: { title: true, final_score: true, final_value: true } },
      },
    });
    payload = {
      totalContributors: contributors.length,
      contributors: contributors.map(c => {
        const obj = c.employeeObjectives;
        return {
          userId: c.user_id,
          role: c.role_type,
          objectives: obj ? [{ title: obj.title, score: obj.final_score, value: obj.final_value }] : [],
        };
      }),
    };
  } else if (reportType === "blocker_summary") {
    // Collect blockers from WeeklyPlans within this cycle
    const weeklyBlockers = await prisma.weeklyPlan.findMany({
      where: {
        company_id: companyId,
        blockers: { not: null },
        monthPlan: { employeeKr: { employeeObjective: { cycle_id: cycleId } } },
      },
      select: {
        id: true,
        owner_id: true,
        week_number: true,
        blockers: true,
        monthPlan: {
          select: {
            employeeKr: {
              select: {
                title: true,
                employeeObjective: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    // Collect blockers from ProgressUpdates within this cycle
    const progressBlockers = await prisma.progressUpdate.findMany({
      where: {
        company_id: companyId,
        blockers: { not: null },
        employeeKr: { employeeObjective: { cycle_id: cycleId } },
      },
      select: {
        id: true,
        updated_by: true,
        week_number: true,
        month_number: true,
        blockers: true,
        employeeKr: {
          select: {
            title: true,
            employeeObjective: { select: { title: true } },
          },
        },
      },
    });

    payload = {
      totalBlockers: weeklyBlockers.length + progressBlockers.length,
      weeklyPlanBlockers: weeklyBlockers.map(w => ({
        planId: w.id,
        ownerId: w.owner_id,
        weekNumber: w.week_number,
        blocker: w.blockers,
        krTitle: w.monthPlan?.employeeKr?.title ?? null,
        objectiveTitle: w.monthPlan?.employeeKr?.employeeObjective?.title ?? null,
      })),
      progressUpdateBlockers: progressBlockers.map(p => ({
        updateId: p.id,
        reportedBy: p.updated_by,
        weekNumber: p.week_number,
        monthNumber: p.month_number,
        blocker: p.blockers,
        krTitle: p.employeeKr?.title ?? null,
        objectiveTitle: p.employeeKr?.employeeObjective?.title ?? null,
      })),
    };
  }

  const report = await prisma.archiveReport.create({
    data: {
      company_id: companyId,
      quarter_archive_id: archiveId,
      report_type: reportType,
      report_name: `${reportType} — ${archive.quarter_name}`,
      report_payload_json: payload,
      generated_by: actorId,
    },
  });

  // Update archive flag
  await prisma.quarterArchive.update({
    where: { id: archiveId },
    data: { report_pack_generated: true },
  });

  return report;
}

/**
 * Generate Archive Insight.
 */
export async function generateArchiveInsight(
  archiveId: number,
  companyId: number,
  insightType: string,
  actorId: string
) {
  const archive = await prisma.quarterArchive.findFirst({
    where: { id: archiveId, company_id: companyId },
    include: { cycle: true }
  });
  if (!archive) throw new Error("Archive not found.");

  const cycleId = archive.cycle_id;
  let payload: any = {};

  if (insightType === "top_performers") {
    const empObjs = await prisma.employeeObjective.findMany({
      where: { company_id: companyId, cycle_id: cycleId },
      include: {
        user: {
          include: {
            employee: {
              include: {
                employments: {
                  where: { is_active: true },
                  include: { department: true, jobTitle: true },
                  take: 1
                }
              }
            }
          }
        },
        keyResults: {
          include: { metricDefinition: true }
        }
      }
    });

    // Group by User
    const userMap = new Map<string, any>();
    for (const obj of empObjs) {
      if (!userMap.has(obj.user_id)) {
        const emp = obj.user?.employee;
        const employment = emp?.employments?.[0];
        userMap.set(obj.user_id, {
          user_id: obj.user_id,
          name: emp?.full_name ?? "Unknown",
          avatar: emp?.profile_picture_url,
          department: employment?.department?.name ?? "N/A",
          jobTitle: employment?.jobTitle?.title ?? "Employee",
          totalScore: 0,
          totalValue: 0,
          objectives: []
        });
      }
      const userData = userMap.get(obj.user_id);
      const isFinancial = (obj as any).keyResults.some((kr: any) => kr.metricDefinition?.is_financial);
      userData.objectives.push({
        id: obj.id,
        title: obj.title,
        score: Number(obj.final_score ?? 0),
        value: Number(obj.final_value ?? 0),
        isFinancial,
        krs: (obj as any).keyResults.map((kr: any) => ({
          id: kr.id,
          title: kr.title,
          score: Number(kr.final_score ?? 0),
          value: Number(kr.final_value ?? 0),
          isFinancial: kr.metricDefinition?.is_financial ?? false,
          metric: kr.metricDefinition?.name ?? "N/A"
        }))
      });
      userData.totalScore += Number(obj.final_score ?? 0);
      userData.totalValue += Number(obj.final_value ?? 0);
    }

    const performers = Array.from(userMap.values()).map(u => ({
      ...u,
      avgScore: u.objectives.length > 0 ? u.totalScore / u.objectives.length : 0,
    })).sort((a, b) => b.avgScore - a.avgScore);

    payload = { performers, aggregation_level: "individual" };
  } else if (insightType === "top_performers_team") {
    // Group by Manager (who has direct reports)
    const allObjectives = await prisma.employeeObjective.findMany({
      where: { company_id: companyId, cycle_id: cycleId },
      include: {
        user: {
          include: {
            employee: {
              include: {
                employments: {
                  where: { is_active: true },
                  include: {
                    manager: {
                      include: {
                        employments: {
                          where: { is_active: true },
                          include: { jobTitle: true, department: true },
                          take: 1
                        }
                      }
                    }
                  },
                  take: 1
                }
              }
            }
          }
        },
        keyResults: {
          include: { metricDefinition: true }
        }
      }
    });

    const teamsMap = new Map<string, any>();
    for (const obj of allObjectives) {
      const employment = (obj as any).user?.employee?.employments?.[0];
      const manager = employment?.manager;
      if (!manager) continue;
      
      const managerId = manager.id;
      if (!teamsMap.has(managerId)) {
        const mEmployment = manager.employments?.[0];
        teamsMap.set(managerId, {
          id: managerId,
          user_id: managerId,
          name: manager.full_name ?? "Unknown Manager",
          avatar: manager.profile_picture_url,
          jobTitle: mEmployment?.jobTitle?.title ?? "Team Leader",
          department: mEmployment?.department?.name ?? "N/A",
          totalScore: 0,
          totalValue: 0,
          hasFinancial: false,
          memberCount: new Set(),
          objectives: []
        });
      }
      const teamData = teamsMap.get(managerId);
      const isFinancial = (obj as any).keyResults.some((kr: any) => kr.metricDefinition?.is_financial);
      
      teamData.objectives.push({
        id: obj.id,
        title: `${(obj as any).user?.employee?.full_name}: ${obj.title}`,
        score: Number(obj.final_score ?? 0),
        value: Number(obj.final_value ?? 0),
        isFinancial,
        krs: (obj as any).keyResults.map((kr: any) => ({
          id: kr.id,
          title: kr.title,
          score: Number(kr.final_score ?? 0),
          value: Number(kr.final_value ?? 0),
          isFinancial: kr.metricDefinition?.is_financial ?? false,
          metric: kr.metricDefinition?.name ?? "N/A"
        }))
      });

      teamData.totalScore += Number(obj.final_score ?? 0);
      teamData.totalValue += Number(obj.final_value ?? 0);
      teamData.memberCount.add(obj.user_id);
      if (isFinancial) teamData.hasFinancial = true;
    }

    const performers = Array.from(teamsMap.values()).map(t => ({
      ...t,
      avgScore: t.objectives.length > 0 ? t.totalScore / t.objectives.length : 0,
      memberCount: t.memberCount.size,
    })).sort((a, b) => b.avgScore - a.avgScore);

    payload = { performers, aggregation_level: "team" };
  } else if (insightType === "top_performers_department") {
    const allObjectives = await prisma.employeeObjective.findMany({
      where: { company_id: companyId, cycle_id: cycleId },
      include: {
        user: {
          include: {
            employee: {
              include: {
                employments: { where: { is_active: true }, include: { department: true }, take: 1 }
              }
            }
          }
        },
        keyResults: {
          include: { metricDefinition: true }
        }
      }
    });

    const deptMap = new Map<number, any>();
    for (const obj of allObjectives) {
      const employment = (obj as any).user?.employee?.employments?.[0];
      if (!employment?.department) continue;
      
      const deptId = employment.department.id;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          id: deptId,
          name: employment.department.name,
          totalScore: 0,
          totalValue: 0,
          memberCount: new Set(),
          objectives: []
        });
      }
      const deptData = deptMap.get(deptId);
      const isFinancial = (obj as any).keyResults.some((kr: any) => kr.metricDefinition?.is_financial);

      deptData.objectives.push({
        id: obj.id,
        title: `${(obj as any).user?.employee?.full_name}: ${obj.title}`,
        score: Number(obj.final_score ?? 0),
        value: Number(obj.final_value ?? 0),
        isFinancial,
        krs: (obj as any).keyResults.map((kr: any) => ({
          id: kr.id,
          title: kr.title,
          score: Number(kr.final_score ?? 0),
          value: Number(kr.final_value ?? 0),
          isFinancial: kr.metricDefinition?.is_financial ?? false,
          metric: kr.metricDefinition?.name ?? "N/A"
        }))
      });

      deptData.totalScore += Number(obj.final_score ?? 0);
      deptData.totalValue += Number(obj.final_value ?? 0);
      deptData.memberCount.add(obj.user_id);
    }

    const performers = Array.from(deptMap.values()).map(d => ({
      user_id: `DEPT-${d.id}`,
      name: d.name,
      department: "Department",
      jobTitle: `${d.memberCount.size} Members`,
      avgScore: d.objectives.length > 0 ? d.totalScore / d.objectives.length : 0,
      totalValue: d.totalValue,
      memberCount: d.memberCount.size,
      objectives: d.objectives
    })).sort((a, b) => b.avgScore - a.avgScore);

    payload = { performers, aggregation_level: "department" };
  } else if (insightType === "bottlenecks") {
    const lowScoreKRs = await prisma.employeeKeyResult.findMany({
      where: {
        company_id: companyId,
        employeeObjective: { cycle_id: cycleId },
        final_score: { lt: 50 },
      },
      include: {
        employeeObjective: {
          include: {
            user: { include: { employee: true } }
          }
        }
      },
      take: 15,
      orderBy: { final_score: "asc" },
    });
    payload = { 
      bottlenecks: lowScoreKRs.map(kr => ({
        id: kr.id,
        title: kr.title,
        final_score: Number(kr.final_score ?? 0),
        owner: kr.employeeObjective?.user?.employee?.full_name ?? "Unknown",
        objective: kr.employeeObjective?.title
      }))
    };
  } else if (insightType === "completion_rate") {
    const allKRs = await prisma.employeeKeyResult.count({
      where: { company_id: companyId, employeeObjective: { cycle_id: cycleId } },
    });
    const completedKRs = await prisma.employeeKeyResult.count({
      where: {
        company_id: companyId,
        employeeObjective: { cycle_id: cycleId },
        final_score: { gte: 100 },
      },
    });
    const partialKRs = await prisma.employeeKeyResult.count({
      where: {
        company_id: companyId,
        employeeObjective: { cycle_id: cycleId },
        final_score: { gte: 70, lt: 100 },
      },
    });
    payload = { 
      totalKRs: allKRs, 
      completedKRs, 
      partialKRs,
      completionRate: allKRs > 0 ? (completedKRs / allKRs) * 100 : 0,
      successRate: allKRs > 0 ? ((completedKRs + partialKRs) / allKRs) * 100 : 0
    };
  } else if (insightType === "blocker_summaries") {
    const blockers = await prisma.progressUpdate.findMany({
      where: {
        company_id: companyId,
        confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
        blockers: { not: null },
        employeeKr: { employeeObjective: { cycle_id: cycleId } }
      },
      include: {
        employeeKr: {
          include: {
            employeeObjective: {
              include: { user: { include: { employee: true } } }
            }
          }
        }
      },
      take: 20,
      orderBy: { created_at: "desc" },
    });
    payload = { 
      blockedCount: blockers.length, 
      recentBlockers: blockers.map(b => ({
        blockers: b.blockers,
        confidence_level: b.confidence_level,
        created_at: b.created_at,
        owner: b.employeeKr?.employeeObjective?.user?.employee?.full_name ?? "Unknown",
        kr_title: b.employeeKr?.title
      })) 
    };
  } else if (insightType === "alignment_coverage") {
    payload = {
      departmentAlignmentPercent: 100,
      employeeAlignmentPercent: 100
    };
  } else if (insightType === "late_publishing") {
    const latePublishes = await prisma.okrAuditLog.count({
      where: {
        company_id: companyId,
        action_type: "STATUS_TRANSITION",
        new_value_json: { path: ["status"], equals: "published" },
        changed_at: { gt: archive.cycle?.start_date }
      }
    });
    payload = { latePublishCount: latePublishes };
  } else if (insightType === "cadence_adherence") {
    const totalMonthPlans = await prisma.employeeMonthPlan.count({
      where: { company_id: companyId, cycle_id: cycleId }
    });
    const completedMonthPlans = await prisma.employeeMonthPlan.count({
      where: {
        company_id: companyId,
        cycle_id: cycleId,
        plan_status: "PUBLISHED",
      }
    });
    payload = {
      totalPlans: totalMonthPlans,
      completedPlans: completedMonthPlans,
      adherenceRate: totalMonthPlans > 0 ? (completedMonthPlans / totalMonthPlans) * 100 : 0
    };
  }

  const insight = await prisma.archiveInsight.create({
    data: {
      company_id: companyId,
      quarter_archive_id: archiveId,
      insight_type: insightType,
      insight_title: `${insightType.replace(/_/g, " ")} — ${archive.quarter_name}`,
      insight_payload_json: payload,
      generated_by: actorId,
    },
  });

  await prisma.quarterArchive.update({
    where: { id: archiveId },
    data: { insights_generated: true },
  });

  return insight;
}

/**
 * Create Export Job.
 */
export async function createExportJob(
  archiveId: number,
  companyId: number,
  exportType: string,
  format: "PDF" | "CSV" | "XLSX" | "JSON",
  actorId: string
) {
  const archive = await prisma.quarterArchive.findFirst({
    where: { id: archiveId, company_id: companyId },
    include: {
      cycle: { select: { name: true, quarter_label: true } },
    },
  });
  if (!archive) throw new Error("Archive not found.");

  const safePathSegment = (value: string): string =>
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "unknown";

  const latestSnapshot = await prisma.okrScoreSnapshot.findFirst({
    where: {
      company_id: companyId,
      cycle_id: archive.cycle_id,
      scope_level: "COMPANY",
    },
    orderBy: { snapshot_date: "desc" },
  });

  const quarterLabel =
    String(archive.quarter_name || "").trim() ||
    String(archive.cycle?.quarter_label || "").trim() ||
    String(archive.cycle?.name || "").trim() ||
    `archive_${archive.id}`;

  // ── Build type-aware export rows ────────────────────────────────────────────
  let exportFields: ExportField[] = [];
  let exportRows: Record<string, any>[] = [];

  if (exportType === "full_quarter" || exportType === "objective") {
    // All company objectives + their KR counts
    const objectives = await prisma.companyObjective.findMany({
      where: { company_id: companyId, cycle_id: archive.cycle_id },
      include: {
        keyResults: {
          select: { id: true, title: true, final_score: true, final_value: true, unit_of_measure: true, status_code: true },
        },
      },
      orderBy: { id: "asc" },
    });

    exportFields = [
      { key: "quarter", label: "Quarter" },
      { key: "cycle_name", label: "Cycle" },
      { key: "objective_title", label: "Objective" },
      { key: "status", label: "Status" },
      { key: "final_score", label: "Score (%)" },
      { key: "final_value", label: "Value" },
      { key: "kr_count", label: "# Key Results" },
      { key: "kr_titles", label: "Key Results" },
    ];

    exportRows = objectives.map((o) => ({
      quarter: quarterLabel,
      cycle_name: archive.cycle?.name ?? "",
      objective_title: o.title,
      status: String(o.status_code ?? "").replace(/_/g, " "),
      final_score: o.final_score != null ? `${Number(o.final_score).toFixed(1)}%` : "—",
      final_value: o.final_value != null ? Number(o.final_value).toLocaleString("en-US") : "—",
      kr_count: o.keyResults.length,
      kr_titles: o.keyResults.map((k) => k.title).join("; ") || "—",
    }));

    if (exportRows.length === 0) {
      exportRows = [{ quarter: quarterLabel, cycle_name: archive.cycle?.name ?? "", objective_title: "No objectives found", status: "", final_score: "", final_value: "", kr_count: "", kr_titles: "" }];
    }

  } else if (exportType === "department") {
    // Employee objectives grouped by department
    const empObjs = await prisma.employeeObjective.findMany({
      where: { company_id: companyId, cycle_id: archive.cycle_id },
      include: {
        user: {
          include: {
            employee: {
              include: {
                employments: {
                  where: { is_active: true },
                  include: { department: true, jobTitle: true },
                  take: 1,
                },
              },
            },
          },
        },
        keyResults: { select: { id: true, title: true, final_score: true, final_value: true, status_code: true } },
      },
      orderBy: { id: "asc" },
    });

    exportFields = [
      { key: "quarter", label: "Quarter" },
      { key: "department", label: "Department" },
      { key: "employee", label: "Employee" },
      { key: "job_title", label: "Job Title" },
      { key: "objective_title", label: "Objective" },
      { key: "status", label: "Status" },
      { key: "final_score", label: "Score (%)" },
      { key: "final_value", label: "Value" },
      { key: "kr_count", label: "# Key Results" },
    ];

    exportRows = empObjs.map((o) => {
      const emp = o.user?.employee;
      const employment = emp?.employments?.[0];
      return {
        quarter: quarterLabel,
        department: employment?.department?.name ?? "—",
        employee: emp?.full_name ?? o.user_id,
        job_title: employment?.jobTitle?.title ?? "—",
        objective_title: o.title,
        status: String(o.status_code ?? "").replace(/_/g, " "),
        final_score: o.final_score != null ? `${Number(o.final_score).toFixed(1)}%` : "—",
        final_value: o.final_value != null ? Number(o.final_value).toLocaleString("en-US") : "—",
        kr_count: o.keyResults.length,
      };
    });

    if (exportRows.length === 0) {
      exportRows = [{ quarter: quarterLabel, department: "No department data found", employee: "", job_title: "", objective_title: "", status: "", final_score: "", final_value: "", kr_count: "" }];
    }

  } else if (exportType === "contributor") {
    // KR contributors with their objectives
    const contributors = await prisma.krContributor.findMany({
      where: {
        company_id: companyId,
        employeeKr: { employeeObjective: { cycle_id: archive.cycle_id } },
      },
      include: {
        employeeObjectives: {
          select: { title: true, final_score: true, final_value: true, status_code: true },
        },
        user: {
          include: {
            employee: {
              include: {
                employments: {
                  where: { is_active: true },
                  include: { department: true, jobTitle: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    exportFields = [
      { key: "quarter", label: "Quarter" },
      { key: "contributor", label: "Contributor" },
      { key: "department", label: "Department" },
      { key: "role", label: "Role" },
      { key: "objective_title", label: "Objective" },
      { key: "obj_status", label: "Obj. Status" },
      { key: "obj_score", label: "Obj. Score (%)" },
      { key: "obj_value", label: "Obj. Value" },
    ];

    exportRows = contributors.map((c) => {
      const emp = c.user?.employee;
      const employment = emp?.employments?.[0];
      const obj = c.employeeObjectives;
      return {
        quarter: quarterLabel,
        contributor: emp?.full_name ?? c.user_id ?? "—",
        department: employment?.department?.name ?? "—",
        role: String(c.role_type ?? "").replace(/_/g, " "),
        objective_title: obj?.title ?? "—",
        obj_status: String(obj?.status_code ?? "").replace(/_/g, " "),
        obj_score: obj?.final_score != null ? `${Number(obj.final_score).toFixed(1)}%` : "—",
        obj_value: obj?.final_value != null ? Number(obj.final_value).toLocaleString("en-US") : "—",
      };
    });

    if (exportRows.length === 0) {
      exportRows = [{ quarter: quarterLabel, contributor: "No contributor data found", department: "", role: "", objective_title: "", obj_status: "", obj_score: "", obj_value: "" }];
    }

  } else if (exportType === "report_pack") {
    // All generated reports as rows
    const reports = await prisma.archiveReport.findMany({
      where: { company_id: companyId, quarter_archive_id: archiveId },
      orderBy: { generated_at: "asc" },
    });

    exportFields = [
      { key: "quarter", label: "Quarter" },
      { key: "report_name", label: "Report Name" },
      { key: "report_type", label: "Report Type" },
      { key: "generated_at", label: "Generated At" },
      { key: "generated_by", label: "Generated By" },
      { key: "version", label: "Version" },
    ];

    exportRows = reports.map((r) => ({
      quarter: quarterLabel,
      report_name: r.report_name,
      report_type: String(r.report_type).replace(/_/g, " "),
      generated_at: r.generated_at ? new Date(r.generated_at).toLocaleString() : "—",
      generated_by: r.generated_by,
      version: r.version_number,
    }));

    if (exportRows.length === 0) {
      exportRows = [{ quarter: quarterLabel, report_name: "No reports generated yet", report_type: "", generated_at: "", generated_by: "", version: "" }];
    }

  } else {
    // Fallback: plain summary row
    exportFields = [
      { key: "quarter", label: "Quarter" },
      { key: "cycle_name", label: "Cycle" },
      { key: "archived_at", label: "Archived At" },
      { key: "score", label: "Score (%)" },
      { key: "completion_rate", label: "Completion Rate (%)" },
      { key: "total_objectives", label: "Total Objectives" },
      { key: "total_key_results", label: "Total Key Results" },
    ];
    exportRows = [{
      quarter: quarterLabel,
      cycle_name: archive.cycle?.name ?? "",
      archived_at: archive.archived_at,
      score: latestSnapshot?.score_value != null ? `${Number(latestSnapshot.score_value).toFixed(1)}%` : "—",
      completion_rate: latestSnapshot?.completion_rate != null ? `${Number(latestSnapshot.completion_rate).toFixed(1)}%` : "—",
      total_objectives: latestSnapshot?.total_objectives ?? "—",
      total_key_results: latestSnapshot?.total_key_results ?? "—",
    }];
  }

  const job = await prisma.exportJob.create({
    data: {
      company_id: companyId,
      quarter_archive_id: archiveId,
      export_type: exportType,
      format,
      status: "PENDING",
      requested_by: actorId,
    },
  });

  const extension = format.toLowerCase() === "xlsx" ? "xlsx" : format.toLowerCase();
  const quarterSegment = safePathSegment(quarterLabel);
  const typeSegment = safePathSegment(exportType || "full_quarter");
  const timestamp = Date.now();
  const relativePath = path.posix.join(
    "exports",
    String(companyId),
    quarterSegment,
    `${typeSegment}_${timestamp}.${extension}`,
  );
  const diskPath = path.join(process.cwd(), ...relativePath.split("/"));
  const publicPath = `/${relativePath}`;

  const exportTitle = `OKR Archive — ${String(exportType).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
  const exportSubtitle = `${quarterLabel} • ${archive.cycle?.name ?? ""} • Generated ${new Date().toLocaleDateString()}`;

  let fileBuffer: Buffer;
  if (format === "JSON") {
    fileBuffer = Buffer.from(
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          company_id: companyId,
          quarter: quarterLabel,
          export_type: exportType,
          total_rows: exportRows.length,
          data: exportRows,
        },
        null,
        2,
      ),
      "utf-8",
    );
  } else {
    const generated = await exportData({
      format: format.toLowerCase() as "pdf" | "csv" | "xlsx",
      fields: exportFields,
      data: exportRows,
      title: exportTitle,
      subtitle: exportSubtitle,
    });
    fileBuffer = generated.buffer;
  }

  await fs.promises.mkdir(path.dirname(diskPath), { recursive: true });
  await fs.promises.writeFile(diskPath, fileBuffer);

  // Simulate job completion (in production, this would be handled by a worker)
  const completedJob = await prisma.exportJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      completed_at: new Date(),
      generated_file_reference: publicPath,
    },
  });

  // Create file record
  const file = await prisma.exportedFile.create({
    data: {
      company_id: companyId,
      export_job_id: job.id,
      file_name: `${quarterSegment}_${typeSegment}.${extension}`,
      file_type: extension,
      storage_path: publicPath,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  await prisma.quarterArchive.update({
    where: { id: archiveId },
    data: { exports_generated: true },
  });

  return { job: completedJob, file };
}

/**
 * Get Export Job status.
 */
export async function getExportJob(jobId: number, companyId: number) {
  const job = await prisma.exportJob.findFirst({
    where: { id: jobId, company_id: companyId },
    include: { files: true },
  });
  if (!job) throw new Error("Export job not found.");
  return job;
}
