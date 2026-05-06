import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrSubmissionType, OkrEntityType } from "@prisma/client";
import * as configResolver from "src/services/okrConfigResolverService";
import { validateWeightsForSubmission } from "src/services/okrWeightValidationService";

// ─── Helper: Resolve direct manager for an employee ────────────────────────────

async function resolveDirectManager(
  employeeId: string,
  companyId: number,
): Promise<{ managerId: string; managerName: string } | null> {
  const employment = await prisma.employment.findFirst({
    where: {
      employee_id: employeeId,
      company_id: companyId,
      is_active: true,
      manager_id: { not: null },
    },
    select: {
      manager_id: true,
    },
  });

  if (!employment?.manager_id) return null;

  // Resolve manager name
  const manager = await prisma.employee.findFirst({
    where: { id: employment.manager_id, company_id: companyId },
    select: { full_name: true },
  });

  return {
    managerId: employment.manager_id,
    managerName: manager?.full_name || "Manager",
  };
}

// ─── Helper: Resolve reviewer_id (AppUser.id) for a manager employee_id ────────

async function resolveReviewerUserId(
  managerEmployeeId: string,
  companyId: number,
): Promise<string | null> {
  const appUser = await prisma.appUser.findFirst({
    where: { employee_id: managerEmployeeId, company_id: companyId },
    select: { employee_id: true },
  });
  return appUser ? appUser.employee_id : null;
}

// ─── Submit For Approval (Plan-Based) ──────────────────────────────────────────

