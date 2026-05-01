import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrSubmissionType, OkrEntityType } from "@prisma/client";

export async function submitForApproval(params: {
  companyId: number;
  cycleId: number;
  submitterId: string;
  departmentId?: number;
  type: OkrSubmissionType;
}) {
  const { companyId, cycleId, submitterId, departmentId, type } = params;

  // 1. Identify items to include in this submission
  let items: any[] = [];
  const statusFilter = { company_id: companyId, status_code: "draft" };

  if (type === "OBJECTIVE_PLANNING") {
    if (departmentId) {
      // Department Level
      const objectives = await prisma.employeeObjective.findMany({
        where: { 
          ...statusFilter, 
          cycle_id: cycleId, 
          user: { 
            employee: { 
              employments: { some: { department_id: departmentId, is_active: true } } 
            } 
          } 
        },
        include: { keyResults: true },
      });
      items = objectives.flatMap(o => [
        { id: o.id, entityType: "EMPLOYEE_OBJECTIVE" },
        ...o.keyResults.map(kr => ({ id: kr.id, entityType: "EMPLOYEE_KR" }))
      ]);
    } else {
      // Employee Level
      const objectives = await prisma.employeeObjective.findMany({
        where: { ...statusFilter, cycle_id: cycleId, user_id: submitterId },
        include: { keyResults: true },
      });
      items = objectives.flatMap(o => [
        { id: o.id, entityType: "EMPLOYEE_OBJECTIVE" },
        ...o.keyResults.map(kr => ({ id: kr.id, entityType: "EMPLOYEE_KR" }))
      ]);
    }
  } else if (type === "MONTHLY_PLAN") {
    if (departmentId) {
      const plans = await prisma.employeeMonthPlan.findMany({
        where: { 
          ...statusFilter, 
          employeeObjective: { 
            cycle_id: cycleId, 
            user: { 
              employee: { 
                employments: { some: { department_id: departmentId, is_active: true } } 
              } 
            } 
          } 
        },
      });
      items = plans.map(p => ({ id: p.id, entityType: "EMPLOYEE_MONTH_PLAN" }));
    } else {
      const plans = await prisma.employeeMonthPlan.findMany({
        where: { ...statusFilter, employeeObjective: { cycle_id: cycleId, user_id: submitterId } },
      });
      items = plans.map(p => ({ id: p.id, entityType: "EMPLOYEE_MONTH_PLAN" }));
    }
  } else if (type === "WEEKLY_PLAN") {
    if (departmentId) {
      const plans = await prisma.weeklyPlan.findMany({
        where: { 
          ...statusFilter, 
          employeeKr: { 
            employeeObjective: { 
              cycle_id: cycleId, 
              user: { 
                employee: { 
                  employments: { some: { department_id: departmentId, is_active: true } } 
                } 
              } 
            } 
          } 
        },
      });
      items = plans.map(p => ({ id: p.id, entityType: "WEEKLY_PLAN" }));
    } else {
      const plans = await prisma.weeklyPlan.findMany({
        where: { ...statusFilter, employeeKr: { employeeObjective: { cycle_id: cycleId, user_id: submitterId } } },
      });
      items = plans.map(p => ({ id: p.id, entityType: "WEEKLY_PLAN" }));
    }
  }

  if (items.length === 0) {
    throw new Error("No draft items found to submit for approval.");
  }

  // 2. Create the submission record
  const submission = await prisma.okrSubmission.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      submitter_id: submitterId,
      department_id: departmentId,
      status: "pending_approval",
      type: type,
    },
  });

  // 3. Update all items to pending_approval and link to submission
  for (const item of items) {
    const updateData = { status_code: "pending_approval", submission_id: submission.id };
    switch (item.entityType) {
      case "EMPLOYEE_OBJECTIVE": await prisma.employeeObjective.update({ where: { id: item.id }, data: updateData }); break;
      case "EMPLOYEE_KR": await prisma.employeeKeyResult.update({ where: { id: item.id }, data: updateData }); break;
      case "EMPLOYEE_MONTH_PLAN": await prisma.employeeMonthPlan.update({ where: { id: item.id }, data: updateData }); break;
      case "WEEKLY_PLAN": await prisma.weeklyPlan.update({ where: { id: item.id }, data: updateData }); break;
    }
  }

  await logActivity({
    companyId,
    entityType: "SUBMISSION",
    entityId: submission.id,
    actorId: submitterId,
    action: "submission_created",
    description: `Submission of type ${type} created with ${items.length} items.`,
  });

  return submission;
}

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
      // Map to specific relation fields for convenience if needed, 
      // though entity_type/entity_id is the primary generic way.
      ...(entityType === "EMPLOYEE_OBJECTIVE" ? { employeeObjectiveId: entityId } : {}),
      ...(entityType === "EMPLOYEE_KR" ? { employeeKeyResultId: entityId } : {}),
    }
  });

  // 2. Set item back to draft
  const updateData = { status_code: "draft" };
  let submissionId: number | null = null;

  switch (entityType) {
    case "EMPLOYEE_OBJECTIVE": {
      const obj = await prisma.employeeObjective.update({ where: { id: entityId }, data: updateData, select: { submission_id: true } });
      submissionId = obj.submission_id;
      break;
    }
    case "EMPLOYEE_KR": {
      const kr = await prisma.employeeKeyResult.update({ where: { id: entityId }, data: updateData, select: { submission_id: true } });
      submissionId = kr.submission_id;
      break;
    }
    case "EMPLOYEE_MONTH_PLAN": {
      const plan = await prisma.employeeMonthPlan.update({ where: { id: entityId }, data: updateData, select: { submission_id: true } });
      submissionId = plan.submission_id;
      break;
    }
    case "WEEKLY_PLAN": {
      const plan = await prisma.weeklyPlan.update({ where: { id: entityId }, data: updateData, select: { submission_id: true } });
      submissionId = plan.submission_id;
      break;
    }
  }

  await logActivity({
    companyId,
    entityType,
    entityId,
    actorId: authorId,
    action: "review_comment_added",
    description: `Comment added by reviewer. Item reverted to draft.`,
    metadata: { comment, submission_id: submissionId },
  });

  return okrComment;
}

