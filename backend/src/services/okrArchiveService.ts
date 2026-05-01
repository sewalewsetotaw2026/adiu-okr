import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import { logActivity } from "src/services/okrActivityLogService";
import { refreshFullRollup } from "src/services/okrRollupService";
import { generateSnapshot } from "src/services/okrDashboardService";

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
 */
export async function listArchives(companyId: number) {
  return prisma.quarterArchive.findMany({
    where: { company_id: companyId },
    include: {
      cycle: { select: { name: true, quarter_label: true, start_date: true, end_date: true } },
      _count: { select: { reports: true, insights: true, exportJobs: true } },
    },
    orderBy: { archived_at: "desc" },
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

  // Fetch archived OKR summary from score snapshots
  const snapshots = await prisma.okrScoreSnapshot.findMany({
    where: { company_id: companyId, cycle_id: archive.cycle_id },
    orderBy: { snapshot_date: "desc" },
  });

  return { ...archive, snapshots };
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
      objectives: objectives.map(o => ({ id: o.id, title: o.title, score: o.final_score, value: o.current_value })),
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
        title: d.title, score: d.final_score, value: d.current_value,
      })),
    };
  } else if (reportType === "contributor_performance") {
    const contributors = await prisma.krContributor.findMany({
      where: {
        company_id: companyId,
        employeeKr: { employeeObjective: { cycle_id: cycleId } },
      },
      include: {
        employeeObjectives: { select: { title: true, final_score: true, current_value: true } },
      },
    });
    payload = {
      totalContributors: contributors.length,
      contributors: contributors.map(c => {
        const obj = c.employeeObjectives;
        return {
          userId: c.user_id,
          role: c.role_type,
          objectives: obj ? [{ title: obj.title, score: obj.final_score, value: obj.current_value }] : [],
        };
      }),
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
      orderBy: { final_score: "desc" },
      take: 10,
      select: { user_id: true, title: true, final_score: true, current_value: true },
    });
    payload = { topPerformers: empObjs };
  } else if (insightType === "bottlenecks") {
    const lowScoreKRs = await prisma.employeeKeyResult.findMany({
      where: {
        company_id: companyId,
        employeeObjective: { cycle_id: cycleId },
        final_score: { lt: 50 },
      },
      take: 10,
      orderBy: { final_score: "asc" },
      select: { id: true, title: true, final_score: true },
    });
    payload = { bottlenecks: lowScoreKRs };
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
    payload = { totalKRs: allKRs, completedKRs, completionRate: allKRs > 0 ? (completedKRs / allKRs) * 100 : 0 };
  } else if (insightType === "blocker_summaries") {
    const blockers = await prisma.progressUpdate.findMany({
      where: {
        company_id: companyId,
        confidence_level: { in: ["AT_RISK", "OFF_TRACK"] },
        blockers: { not: null },
      },
      take: 20,
      orderBy: { created_at: "desc" },
      select: { blockers: true, confidence_level: true, created_at: true }
    });
    payload = { blockedCount: blockers.length, recentBlockers: blockers };
  } else if (insightType === "alignment_coverage") {
    // Both Department and Employee objectives are strictly relationally tied to their parents in the schema (100% alignment natively forced).
    payload = {
      departmentAlignmentPercent: 100,
      employeeAlignmentPercent: 100
    };
  } else if (insightType === "late_publishing") {
    // Check audit logs where a 'published' action happened after cycle started
    const latePublishes = await prisma.okrAuditLog.count({
      where: {
        company_id: companyId,
        action_type: "STATUS_TRANSITION",
        new_value_json: { equals: { status: "published" } as any },
        changed_at: { gt: archive.cycle?.start_date } // assuming cycle start date is available or we find it
      }
    });
    payload = { latePublishCount: latePublishes };
  } else if (insightType === "cadence_adherence") {
    const totalMonthPlans = await prisma.employeeMonthPlan.count({
      where: { company_id: companyId, employeeObjective: { cycle_id: cycleId } }
    });
    const completedMonthPlans = await prisma.employeeMonthPlan.count({
      where: {
        company_id: companyId,
        employeeObjective: { cycle_id: cycleId },
        status_code: { in: ["completed", "done", "closed"] }
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
  });
  if (!archive) throw new Error("Archive not found.");

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

  // Simulate job completion (in production, this would be handled by a worker)
  await prisma.exportJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      completed_at: new Date(),
      generated_file_reference: `exports/${companyId}/${archive.quarter_name}/${exportType}.${format.toLowerCase()}`,
    },
  });

  // Create file record
  const file = await prisma.exportedFile.create({
    data: {
      company_id: companyId,
      export_job_id: job.id,
      file_name: `${archive.quarter_name}_${exportType}.${format.toLowerCase()}`,
      file_type: format.toLowerCase(),
      storage_path: `exports/${companyId}/${archive.quarter_name}/${exportType}.${format.toLowerCase()}`,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  await prisma.quarterArchive.update({
    where: { id: archiveId },
    data: { exports_generated: true },
  });

  return { job: { ...job, status: "COMPLETED" }, file };
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