export async function submitForApproval(params: {
  companyId: number;
  cycleId: number;
  submitterId: string;
  departmentId?: number;
  entityId?: number;
  type: OkrSubmissionType;
}) {
  const { companyId, cycleId, submitterId, departmentId, entityId, type } = params;

  // 1. Identify items to include in this submission
  let items: Array<{ id: number; entityType: string }> = [];
  const statusFilter = { company_id: companyId, status_code: "draft" };

  if (type === "QUARTERLY_PLANNING") {
    if (entityId) {
      // Single Objective Submission
      const objective = await prisma.employeeObjective.findUnique({
        where: { id: entityId },
        include: { keyResults: { where: { status_code: "draft" } } },
      });
      if (objective && objective.status_code === "draft") {
        items = [
          { id: objective.id, entityType: "EMPLOYEE_OBJECTIVE" },
          ...objective.keyResults.map((kr) => ({ id: kr.id, entityType: "EMPLOYEE_KR" })),
        ];
      }
    } else if (departmentId) {
      // Department Level
      const objectives = await prisma.employeeObjective.findMany({
        where: {
          ...statusFilter,
          cycle_id: cycleId,
          user: {
            employee: {
              employments: { some: { department_id: departmentId, is_active: true } },
            },
          },
        },
        include: { keyResults: { where: { status_code: "draft" } } },
      });
      items = objectives.flatMap((o) => [
        { id: o.id, entityType: "EMPLOYEE_OBJECTIVE" },
        ...o.keyResults.map((kr) => ({ id: kr.id, entityType: "EMPLOYEE_KR" })),
      ]);
    } else {
      // Employee Level
      const objectives = await prisma.employeeObjective.findMany({
        where: { ...statusFilter, cycle_id: cycleId, user_id: submitterId },
        include: { keyResults: { where: { status_code: "draft" } } },
      });
      items = objectives.flatMap((o) => [
        { id: o.id, entityType: "EMPLOYEE_OBJECTIVE" },
        ...o.keyResults.map((kr) => ({ id: kr.id, entityType: "EMPLOYEE_KR" })),
      ]);
    }
  } else if (type === "MONTHLY_PLAN") {
    // New schema: monthly plans hold cycle_id + owner_id directly.
    const planFilter: any = { plan_status: "DRAFT" };
    if (departmentId) {
      const plans = await prisma.employeeMonthPlan.findMany({
        where: {
          ...planFilter,
          cycle_id: cycleId,
          employeeKr: {
            employeeObjective: {
              user: {
                employee: {
                  employments: {
                    some: { department_id: departmentId, is_active: true },
                  },
                },
              },
            },
          },
        },
      });
      items = plans.map((p) => ({ id: p.id, entityType: "EMPLOYEE_MONTH_PLAN" }));
    } else {
      const plans = await prisma.employeeMonthPlan.findMany({
        where: {
          ...planFilter,
          cycle_id: cycleId,
          owner_id: submitterId,
        },
      });
      items = plans.map((p) => ({ id: p.id, entityType: "EMPLOYEE_MONTH_PLAN" }));
    }
  } else if (type === "WEEKLY_PLAN") {
    const planFilter: any = { plan_status: "DRAFT" };
    if (departmentId) {
      const plans = await prisma.weeklyPlan.findMany({
        where: {
          ...planFilter,
          monthPlan: {
            cycle_id: cycleId,
            employeeKr: {
              employeeObjective: {
                user: {
                  employee: {
                    employments: {
                      some: { department_id: departmentId, is_active: true },
                    },
                  },
                },
              },
            },
          },
        },
      });
      items = plans.map((p) => ({ id: p.id, entityType: "WEEKLY_PLAN" }));
    } else {
      const plans = await prisma.weeklyPlan.findMany({
        where: {
          ...planFilter,
          owner_id: submitterId,
          monthPlan: { cycle_id: cycleId },
        },
      });
      items = plans.map((p) => ({ id: p.id, entityType: "WEEKLY_PLAN" }));
    }
  }

  if (items.length === 0) {
    throw new Error("Cannot submit: No draft items found to submit for approval.");
  }

  // 1b. Weight validation for quarterly planning submissions
  if (type === "QUARTERLY_PLANNING") {
    const objectiveIds = items
      .filter((i) => i.entityType === "EMPLOYEE_OBJECTIVE")
      .map((i) => i.id);
    if (objectiveIds.length > 0) {
      await validateWeightsForSubmission(companyId, cycleId, objectiveIds);
    }
  }

  // 2. Auto-detect direct manager as reviewer (1-level hierarchy only)
  //    Fall back to admin if no direct manager is assigned
  let reviewerUserId: string | null = null;
  let reviewerName = "Unassigned";

  const directManager = await resolveDirectManager(submitterId, companyId);
  if (directManager) {
    reviewerUserId = await resolveReviewerUserId(directManager.managerId, companyId);
    reviewerName = directManager.managerName;
  }

  // Fallback: if no direct manager, use admin as reviewer
  if (!reviewerUserId) {
    // Try to find admin appUser with linked employee
    const adminAppUser = await prisma.appUser.findFirst({
      where: {
        company_id: companyId,
        role: {
          OR: [
            { name: { in: ["Admin", "SuperAdmin", "Super Admin"] } },
            { name: { contains: "admin", mode: "insensitive" } },
          ],
        },
      },
      include: { employee: { select: { id: true, full_name: true } } },
    });

    if (adminAppUser?.employee) {
      reviewerUserId = adminAppUser.employee.id;
      reviewerName = adminAppUser.employee.full_name || "Admin";
    } else if (adminAppUser?.employee_id) {
      reviewerUserId = adminAppUser.employee_id;
      const emp = await prisma.employee.findFirst({
        where: { id: adminAppUser.employee_id },
        select: { full_name: true },
      });
      reviewerName = emp?.full_name || "Admin";
    } else {
      // Fallback: find employees with admin roles directly
      const adminEmployees = await prisma.employee.findMany({
        where: {
          company_id: companyId,
          appUsers: {
            some: {
              role: {
                OR: [
                  { name: { in: ["Admin", "SuperAdmin", "Super Admin"] } },
                  { name: { contains: "admin", mode: "insensitive" } },
                ],
              },
            },
          },
        },
        select: { id: true, full_name: true },
        take: 1,
      });

      if (adminEmployees.length > 0) {
        reviewerUserId = adminEmployees[0].id;
        reviewerName = adminEmployees[0].full_name || "Admin";
      }
    }
  }

  if (!reviewerUserId) {
    throw new Error(
      "Cannot submit for approval: No direct manager or admin is configured to review.",
    );
  }

  // 3. Create the submission record with reviewer_id
  const submission = await prisma.okrSubmission.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      submitter_id: submitterId,
      reviewer_id: reviewerUserId,
      department_id: departmentId,
      status: "pending_approval",
      type: type,
    },
  });

  // 4. Update all items to pending_approval and link to submission
  for (const item of items) {
    const updateData = {
      status_code: "pending_approval",
      submission_id: submission.id,
    };
    switch (item.entityType) {
      case "EMPLOYEE_OBJECTIVE":
        await prisma.employeeObjective.update({
          where: { id: item.id },
          data: updateData,
        });
        break;
      case "EMPLOYEE_KR":
        await prisma.employeeKeyResult.update({
          where: { id: item.id },
          data: updateData,
        });
        break;
      case "EMPLOYEE_MONTH_PLAN":
        await prisma.employeeMonthPlan.update({
          where: { id: item.id },
          data: {
            plan_status: "SUBMITTED",
            submitted_at: new Date(),
            submission_id: submission.id,
          },
        });
        break;
      case "WEEKLY_PLAN":
        await prisma.weeklyPlan.update({
          where: { id: item.id },
          data: {
            plan_status: "SUBMITTED",
            submitted_at: new Date(),
            submission_id: submission.id,
          },
        });
        break;
    }
  }

  await logActivity({
    companyId,
    entityType: "SUBMISSION",
    entityId: submission.id,
    actorId: submitterId,
    action: "submission_created",
    description: `${type} submission created with ${items.length} items. Reviewer: ${reviewerName}.`,
  });

  // 5. Send SSE notification only to direct reviewer (single-level flow)
  try {
    const { notifySubmissionCreated } = await import(
      "src/services/okrNotificationService"
    );

    // Resolve submitter name
    const submitter = await prisma.employee.findFirst({
      where: { id: submitterId, company_id: companyId },
      select: { full_name: true },
    });

    const baseParams = {
      companyId,
      submissionId: submission.id,
      submitterName: submitter?.full_name || "Employee",
      submitterEmployeeId: submitterId,
      type,
      itemCount: items.length,
    };

    await notifySubmissionCreated({
      ...baseParams,
      reviewerUserId,
    });
  } catch (e) {
    console.warn("[OkrApproval] Failed to send submission notification:", e);
  }

  return {
    ...submission,
    item_count: items.length,
    reviewer_name: reviewerName,
  };
}

