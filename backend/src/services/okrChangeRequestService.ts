import { prisma } from "../app";
import {
  OkrEntityType,
  ChangeRequestStatus,
  RealignmentStatus,
} from "@prisma/client";
import * as okrNotificationService from "./okrNotificationService";

export interface CreateChangeRequestParams {
  companyId: number;
  cycleId: number;
  entityType: OkrEntityType;
  entityId: number;
  requesterId: string;
  newValues: any;
  changeSummary?: string;
}

export async function createChangeRequest(params: CreateChangeRequestParams) {
  // 1. Validate entity is published and no pending CR exists
  const existingPending = await prisma.okrChangeRequest.findFirst({
    where: {
      entity_type: params.entityType,
      entity_id: Number(params.entityId),
      status: ChangeRequestStatus.PENDING,
    },
  });

  if (existingPending) {
    throw new Error("A pending change request already exists for this entity.");
  }

  // 2. Fetch current values for diff
  let oldValues: any = {};
  switch (params.entityType) {
    case OkrEntityType.EMPLOYEE_KR:
      oldValues = await prisma.employeeKeyResult.findUnique({
        where: { id: Number(params.entityId) },
      });
      break;
    case OkrEntityType.EMPLOYEE_MONTH_PLAN:
      oldValues = await prisma.employeeMonthPlan.findUnique({
        where: { id: Number(params.entityId) },
      });
      break;
    case OkrEntityType.WEEKLY_PLAN:
      oldValues = await prisma.weeklyPlan.findUnique({
        where: { id: Number(params.entityId) },
      });
      break;
    default:
      throw new Error(
        `Unsupported entity type for change request: ${params.entityType}`,
      );
  }

  if (!oldValues) {
    throw new Error("Entity not found.");
  }

  console.log("requester id", params.requesterId);
  console.log("company id", params.companyId);
  const employee = await prisma.employment.findFirst({
    where: {
      employee_id: params.requesterId,
      company_id: params.companyId,
      is_active: true,
    },
  });
  console.log("employee info", employee);

  const reviewerId = employee?.manager_id || null;
  if (!reviewerId) {
    throw new Error(
      "No manager assigned to your profile. Please ensure you have a manager set in your employment details to submit edit requests.",
    );
  }

  // 4. Create CR
  const cr = await prisma.okrChangeRequest.create({
    data: {
      company_id: Number(params.companyId),
      cycle_id: Number(params.cycleId),
      entity_type: params.entityType,
      entity_id: Number(params.entityId),
      requester_id: params.requesterId,
      reviewer_id: reviewerId,
      old_values_json: oldValues,
      new_values_json: params.newValues,
      change_summary: params.changeSummary,
      status: ChangeRequestStatus.PENDING,
    },
  });

  // 5. Notify reviewer
  if (reviewerId) {
    const requester = await prisma.appUser.findUnique({
      where: { employee_id: params.requesterId },
      include: { employee: true },
    });
    await okrNotificationService.notifyChangeRequestSubmitted({
      companyId: params.companyId,
      reviewerUserId: reviewerId,
      submitterName: requester?.employee?.full_name || params.requesterId,
      entityId: cr.id,
    });
  }

  return cr;
}

export async function approveChangeRequest(
  crId: number,
  approverId: string,
  comment?: string,
) {
  const cr = await prisma.okrChangeRequest.findUnique({
    where: { id: crId },
  });

  if (!cr || cr.status !== ChangeRequestStatus.PENDING) {
    throw new Error("Change request not found or not pending.");
  }

  // 1. Apply changes to entity
  const newValues = cr.new_values_json as any;
  const updateData = {
    title: newValues.title,
    target_value: newValues.target_value,
    weight_percent: newValues.weight_percent || newValues.weight_pct,
    description: newValues.description,
  };

  switch (cr.entity_type) {
    case OkrEntityType.EMPLOYEE_KR:
      await prisma.employeeKeyResult.update({
        where: { id: cr.entity_id },
        data: updateData,
      });
      break;
    case OkrEntityType.EMPLOYEE_MONTH_PLAN:
      await prisma.employeeMonthPlan.update({
        where: { id: cr.entity_id },
        data: {
          title: newValues.title,
          target_value: newValues.target_value,
          weight_pct: newValues.weight_pct,
          description: newValues.description,
        },
      });
      break;
    case OkrEntityType.WEEKLY_PLAN:
      await prisma.weeklyPlan.update({
        where: { id: cr.entity_id },
        data: {
          title: newValues.title,
          target_value: newValues.target_value,
          weight_pct: newValues.weight_pct,
        },
      });
      break;
  }

  // 2. Update CR status
  await prisma.okrChangeRequest.update({
    where: { id: crId },
    data: {
      status: ChangeRequestStatus.APPROVED,
      reviewer_id: approverId,
      review_comment: comment,
      reviewed_at: new Date(),
    },
  });

  // 3. Trigger cascade notifications
  await triggerCascadeNotifications(cr);

  // 4. Notify requester
  const approver = await prisma.appUser.findUnique({
    where: { employee_id: approverId },
    include: { employee: true },
  });
  await okrNotificationService.notifyChangeRequestApproved({
    companyId: cr.company_id,
    submitterEmployeeId: cr.requester_id,
    approverName: approver?.employee?.full_name || approverId,
    entityId: cr.id,
  });
}