export async function approveSubmission(submissionId: number, reviewerId: string) {
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
  if (submission.status === "approved") throw new Error("Submission is already approved.");

  // Rule 2 & 5: Check if all items are in pending_approval
  const allItems = [
    ...submission.employeeObjectives,
    ...submission.employeeKeyResults,
    ...submission.employeeMonthPlans,
    ...submission.weeklyPlans,
  ];

  const nonPendingItems = allItems.filter(item => item.status_code !== "pending_approval");

  if (nonPendingItems.length > 0) {
    throw new Error(
      `Cannot approve submission. ${nonPendingItems.length} items are still in draft or require revision.`
    );
  }

  // Rule 6: Final Approval - Set everything to approved
  await prisma.$transaction(async (tx) => {
    await tx.okrSubmission.update({
      where: { id: submissionId },
      data: { status: "approved", reviewer_id: reviewerId },
    });

    const updateData = {
      status_code: "published",
      published_at: new Date(),
      published_by: reviewerId,
    };

    // Batch updates (not truly batch in prisma but sequential in tx)
    for (const obj of submission.employeeObjectives)
      await tx.employeeObjective.update({ where: { id: obj.id }, data: updateData });
    for (const kr of submission.employeeKeyResults)
      await tx.employeeKeyResult.update({ where: { id: kr.id }, data: updateData });
    for (const plan of submission.employeeMonthPlans)
      await tx.employeeMonthPlan.update({ where: { id: plan.id }, data: updateData });
    for (const plan of submission.weeklyPlans) {
      await tx.weeklyPlan.update({ where: { id: plan.id }, data: updateData });
      await tx.weeklyTask.updateMany({
        where: { weekly_plan_id: plan.id },
        data: { status_code: "published" },
      });
      await tx.dailyPlan.updateMany({
        where: { weeklyTask: { weekly_plan_id: plan.id } },
        data: {
          status_code: "published",
          published_at: updateData.published_at,
          published_by: updateData.published_by,
        },
      });
    }
  });

  await logActivity({
    companyId: submission.company_id,
    entityType: "SUBMISSION",
    entityId: submission.id,
    actorId: reviewerId,
    action: "submission_approved",
    description: `Submission approved. All ${allItems.length} items moved to approved status.`,
  });

  return { success: true };
}