// ─── Add Review Comment (Granular Feedback) ────────────────────────────────────

export async function addReviewComment(params: {
  companyId: number;
  entityType: OkrEntityType;
  entityId: number;
  comment: string;
  authorId: string;
}) {
  const { companyId, entityType, entityId, comment, authorId } = params;

  // 1. Add the comment
  const okrComment = await prisma.okrComment.create({
    data: {
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      author_id: authorId,
      content: comment,
      ...(entityType === "EMPLOYEE_OBJECTIVE"
        ? { employeeObjectiveId: entityId }
        : {}),
      ...(entityType === "EMPLOYEE_KR"
        ? { employeeKeyResultId: entityId }
        : {}),
    },
  });

  // 2. Set item back to draft
  const updateData = { status_code: "draft" };
  let submissionId: number | null = null;
  let submitterUserId: string | null = null;

  switch (entityType) {
    case "EMPLOYEE_OBJECTIVE": {
      const obj = await prisma.employeeObjective.update({
        where: { id: entityId },
        data: updateData,
        select: { submission_id: true, user_id: true },
      });
      submissionId = obj.submission_id;
      submitterUserId = obj.user_id;
      break;
    }
    case "EMPLOYEE_KR": {
      const kr = await prisma.employeeKeyResult.update({
        where: { id: entityId },
        data: updateData,
        select: {
          submission_id: true,
          employeeObjective: { select: { user_id: true } },
        },
      });
      submissionId = kr.submission_id;
      submitterUserId = kr.employeeObjective.user_id;
      break;
    }
    case "EMPLOYEE_MONTH_PLAN": {
      const plan = await prisma.employeeMonthPlan.update({
        where: { id: entityId },
        data: { plan_status: "DRAFT" },
        select: {
          submission_id: true,
          employeeKr: {
            select: { employeeObjective: { select: { user_id: true } } },
          },
        },
      });
      submissionId = plan.submission_id;
      submitterUserId = plan.employeeKr.employeeObjective.user_id;
      break;
    }
    case "WEEKLY_PLAN": {
      const plan = await prisma.weeklyPlan.update({
        where: { id: entityId },
        data: { plan_status: "DRAFT" },
        select: {
          submission_id: true,
          monthPlan: {
            select: {
              employeeKr: {
                select: { employeeObjective: { select: { user_id: true } } },
              },
            },
          },
        },
      });
      submissionId = plan.submission_id;
      submitterUserId = plan.monthPlan.employeeKr.employeeObjective.user_id;
      break;
    }
  }

  // CASCADE: If this item belongs to a submission, revert the ENTIRE submission to draft
  if (submissionId) {
    await prisma.$transaction([
      // Update submission status
      prisma.okrSubmission.update({
        where: { id: submissionId },
        data: { status: "draft" },
      }),
      // Revert all sibling objectives
      prisma.employeeObjective.updateMany({
        where: { submission_id: submissionId },
        data: { status_code: "draft" },
      }),
      // Revert all sibling KRs
      prisma.employeeKeyResult.updateMany({
        where: { submission_id: submissionId },
        data: { status_code: "draft" },
      }),
      // Revert all sibling month plans
      prisma.employeeMonthPlan.updateMany({
        where: { submission_id: submissionId },
        data: { plan_status: "DRAFT" },
      }),
      // Revert all sibling weekly plans
      prisma.weeklyPlan.updateMany({
        where: { submission_id: submissionId },
        data: { plan_status: "DRAFT" },
      }),
    ]);
  }

  await logActivity({
    companyId,
    entityType,
    entityId,
    actorId: authorId,
    action: "review_comment_added",
    description: `Comment added by reviewer. Entire plan reverted to draft.`,
    metadata: { comment, submission_id: submissionId },
  });

  // 3. Send SSE notification to submitter
  try {
    const { notifyFeedbackGiven } = await import(
      "src/services/okrNotificationService"
    );

    const reviewer = await prisma.employee.findFirst({
      where: { id: authorId, company_id: companyId },
      select: { full_name: true },
    });

    if (submitterUserId) {
      await notifyFeedbackGiven({
        companyId,
        entityType,
        entityId,
        reviewerName: reviewer?.full_name || "Reviewer",
        comment,
        submitterEmployeeId: submitterUserId,
      });
    }
  } catch (e) {
    console.warn("[OkrApproval] Failed to send feedback notification:", e);
  }

  return okrComment;
}