export async function rejectChangeRequest(
  crId: number,
  approverId: string,
  reason: string,
) {
  const cr = await prisma.okrChangeRequest.findUnique({
    where: { id: crId },
  });

  if (!cr || cr.status !== ChangeRequestStatus.PENDING) {
    throw new Error("Change request not found or not pending.");
  }

  await prisma.okrChangeRequest.update({
    where: { id: crId },
    data: {
      status: ChangeRequestStatus.REJECTED,
      reviewer_id: approverId,
      review_comment: reason,
      reviewed_at: new Date(),
    },
  });

  const approver = await prisma.appUser.findUnique({
    where: { employee_id: approverId },
    include: { employee: true },
  });
  await okrNotificationService.notifyChangeRequestRejected({
    companyId: cr.company_id,
    submitterEmployeeId: cr.requester_id,
    approverName: approver?.employee?.full_name || approverId,
    reason: reason,
    entityId: cr.id,
  });
}

async function triggerCascadeNotifications(cr: any) {
  let affectedSubordinates: {
    ownerId: string;
    entityType: OkrEntityType;
    entityId: number;
  }[] = [];

  switch (cr.entity_type) {
    case OkrEntityType.EMPLOYEE_KR:
      const objectives = await prisma.employeeObjective.findMany({
        where: { chosen_parent_employee_kr_id: cr.entity_id },
        select: { user_id: true, id: true },
      });
      affectedSubordinates = objectives.map((obj) => ({
        ownerId: obj.user_id,
        entityType: OkrEntityType.EMPLOYEE_OBJECTIVE,
        entityId: obj.id,
      }));
      break;

    case OkrEntityType.EMPLOYEE_MONTH_PLAN:
      const monthPlans = await prisma.employeeMonthPlan.findMany({
        where: { aligned_manager_plan_id: cr.entity_id },
        select: { owner_id: true, id: true },
      });
      affectedSubordinates = monthPlans.map((p) => ({
        ownerId: p.owner_id,
        entityType: OkrEntityType.EMPLOYEE_MONTH_PLAN,
        entityId: p.id,
      }));
      break;

    case OkrEntityType.WEEKLY_PLAN:
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { aligned_manager_plan_id: cr.entity_id },
        select: { owner_id: true, id: true },
      });
      affectedSubordinates = weeklyPlans.map((p) => ({
        ownerId: p.owner_id,
        entityType: OkrEntityType.WEEKLY_PLAN,
        entityId: p.id,
      }));
      break;
  }

  // Create Realignment Flags and send notifications
  for (const sub of affectedSubordinates) {
    const flag = await prisma.okrRealignmentFlag.create({
      data: {
        company_id: cr.company_id,
        change_request_id: cr.id,
        affected_entity_type: sub.entityType,
        affected_entity_id: sub.entityId,
        affected_owner_id: sub.ownerId,
        status: RealignmentStatus.PENDING,
      },
    });

    await okrNotificationService.notifyRealignmentRequired({
      companyId: cr.company_id,
      reviewerUserId: sub.ownerId, // using reviewerUserId as the generic recipient field
      entityId: flag.id,
    });
  }
}

export async function acknowledgeRealignment(flagId: number, userId: string) {
  await prisma.okrRealignmentFlag.updateMany({
    where: { id: flagId, affected_owner_id: userId },
    data: {
      status: RealignmentStatus.ACKNOWLEDGED,
      acknowledged_at: new Date(),
    },
  });
}

export async function dismissRealignment(
  flagId: number,
  userId: string,
  reason: string,
) {
  await prisma.okrRealignmentFlag.updateMany({
    where: { id: flagId, affected_owner_id: userId },
    data: {
      status: RealignmentStatus.DISMISSED,
      dismiss_reason: reason,
      dismissed_at: new Date(),
    },
  });
}

export async function completeRealignment(flagId: number, userId: string) {
  await prisma.okrRealignmentFlag.updateMany({
    where: { id: flagId, affected_owner_id: userId },
    data: {
      status: RealignmentStatus.REALIGNED,
      realigned_at: new Date(),
    },
  });
}

export async function getMyRealignmentFlags(userId: string, companyId: number) {
  return prisma.okrRealignmentFlag.findMany({
    where: {
      company_id: companyId,
      affected_owner_id: userId,
      status: {
        in: [RealignmentStatus.PENDING, RealignmentStatus.ACKNOWLEDGED],
      },
    },
    include: {
      changeRequest: true,
    },
    orderBy: { created_at: "desc" },
  });
}