// ─── Approve Submission (Full Plan) ────────────────────────────────────────────

export async function approveSubmission(
  submissionId: number,
  reviewerId: string,
  companyId?: number,
) {
  const submission = await prisma.okrSubmission.findUnique({
    where: { id: submissionId },
    include: {
      employeeObjectives: true,
      employeeKeyResults: true,
      employeeMonthPlans: true,
      weeklyPlans: true,
    },
  });

  if (!submission) throw new Error("Submission not found.");
  if (submission.status === "approved")
    throw new Error("Submission is already approved.");

  // Validate reviewer authorization (strict single-level reviewer only)
  if (!submission.reviewer_id || submission.reviewer_id !== reviewerId) {
    throw new Error(
      "Unauthorized: You are not the assigned direct reviewer for this submission.",
    );
  }

  // Check all items are in pending_approval
  const allItems = [
    ...submission.employeeObjectives,
    ...submission.employeeKeyResults,
    ...submission.employeeMonthPlans,
    ...submission.weeklyPlans,
  ];

  // Objectives/KRs use status_code='pending_approval'; new monthly/weekly plans
  // use plan_status='SUBMITTED'.
  const isPlanItem = (item: any) => "plan_status" in item;
  const nonPendingItems = allItems.filter((item: any) =>
    isPlanItem(item)
      ? item.plan_status !== "SUBMITTED"
      : item.status_code !== "pending_approval",
  );

  if (nonPendingItems.length > 0) {
    throw new Error(
      `Cannot approve submission. ${nonPendingItems.length} items are still in draft or require revision. Please review all items before approving.`,
    );
  }

  // Check auto-publish config
  const resolvedCompanyId = companyId || submission.company_id;
  const shouldAutoPublish = await configResolver.isAutoPublishOnApprovalEnabled(
    resolvedCompanyId,
    submission.cycle_id,
  );
  console.log(
    `[OkrApproval] approveSubmission id=${submissionId} companyId=${resolvedCompanyId} cycleId=${submission.cycle_id} shouldAutoPublish=${shouldAutoPublish}`,
  );

  const targetStatus = shouldAutoPublish ? "published" : "approved";

  // Final Approval — update everything in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.okrSubmission.update({
      where: { id: submissionId },
      data: { status: targetStatus, reviewer_id: reviewerId },
    });

    const updateData: any = {
      status_code: targetStatus,
      approved_by: reviewerId,
    };
    if (shouldAutoPublish) {
      updateData.published_by = reviewerId;
      updateData.published_at = new Date();
    }

    for (const obj of submission.employeeObjectives)
      await tx.employeeObjective.update({
        where: { id: obj.id },
        data: updateData,
      });
    for (const kr of submission.employeeKeyResults)
      await tx.employeeKeyResult.update({
        where: { id: kr.id },
        data: updateData,
      });
    const planStatus = shouldAutoPublish ? "PUBLISHED" : "APPROVED";
    const planUpdateData: any = { plan_status: planStatus, approved_at: new Date() };
    if (shouldAutoPublish) planUpdateData.published_at = new Date();
    for (const plan of submission.employeeMonthPlans)
      await tx.employeeMonthPlan.update({
        where: { id: plan.id },
        data: planUpdateData,
      });
    for (const plan of submission.weeklyPlans)
      await tx.weeklyPlan.update({
        where: { id: plan.id },
        data: planUpdateData,
      });
  });

  await logActivity({
    companyId: resolvedCompanyId,
    entityType: "SUBMISSION",
    entityId: submission.id,
    actorId: reviewerId,
    action: shouldAutoPublish
      ? "submission_approved_and_published"
      : "submission_approved",
    description: `Submission ${shouldAutoPublish ? "approved and auto-published" : "approved"}. All ${allItems.length} items moved to ${targetStatus} status.`,
  });

  // Send SSE notification
  try {
    const notifModule = await import("src/services/okrNotificationService");
    const approver = await prisma.employee.findFirst({
      where: { id: reviewerId, company_id: resolvedCompanyId },
      select: { full_name: true },
    });

    if (shouldAutoPublish) {
      await notifModule.notifyAutoPublished({
        companyId: resolvedCompanyId,
        submissionId: submission.id,
        approverName: approver?.full_name || "Manager",
        submitterEmployeeId: submission.submitter_id,
      });
    } else {
      await notifModule.notifySubmissionApproved({
        companyId: resolvedCompanyId,
        submissionId: submission.id,
        approverName: approver?.full_name || "Manager",
        submitterEmployeeId: submission.submitter_id,
      });
    }
  } catch (e) {
    console.warn("[OkrApproval] Failed to send approval notification:", e);
  }

  return { success: true, auto_published: shouldAutoPublish };
}

// ─── Reject Submission (Full Plan) ─────────────────────────────────────────────

export async function rejectSubmission(params: {
  submissionId: number;
  reviewerId: string;
  companyId: number;
  reason: string;
}) {
  const { submissionId, reviewerId, companyId, reason } = params;

  if (!reason.trim()) {
    throw new Error("A reason is required when rejecting a submission.");
  }

  const submission = await prisma.okrSubmission.findUnique({
    where: { id: submissionId },
    include: {
      employeeObjectives: true,
      employeeKeyResults: true,
      employeeMonthPlans: true,
      weeklyPlans: true,
    },
  });

  if (!submission) throw new Error("Submission not found.");
  if (submission.status === "rejected")
    throw new Error("Submission is already rejected.");

  // Validate reviewer authorization (strict single-level reviewer only)
  if (!submission.reviewer_id || submission.reviewer_id !== reviewerId) {
    throw new Error(
      "Unauthorized: You are not the assigned direct reviewer for this submission.",
    );
  }

  // Reject entire plan — revert ALL items to draft
  await prisma.$transaction(async (tx) => {
    await tx.okrSubmission.update({
      where: { id: submissionId },
      data: { status: "rejected", reviewer_id: reviewerId },
    });

    const objKrRevert = { status_code: "draft" };
    const planRevert = { plan_status: "DRAFT" as const };

    for (const obj of submission.employeeObjectives)
      await tx.employeeObjective.update({
        where: { id: obj.id },
        data: objKrRevert,
      });
    for (const kr of submission.employeeKeyResults)
      await tx.employeeKeyResult.update({
        where: { id: kr.id },
        data: objKrRevert,
      });
    for (const plan of submission.employeeMonthPlans)
      await tx.employeeMonthPlan.update({
        where: { id: plan.id },
        data: planRevert,
      });
    for (const plan of submission.weeklyPlans)
      await tx.weeklyPlan.update({
        where: { id: plan.id },
        data: planRevert,
      });
  });

  // Log the rejection with reason as an approval log entry
  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: "SUBMISSION",
      entity_id: submissionId,
      approver_id: reviewerId,
      action: "REJECTED",
      comments: reason,
    },
  });

  await logActivity({
    companyId,
    entityType: "SUBMISSION",
    entityId: submissionId,
    actorId: reviewerId,
    action: "submission_rejected",
    description: `Submission rejected. All items reverted to draft. Reason: ${reason}`,
    metadata: { reason },
  });

  // Send SSE notification
  try {
    const { notifySubmissionRejected } = await import(
      "src/services/okrNotificationService"
    );
    const reviewer = await prisma.employee.findFirst({
      where: { id: reviewerId, company_id: companyId },
      select: { full_name: true },
    });

    await notifySubmissionRejected({
      companyId,
      submissionId: submissionId,
      approverName: reviewer?.full_name || "Manager",
      submitterEmployeeId: submission.submitter_id,
      reason,
    });
  } catch (e) {
    console.warn("[OkrApproval] Failed to send rejection notification:", e);
  }

  return { success: true };
}

// ─── Get Submission Detail (for nested review UI) ──────────────────────────────

export async function getSubmissionDetail(
  submissionId: number,
  companyId: number,
) {
  const submission = await prisma.okrSubmission.findFirst({
    where: { id: submissionId, company_id: companyId },
    include: {
      employeeObjectives: {
        include: {
          keyResults: {
            include: {
              metricDefinition: { select: { name: true, unit_of_measure: true } },
              comments: {
                orderBy: { created_at: "desc" },
                take: 5,
                select: {
                  id: true,
                  content: true,
                  author_id: true,
                  created_at: true,
                },
              },
            },
          },
          comments: {
            orderBy: { created_at: "desc" },
            take: 5,
            select: {
              id: true,
              content: true,
              author_id: true,
              created_at: true,
            },
          },
        },
      },
      employeeKeyResults: {
        include: {
          metricDefinition: { select: { name: true, unit_of_measure: true } },
          comments: {
            orderBy: { created_at: "desc" },
            take: 5,
            select: {
              id: true,
              content: true,
              author_id: true,
              created_at: true,
            },
          },
        },
      },
      employeeMonthPlans: {
        include: {
          employeeKr: { select: { title: true } },
        },
      },
      weeklyPlans: {
        include: {
          monthPlan: {
            select: {
              employeeKr: { select: { title: true } },
            },
          },
          dailyPlans: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  if (!submission) throw new Error("Submission not found.");

  // Resolve submitter name
  const submitter = await prisma.employee.findFirst({
    where: { id: submission.submitter_id, company_id: companyId },
    select: { full_name: true },
  });

  // Build nested structure: objectives with their KRs grouped
  const objectivesWithKRs = submission.employeeObjectives.map((obj) => {
    // Find KRs that belong to this objective (from the submission's KR list)
    const relatedKRs = submission.employeeKeyResults.filter(
      (kr) => kr.employee_objective_id === obj.id,
    );

    // Merge with the KRs already included via the objective relation
    const allKRs = [
      ...obj.keyResults,
      ...relatedKRs.filter(
        (rk) => !obj.keyResults.some((ok) => ok.id === rk.id),
      ),
    ];

    return {
      ...obj,
      keyResults: allKRs,
    };
  });

  return {
    ...submission,
    submitter_name: submitter?.full_name || "Unknown",
    objectives_with_krs: objectivesWithKRs,
  };
}

// ─── List Admin Submissions (All pending department objectives) ────────────────────────────────────────

export async function listAdminSubmissions(params: {
  companyId: number;
  cycleId: number;
  status?: string;
  type?: OkrSubmissionType;
  search?: string;
  departmentId?: number;
}) {
  const { companyId, cycleId, status, search, departmentId } = params;

  // Query OkrSubmission table primarily (modernized)
  const where: any = {
    company_id: companyId,
    cycle_id: cycleId,
  };

  if (status) {
    where.status = status;
  } else {
    where.status = "pending_approval";
  }

  if (departmentId) {
    where.department_id = departmentId;
  }

  const submissions = await prisma.okrSubmission.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      employeeObjectives: {
        select: {
          id: true,
          title: true,
          status_code: true,
          keyResults: {
            select: {
              id: true,
              title: true,
              status_code: true,
              weight_percent: true,
              metricDefinition: {
                select: { name: true, unit_of_measure: true },
              },
            },
          },
        },
      },
      employeeKeyResults: {
        select: {
          id: true,
          title: true,
          status_code: true,
          weight_percent: true,
          employee_objective_id: true,
        },
      },
      employeeMonthPlans: {
        select: {
          id: true,
          title: true,
          plan_status: true,
          month_number: true,
        },
      },
      weeklyPlans: {
        select: {
          id: true,
          title: true,
          plan_status: true,
          week_number: true,
        },
      },
    },
  });

  // Fetch submitter names
  const submitterIds = [...new Set(submissions.map((s) => s.submitter_id))];
  const employees = await prisma.employee.findMany({
    where: { id: { in: submitterIds }, company_id: companyId },
    select: { id: true, full_name: true },
  });
  const nameMap = new Map(employees.map((e) => [e.id, e.full_name]));

  // Fetch department names
  const deptIds = [...new Set(submissions.map((s) => s.department_id).filter(Boolean))];
  const depts = await prisma.department.findMany({
    where: { id: { in: deptIds as number[] } },
    select: { id: true, name: true },
  });
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  return submissions.map((s) => ({
    ...s,
    type: s.type === "QUARTERLY_PLANNING" && s.department_id ? "DEPARTMENT_OBJECTIVE" : s.type,
    submitter_name: nameMap.get(s.submitter_id) || "Unknown",
    submitter_department: s.department_id ? deptMap.get(s.department_id) || null : null,
    item_count:
      s.employeeObjectives.length +
      s.employeeKeyResults.length +
      s.employeeMonthPlans.length +
      s.weeklyPlans.length,
    title: s.employeeObjectives[0]?.title || `${s.type} Submission`,
  }));
}

// ─── List Manager Submissions (Grouped) ────────────────────────────────────────

export async function listManagerSubmissions(params: {
  reviewerUserId: string;
  companyId: number;
  cycleId: number;
  status?: string;
  type?: OkrSubmissionType;
  search?: string;
  departmentId?: number;
}) {
  const { reviewerUserId, companyId, cycleId, status, type, search, departmentId } = params;

  const where: any = {
    company_id: companyId,
    cycle_id: cycleId,
    reviewer_id: reviewerUserId,
  };

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (departmentId) {
    where.department_id = departmentId;
  }

  // Search by submitter name, employee ID, or department name
  if (search) {
    const searchTerm = search.trim();
    // Find matching employee IDs first
    const matchingEmployees = await prisma.employee.findMany({
      where: {
        company_id: companyId,
        OR: [
          { full_name: { contains: searchTerm, mode: "insensitive" as any } },
          { id: { contains: searchTerm, mode: "insensitive" as any } },
        ],
      },
      select: { id: true },
    });

    // Also find employees by department name
    const matchingByDept = await prisma.employment.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        department: {
          name: { contains: searchTerm, mode: "insensitive" as any },
        },
      },
      select: { employee_id: true },
    });

    const allMatchingIds = [
      ...new Set([
        ...matchingEmployees.map((e) => e.id),
        ...matchingByDept.map((e) => e.employee_id),
      ]),
    ];

    where.submitter_id = { in: allMatchingIds };
  }

  const submissions = await prisma.okrSubmission.findMany({
    where,
    include: {
      employeeObjectives: {
        select: {
          id: true,
          title: true,
          status_code: true,
          keyResults: {
            select: {
              id: true,
              title: true,
              status_code: true,
              weight_percent: true,
              metricDefinition: {
                select: { name: true, unit_of_measure: true },
              },
            },
          },
        },
      },
      employeeKeyResults: {
        select: {
          id: true,
          title: true,
          status_code: true,
          weight_percent: true,
          employee_objective_id: true,
        },
      },
      employeeMonthPlans: {
        select: {
          id: true,
          title: true,
          plan_status: true,
          month_number: true,
        },
      },
      weeklyPlans: {
        select: {
          id: true,
          title: true,
          plan_status: true,
          week_number: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Enrich with submitter names and department info
  const submitterIds = [...new Set(submissions.map((s) => s.submitter_id))];
  const employees = await prisma.employee.findMany({
    where: { id: { in: submitterIds }, company_id: companyId },
    select: { id: true, full_name: true },
  });
  const nameMap = new Map(employees.map((e) => [e.id, e.full_name]));

  // Resolve department names for submitters
  const employments = await prisma.employment.findMany({
    where: {
      employee_id: { in: submitterIds },
      company_id: companyId,
      is_active: true,
    },
    select: {
      employee_id: true,
      department: { select: { id: true, name: true } },
    },
  });
  const deptMap = new Map(
    employments.map((e) => [
      e.employee_id,
      e.department ? { id: e.department.id, name: e.department.name } : null,
    ]),
  );

  return submissions.map((s) => ({
    ...s,
    submitter_name: nameMap.get(s.submitter_id) || "Unknown",
    submitter_department: deptMap.get(s.submitter_id) || null,
    item_count:
      s.employeeObjectives.length +
      s.employeeKeyResults.length +
      s.employeeMonthPlans.length +
      s.weeklyPlans.length,
  }));
}

// ─── List Entity Comments ──────────────────────────────────────────────────────

export async function getEntityComments(params: {
  companyId: number;
  entityType: OkrEntityType;
  entityId: number;
}) {
  const { companyId, entityType, entityId } = params;

  return prisma.okrComment.findMany({
    where: {
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
    },
    orderBy: { created_at: "desc" },
  });
}


export async function getSubmissionComments(params: {
  companyId: number;
  submissionId: number;
}) {
  const { companyId, submissionId } = params;
  
  const submission = await prisma.okrSubmission.findFirst({
    where: { id: submissionId, company_id: companyId },
    include: {
      employeeObjectives: { select: { id: true } },
      employeeKeyResults: { select: { id: true } },
      employeeMonthPlans: { select: { id: true } },
      weeklyPlans: { select: { id: true } },
    }
  });

  if (!submission) return [];

  const objectiveIds = submission.employeeObjectives.map(o => o.id);
  const krIds = submission.employeeKeyResults.map(k => k.id);
  const monthIds = submission.employeeMonthPlans.map(m => m.id);
  const weekIds = submission.weeklyPlans.map(w => w.id);

  return prisma.okrComment.findMany({
    where: {
      company_id: companyId,
      OR: [
        { entity_type: "EMPLOYEE_OBJECTIVE", entity_id: { in: objectiveIds } },
        { entity_type: "EMPLOYEE_KR", entity_id: { in: krIds } },
        { entity_type: "EMPLOYEE_MONTH_PLAN", entity_id: { in: monthIds } },
        { entity_type: "WEEKLY_PLAN", entity_id: { in: weekIds } },
      ]
    },
    orderBy: { created_at: "desc" },
  });
}
